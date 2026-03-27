import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { getS3Object } from '../s3';
import { Readable } from 'stream';

const router = Router();

const OLLAMA_HOST = process.env.OLLAMA_HOST || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llava';
const OLLAMA_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'gpt-oss:20b-heretic-ara-v3';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

router.get('/status', async (_req: Request, res: Response) => {
  if (!OLLAMA_HOST) {
    res.json({ configured: false, message: 'OLLAMA_HOST not set' });
    return;
  }

  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      res.json({ configured: true, connected: false, host: OLLAMA_HOST, error: `HTTP ${resp.status}` });
      return;
    }
    const data = await resp.json() as { models?: Array<{ name: string; size: number; modified_at: string }> };
    const models = (data.models || []).map((m) => ({
      name: m.name,
      size_gb: +(m.size / 1e9).toFixed(1),
      modified: m.modified_at,
    }));
    res.json({ configured: true, connected: true, host: OLLAMA_HOST, default_model: OLLAMA_MODEL, text_model: OLLAMA_TEXT_MODEL, models });
  } catch (err: any) {
    res.json({ configured: true, connected: false, host: OLLAMA_HOST, error: err.message });
  }
});

router.post('/analyze', async (req: Request, res: Response) => {
  if (!OLLAMA_HOST) {
    res.status(400).json({ error: 'OLLAMA_HOST not configured' });
    return;
  }

  const { mediaId, prompt, model } = req.body;
  if (!mediaId || !prompt) {
    res.status(400).json({ error: 'mediaId and prompt are required' });
    return;
  }

  const db = getDb();
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as any;
  if (!media) {
    res.status(404).json({ error: 'Media not found' });
    return;
  }

  if (!media.mime_type?.startsWith('image/')) {
    res.status(400).json({ error: 'Only image analysis is supported' });
    return;
  }

  try {
    const s3Resp = await getS3Object(media.s3_key);
    const imageBuffer = await streamToBuffer(s3Resp.Body as Readable);
    const base64Image = imageBuffer.toString('base64');

    const useModel = model || OLLAMA_MODEL;
    const start = Date.now();

    const ollamaResp = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        prompt,
        images: [base64Image],
        stream: false,
      }),
    });

    if (!ollamaResp.ok) {
      const errText = await ollamaResp.text();
      res.status(502).json({ error: `Ollama error: ${ollamaResp.status}`, detail: errText });
      return;
    }

    const result = await ollamaResp.json() as { response: string; total_duration?: number };
    const duration_ms = Date.now() - start;

    res.json({
      response: result.response,
      model: useModel,
      duration_ms,
      ollama_duration_ns: result.total_duration,
    });
  } catch (err: any) {
    console.error('[AI] Analysis error:', err);
    res.status(502).json({ error: `Failed to reach Ollama: ${err.message}` });
  }
});

router.post('/notebook', async (req: Request, res: Response) => {
  if (!OLLAMA_HOST) {
    res.status(400).json({ error: 'OLLAMA_HOST not configured' });
    return;
  }

  const { growId, prompt, model, mode } = req.body;
  if (!growId || !prompt) {
    res.status(400).json({ error: 'growId and prompt are required' });
    return;
  }

  const db = getDb();
  const grow = db.prepare('SELECT * FROM grows WHERE id = ?').get(growId) as any;
  if (!grow) { res.status(404).json({ error: 'Grow not found' }); return; }

  const phases = db.prepare('SELECT * FROM protocol_phases WHERE grow_id = ? ORDER BY order_index').all(growId) as any[];
  const timepoints = db.prepare('SELECT * FROM timepoints WHERE grow_id = ? ORDER BY scheduled_at DESC LIMIT 50').all(growId) as any[];

  const completedTps = timepoints.filter((t: any) => t.status === 'completed');
  const tpIds = completedTps.map((t: any) => t.id);
  let tpData: any[] = [];
  if (tpIds.length > 0) {
    const placeholders = tpIds.map(() => '?').join(',');
    tpData = db.prepare(`SELECT * FROM timepoint_data WHERE timepoint_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 200`).all(...tpIds);
  }

  const sensors = db.prepare('SELECT id, name, unit, type FROM sensors').all() as any[];
  const sensorIds = sensors.map((s: any) => s.id);
  let recentTelemetry: any[] = [];
  if (sensorIds.length > 0) {
    const placeholders = sensorIds.map(() => '?').join(',');
    recentTelemetry = db.prepare(`
      SELECT sensor_id, AVG(value) as avg_val, MIN(value) as min_val, MAX(value) as max_val,
        COUNT(*) as readings
      FROM telemetry
      WHERE sensor_id IN (${placeholders})
        AND timestamp >= datetime('now', '-24 hours')
      GROUP BY sensor_id
    `).all(...sensorIds);
  }

  const daysSinceStart = Math.floor((Date.now() - new Date(grow.start_date).getTime()) / 86400000);
  const currentPhase = phases.find((p: any) =>
    daysSinceStart >= p.start_day && (!p.end_day || daysSinceStart <= p.end_day)
  );

  const sensorMap = new Map(sensors.map((s: any) => [s.id, s]));
  const telemetrySummary = recentTelemetry.map((t: any) => {
    const s = sensorMap.get(t.sensor_id);
    return s ? `${s.name}: avg=${t.avg_val?.toFixed(2)} ${s.unit}, range [${t.min_val?.toFixed(2)}–${t.max_val?.toFixed(2)}], ${t.readings} readings (24h)` : null;
  }).filter(Boolean).join('\n');

  const tpSummary = completedTps.slice(0, 20).map((tp: any) => {
    const data = tpData.filter((d: any) => d.timepoint_id === tp.id);
    const dataStr = data.map((d: any) => `${d.field_name}=${d.value_number ?? d.value_text}${d.unit ? ' ' + d.unit : ''}`).join(', ');
    return `[${tp.scheduled_at}] ${tp.title} (${tp.status})${dataStr ? ': ' + dataStr : ''}`;
  }).join('\n');

  const pendingTps = timepoints.filter((t: any) => t.status === 'pending' || t.status === 'overdue');
  const pendingSummary = pendingTps.slice(0, 10).map((tp: any) =>
    `[${tp.scheduled_at}] ${tp.title} (${tp.status})`
  ).join('\n');

  const systemContext = `You are an expert plant scientist and lab notebook assistant for an aeroponic growing system called "plant.io".

GROW: "${grow.name}"
${grow.strain ? `Strain: ${grow.strain}` : ''}
Medium: ${grow.grow_medium}
Started: ${grow.start_date} (Day ${daysSinceStart})
Status: ${grow.status}
${grow.description ? `Description: ${grow.description}` : ''}

PROTOCOL PHASES (${phases.length}):
${phases.map((p: any, i: number) => `${i + 1}. ${p.name} (Day ${p.start_day}${p.end_day ? '–' + p.end_day : '+'}): ${p.description || 'no description'}`).join('\n')}
${currentPhase ? `\nCURRENT PHASE: ${currentPhase.name} (Day ${currentPhase.start_day}${currentPhase.end_day ? '–' + currentPhase.end_day : '+'})` : ''}

SENSOR READINGS (last 24h):
${telemetrySummary || 'No recent telemetry data'}

RECENT COMPLETED TIMEPOINTS:
${tpSummary || 'No completed timepoints yet'}

PENDING/OVERDUE TIMEPOINTS:
${pendingSummary || 'None'}
`;

  const useModel = model || OLLAMA_TEXT_MODEL;

  const modeInstructions: Record<string, string> = {
    analyze: 'Analyze the current state of this grow based on the data provided. Identify trends, concerns, and recommendations.',
    generate: 'Generate helpful content for the lab notebook. This could be protocol suggestions, observation templates, or analysis notes.',
    chat: 'Answer the user\'s question about this grow using the context provided. Be specific and reference actual data when possible.',
  };

  const fullPrompt = `${systemContext}\n\n${modeInstructions[mode] || modeInstructions.chat}\n\nUser: ${prompt}`;

  try {
    const start = Date.now();
    const ollamaResp = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: useModel, prompt: fullPrompt, stream: false }),
    });

    if (!ollamaResp.ok) {
      const errText = await ollamaResp.text();
      res.status(502).json({ error: `Ollama error: ${ollamaResp.status}`, detail: errText });
      return;
    }

    const result = await ollamaResp.json() as { response: string; total_duration?: number };
    res.json({
      response: result.response,
      model: useModel,
      duration_ms: Date.now() - start,
      context: {
        day: daysSinceStart,
        phase: currentPhase?.name || null,
        sensor_count: sensors.length,
        completed_timepoints: completedTps.length,
        pending_timepoints: pendingTps.length,
      },
    });
  } catch (err: any) {
    console.error('[AI] Notebook error:', err);
    res.status(502).json({ error: `Failed to reach Ollama: ${err.message}` });
  }
});

export default router;
