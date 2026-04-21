import Database from 'better-sqlite3';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import mqtt from 'mqtt';
import { v4 as uuid } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const DB_PATH = process.env.DATABASE_PATH || '/app/data/plantio.db';
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'plantio';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'REDACTED_MINIO_PASSWORD';
const S3_BUCKET = process.env.S3_BUCKET || 'plantio-media';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const POLL_INTERVAL_MS = 10_000;
const TMP_DIR = '/tmp/captures';

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
});

let db: Database.Database;
let mqttClient: mqtt.MqttClient;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`[S3] Created bucket: ${S3_BUCKET}`);
  }
}

async function captureFromSource(camera: any): Promise<Buffer> {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  const tmpFile = path.join(TMP_DIR, `${uuid()}.jpg`);

  try {
    if (camera.type === 'usb') {
      const devIndex = camera.device_index ?? 0;
      await execFileAsync('ffmpeg', [
        '-y', '-f', 'v4l2', '-video_size', `${camera.resolution_w}x${camera.resolution_h}`,
        '-i', `/dev/video${devIndex}`, '-frames:v', '1', '-q:v', '2', tmpFile,
      ], { timeout: 30_000 });
    } else if (camera.type === 'rtsp') {
      await execFileAsync('ffmpeg', [
        '-y', '-rtsp_transport', 'tcp', '-i', camera.url,
        '-frames:v', '1', '-q:v', '2', tmpFile,
      ], { timeout: 30_000 });
    } else if (camera.type === 'mjpeg') {
      await execFileAsync('ffmpeg', [
        '-y', '-i', camera.url,
        '-frames:v', '1', '-q:v', '2', tmpFile,
      ], { timeout: 30_000 });
    } else if (camera.type === 'ip') {
      await execFileAsync('curl', [
        '-s', '-o', tmpFile, '-m', '15', camera.url,
      ], { timeout: 20_000 });
    } else {
      throw new Error(`Unsupported camera type: ${camera.type}`);
    }

    const buffer = fs.readFileSync(tmpFile);
    return buffer;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function processSchedule(schedule: any, camera: any): Promise<void> {
  const db = getDb();
  const captureTime = new Date().toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
  const mediaId = uuid();

  console.log(`[CAPTURE] Camera "${camera.name}" (${camera.type}) -> schedule ${schedule.id}`);

  try {
    const imageBuffer = await captureFromSource(camera);

    const s3Key = `captures/${camera.id}/${captureTime.slice(0, 10)}/${mediaId}.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    }));

    db.prepare(`
      INSERT INTO media (id, grow_id, camera_id, source, s3_key, s3_bucket, original_name, mime_type, size, captured_at)
      VALUES (?, ?, ?, 'auto_capture', ?, ?, ?, 'image/jpeg', ?, ?)
    `).run(
      mediaId,
      schedule.grow_id || null,
      camera.id,
      s3Key,
      S3_BUCKET,
      `${camera.name}_${captureTime}.jpg`,
      imageBuffer.length,
      captureTime,
    );

    const nextCapture = new Date(Date.now() + schedule.interval_seconds * 1000)
      .toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');

    db.prepare(`
      UPDATE capture_schedules SET last_capture_at = ?, next_capture_at = ? WHERE id = ?
    `).run(captureTime, nextCapture, schedule.id);

    if (mqttClient?.connected) {
      mqttClient.publish(`pio/capture/${camera.id}`, JSON.stringify({
        camera_id: camera.id,
        media_id: mediaId,
        s3_key: s3Key,
        captured_at: captureTime,
        size: imageBuffer.length,
      }));
    }

    console.log(`[CAPTURE] OK: ${s3Key} (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
  } catch (err: any) {
    console.error(`[CAPTURE] FAILED camera "${camera.name}":`, err.message);
  }
}

async function processOnDemandCapture(camera: any, growId?: string, timepointId?: string, source?: string, triggerId?: string): Promise<void> {
  const db = getDb();
  const captureTime = new Date().toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
  const mediaId = uuid();

  console.log(`[CAPTURE] On-demand: camera "${camera.name}" (${camera.type}), source=${source || 'manual'}`);

  try {
    const imageBuffer = await captureFromSource(camera);

    const s3Key = `captures/${camera.id}/${captureTime.slice(0, 10)}/${mediaId}.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    }));

    db.prepare(`
      INSERT INTO media (id, grow_id, timepoint_id, camera_id, source, s3_key, s3_bucket, original_name, mime_type, size, captured_at)
      VALUES (?, ?, ?, ?, 'auto_capture', ?, ?, ?, 'image/jpeg', ?, ?)
    `).run(
      mediaId,
      growId || null,
      timepointId || null,
      camera.id,
      s3Key,
      S3_BUCKET,
      `${camera.name}_${captureTime}.jpg`,
      imageBuffer.length,
      captureTime,
    );

    if (mqttClient?.connected) {
      mqttClient.publish(`pio/capture/${camera.id}`, JSON.stringify({
        camera_id: camera.id,
        media_id: mediaId,
        s3_key: s3Key,
        captured_at: captureTime,
        size: imageBuffer.length,
        source: source || 'manual',
        trigger_id: triggerId || null,
      }));
    }

    console.log(`[CAPTURE] On-demand OK: ${s3Key} (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
  } catch (err: any) {
    console.error(`[CAPTURE] On-demand FAILED camera "${camera.name}":`, err.message);
  }
}

async function pollSchedules(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');

  const dueSchedules = db.prepare(`
    SELECT cs.*, c.name as camera_name, c.type as camera_type, c.url as camera_url,
      c.device_index, c.resolution_w, c.resolution_h, c.enabled as camera_enabled
    FROM capture_schedules cs
    JOIN cameras c ON cs.camera_id = c.id
    WHERE cs.enabled = 1 AND c.enabled = 1
      AND (cs.next_capture_at IS NULL OR cs.next_capture_at <= ?)
  `).all(now) as any[];

  for (const sched of dueSchedules) {
    const camera = {
      id: sched.camera_id,
      name: sched.camera_name,
      type: sched.camera_type,
      url: sched.camera_url,
      device_index: sched.device_index,
      resolution_w: sched.resolution_w,
      resolution_h: sched.resolution_h,
    };

    await processSchedule(sched, camera);
  }
}

async function main(): Promise<void> {
  console.log('[CAPTURE] plant.io Capture Service starting...');

  await ensureBucket();
  console.log('[S3] Bucket ready');

  getDb();
  console.log('[DB] Connected');

  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: `pio-capture-${Date.now()}`,
    will: { topic: 'pio/status/capture', payload: Buffer.from('offline'), qos: 1, retain: true },
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected');
    mqttClient.publish('pio/status/capture', 'online', { retain: true });
    mqttClient.subscribe('pio/capture/trigger', (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err.message);
      else console.log('[MQTT] Subscribed to pio/capture/trigger');
    });
  });

  mqttClient.on('message', async (topic, payload) => {
    if (topic === 'pio/capture/trigger') {
      try {
        const msg = JSON.parse(payload.toString());
        const { camera_id, grow_id, timepoint_id, source, automation_id } = msg;
        if (!camera_id) { console.warn('[CAPTURE] Trigger missing camera_id'); return; }
        const db = getDb();
        const camera = db.prepare('SELECT * FROM cameras WHERE id = ? AND enabled = 1').get(camera_id) as any;
        if (!camera) { console.warn(`[CAPTURE] Trigger: camera ${camera_id} not found or disabled`); return; }
        await processOnDemandCapture(camera, grow_id, timepoint_id, source, automation_id || timepoint_id);
      } catch (err: any) {
        console.error('[CAPTURE] Trigger handler error:', err.message);
      }
    }
  });

  mqttClient.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  console.log(`[CAPTURE] Polling every ${POLL_INTERVAL_MS / 1000}s for due schedules`);
  setInterval(async () => {
    try {
      await pollSchedules();
    } catch (err: any) {
      console.error('[CAPTURE] Poll error:', err.message);
    }
  }, POLL_INTERVAL_MS);

  await pollSchedules();
}

main().catch(console.error);
