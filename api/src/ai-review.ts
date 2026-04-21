import { getDb } from './database';
import { getS3Object } from './s3';
import { getMqttClient } from './mqtt';
import { sendPushNotifications } from './push';
import { Readable } from 'stream';
import { v4 as uuid } from 'uuid';

const OLLAMA_HOST = process.env.OLLAMA_HOST || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llava';
const OLLAMA_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'gpt-oss:20b-heretic-ara-v3';

interface AiConfig {
  enabled: boolean;
  prompt?: string;
  temperature?: number;
  include_visual?: boolean;
  telemetry_hours?: number[];
  notify?: boolean;
}

function nowSqlite(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getTelemetryForWindow(db: ReturnType<typeof getDb>, sensorIds: string[], hours: number): any[] {
  if (sensorIds.length === 0) return [];
  const placeholders = sensorIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT sensor_id, AVG(value) as avg_val, MIN(value) as min_val, MAX(value) as max_val,
      COUNT(*) as readings
    FROM telemetry
    WHERE sensor_id IN (${placeholders})
      AND timestamp >= datetime('now', '-${hours} hours')
    GROUP BY sensor_id
  `).all(...sensorIds) as any[];
}

export async function performAiReview(timepointId: string): Promise<{ success: boolean; error?: string }> {
  if (!OLLAMA_HOST) return { success: false, error: 'OLLAMA_HOST not configured' };

  const db = getDb();
  const tp = db.prepare(`
    SELECT tp.*, g.name as grow_name, g.start_date, g.strain, g.grow_medium, g.status as grow_status, g.description as grow_description
    FROM timepoints tp
    JOIN grows g ON tp.grow_id = g.id
    WHERE tp.id = ?
  `).get(timepointId) as any;

  if (!tp) return { success: false, error: 'Timepoint not found' };

  const existingReview = db.prepare(
    "SELECT id FROM timepoint_data WHERE timepoint_id = ? AND field_name = 'AI Review'"
  ).get(timepointId);
  if (existingReview) return { success: true, error: 'AI review already exists for this timepoint' };

  let config: AiConfig = { enabled: true, temperature: 0.7, include_visual: true, telemetry_hours: [1, 6, 24], notify: true };
  if (tp.ai_config) {
    try { config = { ...config, ...JSON.parse(tp.ai_config) }; } catch {}
  }

  console.log(`[AI-REVIEW] Starting review for timepoint "${tp.title}" (${timepointId})`);

  const phases = db.prepare('SELECT * FROM protocol_phases WHERE grow_id = ? ORDER BY order_index').all(tp.grow_id) as any[];
  const daysSinceStart = Math.floor((Date.now() - new Date(tp.start_date).getTime()) / 86400000);
  const currentPhase = phases.find((p: any) => daysSinceStart >= p.start_day && (!p.end_day || daysSinceStart <= p.end_day));

  const sensors = db.prepare("SELECT id, name, unit, type FROM sensors WHERE type = 'sensor'").all() as any[];
  const sensorIds = sensors.map((s: any) => s.id);
  const sensorMap = new Map(sensors.map((s: any) => [s.id, s]));

  const telemetryWindows = config.telemetry_hours || [1, 6, 24];
  const dataGaps: string[] = [];

  const telemetrySections: string[] = [];
  for (const hours of telemetryWindows) {
    const rows = getTelemetryForWindow(db, sensorIds, hours);
    if (rows.length === 0) {
      dataGaps.push(`Telemetry (${hours}h): NO DATA RECORDED`);
      telemetrySections.push(`SENSOR READINGS (last ${hours}h):\nNo telemetry data recorded`);
    } else {
      const totalReadings = rows.reduce((sum: number, r: any) => sum + r.readings, 0);
      const summary = rows.map((t: any) => {
        const s = sensorMap.get(t.sensor_id);
        return s ? `  ${s.name}: avg=${t.avg_val?.toFixed(2)} ${s.unit}, range [${t.min_val?.toFixed(2)}–${t.max_val?.toFixed(2)}], ${t.readings} readings` : null;
      }).filter(Boolean).join('\n');
      telemetrySections.push(`SENSOR READINGS (last ${hours}h) — ${totalReadings} readings across ${rows.length} sensors:\n${summary}`);
    }
  }

  const recentCompleted = db.prepare(`
    SELECT tp.*, (SELECT GROUP_CONCAT(td.field_name || '=' || COALESCE(td.value_number, td.value_text) || COALESCE(' ' || td.unit, ''), '; ')
      FROM timepoint_data td WHERE td.timepoint_id = tp.id) as data_summary
    FROM timepoints tp
    WHERE tp.grow_id = ? AND tp.status = 'completed'
      AND tp.scheduled_at >= datetime('now', '-24 hours')
    ORDER BY tp.scheduled_at DESC LIMIT 10
  `).all(tp.grow_id) as any[];

  const todayScheduled = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM timepoints
    WHERE grow_id = ? AND date(scheduled_at) = date('now')
  `).get(tp.grow_id) as any;

  if (recentCompleted.length === 0) {
    dataGaps.push('Recent checks (24h): NO COMPLETED CHECKS');
  }
  if (todayScheduled && todayScheduled.total > 0 && todayScheduled.completed < todayScheduled.total) {
    dataGaps.push(`User timepoint checks: ${todayScheduled.completed} of ${todayScheduled.total} scheduled checks completed today`);
  }

  let latestPhoto: any = null;
  let base64Image: string | null = null;
  let visualAssessment: string | null = null;

  if (config.include_visual !== false) {
    latestPhoto = db.prepare(`
      SELECT * FROM media
      WHERE grow_id = ? AND mime_type LIKE 'image/%'
      ORDER BY captured_at DESC LIMIT 1
    `).get(tp.grow_id) as any;

    if (!latestPhoto) {
      dataGaps.push('Recent photos: NO PHOTOS RECORDED FOR THIS GROW');
    } else {
      const photoAge = Math.round((Date.now() - new Date(latestPhoto.captured_at).getTime()) / 3600000);
      if (photoAge > 48) {
        dataGaps.push(`Recent photos: latest photo is ${photoAge}h old (${latestPhoto.captured_at})`);
      }

      try {
        const s3Resp = await getS3Object(latestPhoto.s3_key);
        const imageBuffer = await streamToBuffer(s3Resp.Body as Readable);
        base64Image = imageBuffer.toString('base64');
      } catch (err: any) {
        console.error('[AI-REVIEW] Failed to fetch image from S3:', err.message);
        dataGaps.push('Recent photos: failed to retrieve image from storage');
        base64Image = null;
      }
    }
  }

  const temperature = config.temperature ?? 0.7;
  const convId = uuid();
  const now = nowSqlite();
  db.prepare(`
    INSERT INTO ai_conversations (id, grow_id, title, model, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(convId, tp.grow_id, `AI Review: ${tp.title}`, OLLAMA_TEXT_MODEL, now, now);

  // -- Step 1: Vision assessment --
  if (base64Image && latestPhoto) {
    const visionPrompt = `You are an expert plant scientist examining a photo from an aeroponic growing system.
Analyze this plant image and provide a detailed visual health assessment covering:
- Overall plant appearance and vigor
- Leaf color, shape, and any discoloration or spotting
- Root condition (if visible)
- Signs of nutrient deficiency or toxicity
- Signs of pests or disease
- Growth stage assessment
- Any abnormalities or concerns

Photo captured: ${latestPhoto.captured_at}
Grow: "${tp.grow_name}" — Day ${daysSinceStart}${currentPhase ? `, Phase: ${currentPhase.name}` : ''}
${tp.strain ? `Strain: ${tp.strain}` : ''}

Be specific and concise. Reference what you actually see.`;

    db.prepare(`
      INSERT INTO ai_messages (id, conversation_id, role, content, model, created_at)
      VALUES (?, ?, 'user', ?, ?, ?)
    `).run(uuid(), convId, visionPrompt, OLLAMA_MODEL, nowSqlite());

    try {
      console.log('[AI-REVIEW] Step 1: Vision analysis...');
      const vStart = Date.now();
      const vResp = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: visionPrompt,
          images: [base64Image],
          stream: false,
          options: { temperature },
        }),
      });

      if (vResp.ok) {
        const vResult = await vResp.json() as { response: string };
        visualAssessment = vResult.response;
        const vDuration = Date.now() - vStart;
        console.log(`[AI-REVIEW] Vision analysis complete (${(vDuration / 1000).toFixed(1)}s)`);

        db.prepare(`
          INSERT INTO ai_messages (id, conversation_id, role, content, model, duration_ms, created_at)
          VALUES (?, ?, 'assistant', ?, ?, ?, ?)
        `).run(uuid(), convId, visualAssessment, OLLAMA_MODEL, vDuration, nowSqlite());
      } else {
        console.error('[AI-REVIEW] Vision model error:', vResp.status);
        dataGaps.push('Visual analysis: vision model returned an error');
      }
    } catch (err: any) {
      console.error('[AI-REVIEW] Vision call failed:', err.message);
      dataGaps.push('Visual analysis: failed to reach vision model');
    }
  }

  // -- Step 2: Text analysis with recommendations --
  const notesSummary = recentCompleted.length > 0
    ? recentCompleted.map((c: any) =>
        `[${c.scheduled_at}] ${c.title}: ${c.data_summary || 'no recorded data'}`
      ).join('\n')
    : 'No completed checks in the last 24 hours';

  const dataAvailability = [
    ...telemetryWindows.map(h => {
      const rows = getTelemetryForWindow(db, sensorIds, h);
      return rows.length > 0
        ? `- Telemetry (${h}h): ${rows.reduce((s: number, r: any) => s + r.readings, 0)} readings across ${rows.length} sensors OK`
        : `- Telemetry (${h}h): NO DATA RECORDED`;
    }),
    recentCompleted.length > 0
      ? `- Last completed check: "${recentCompleted[0].title}" at ${recentCompleted[0].scheduled_at} OK`
      : '- Recent checks (24h): NO COMPLETED CHECKS',
    latestPhoto
      ? `- Latest photo: ${latestPhoto.captured_at} OK`
      : '- Recent photos: NO PHOTOS AVAILABLE',
    todayScheduled
      ? `- Scheduled checks today: ${todayScheduled.completed}/${todayScheduled.total} completed`
      : '- Scheduled checks: unable to determine',
  ].join('\n');

  const textPrompt = `You are an expert plant scientist and automation advisor for an aeroponic growing system called "plant.io". You are performing an automated review of the current growing environment.

GROW: "${tp.grow_name}"
${tp.strain ? `Strain: ${tp.strain}` : ''}
Medium: ${tp.grow_medium}
Started: ${tp.start_date} (Day ${daysSinceStart})
Status: ${tp.grow_status}
${tp.grow_description ? `Description: ${tp.grow_description}` : ''}

CURRENT PHASE: ${currentPhase ? `${currentPhase.name} (Day ${currentPhase.start_day}${currentPhase.end_day ? '–' + currentPhase.end_day : '+'})` : 'Not determined'}

${telemetrySections.join('\n\n')}

RECENT COMPLETED CHECKS (last 24h):
${notesSummary}

VISUAL PLANT HEALTH ASSESSMENT:
${visualAssessment || 'No visual assessment available (no recent photo or visual analysis not configured)'}

DATA AVAILABILITY:
${dataAvailability}

${config.prompt ? `ADDITIONAL INSTRUCTIONS FROM GROWER:\n${config.prompt}\n` : ''}
Based on ALL the data above, provide a comprehensive review with:

1. **Environment Summary**: Current conditions and trends from telemetry data across the available time windows.
2. **Plant Health Status**: Synthesize visual assessment (if available) with environmental data.
3. **Concerns & Risks**: Identify any values out of optimal range, negative trends, or visual symptoms.
4. **Actionable Recommendations**: Provide SPECIFIC, CONCRETE actions the grower should take. Examples:
   - "Reduce misting cycle from 30s to 20s on/off"
   - "Add 1ml/gal pH Down — current pH 6.4 is above optimal 5.8"
   - "Increase nutrient concentration by 100ppm — EC is low at 800µS/cm"
   - "Check root zone — visual signs of browning may indicate pythium"
5. **Data Gaps**: Call out any missing data and how it limits this analysis.

If data is missing, note this explicitly and qualify any recommendations accordingly. Do not speculate about data you do not have.`;

  db.prepare(`
    INSERT INTO ai_messages (id, conversation_id, role, content, model, created_at)
    VALUES (?, ?, 'user', ?, ?, ?)
  `).run(uuid(), convId, textPrompt, OLLAMA_TEXT_MODEL, nowSqlite());

  let reviewResponse: string;
  let reviewDuration: number;

  try {
    console.log('[AI-REVIEW] Step 2: Comprehensive analysis...');
    const tStart = Date.now();
    const tResp = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_TEXT_MODEL,
        prompt: textPrompt,
        stream: false,
        options: { temperature },
      }),
    });

    if (!tResp.ok) {
      const errText = await tResp.text();
      console.error('[AI-REVIEW] Text model error:', tResp.status, errText);
      return { success: false, error: `Ollama text model error: ${tResp.status}` };
    }

    const tResult = await tResp.json() as { response: string };
    reviewResponse = tResult.response;
    reviewDuration = Date.now() - tStart;
    console.log(`[AI-REVIEW] Analysis complete (${(reviewDuration / 1000).toFixed(1)}s)`);

    db.prepare(`
      INSERT INTO ai_messages (id, conversation_id, role, content, model, duration_ms, context, created_at)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)
    `).run(uuid(), convId, reviewResponse, OLLAMA_TEXT_MODEL, reviewDuration, JSON.stringify({
      day: daysSinceStart, phase: currentPhase?.name || null,
      sensor_count: sensors.length, data_gaps: dataGaps.length,
      had_visual: !!visualAssessment,
    }), nowSqlite());
  } catch (err: any) {
    console.error('[AI-REVIEW] Text call failed:', err.message);
    return { success: false, error: `Failed to reach Ollama: ${err.message}` };
  }

  // -- Store results as timepoint_data --
  const insertData = db.prepare(`
    INSERT INTO timepoint_data (id, timepoint_id, field_name, field_type, value_text, created_at)
    VALUES (?, ?, ?, 'text', ?, ?)
  `);

  insertData.run(uuid(), timepointId, 'AI Review', reviewResponse, nowSqlite());

  if (visualAssessment) {
    insertData.run(uuid(), timepointId, 'AI Visual Assessment', visualAssessment, nowSqlite());
  }

  if (dataGaps.length > 0) {
    insertData.run(uuid(), timepointId, 'AI Data Gaps', dataGaps.join('\n'), nowSqlite());
  }

  db.prepare("UPDATE timepoints SET status = 'completed' WHERE id = ?").run(timepointId);

  // -- Notification --
  if (config.notify !== false) {
    const notifId = uuid();
    const summaryLine = reviewResponse.split('\n').find(l => l.trim().length > 10)?.trim().slice(0, 200) || 'AI review completed';
    const notifMessage = `AI review for "${tp.title}" (Day ${daysSinceStart}): ${summaryLine}`;

    db.prepare(`
      INSERT INTO notifications (id, type, severity, title, message, timepoint_id)
      VALUES (?, 'ai_review', 'info', ?, ?, ?)
    `).run(notifId, `AI Review: ${tp.title}`, notifMessage, timepointId);

    const client = getMqttClient();
    if (client?.connected) {
      client.publish('pio/notifications', JSON.stringify({
        id: notifId, type: 'ai_review', severity: 'info',
        title: `AI Review: ${tp.title}`, message: notifMessage,
      }), { qos: 1 });
    }

    sendPushNotifications(`AI Review: ${tp.title}`, notifMessage, {
      type: 'ai_review', notificationId: notifId, timepointId,
    }).catch(err => console.error('[AI-REVIEW] Push failed:', err.message));
  }

  console.log(`[AI-REVIEW] Completed review for "${tp.title}" — ${dataGaps.length} data gaps, visual=${!!visualAssessment}`);
  return { success: true };
}
