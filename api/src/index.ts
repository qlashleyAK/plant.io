import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getDb } from './database';
import { initMqtt, rebuildTopicMap, getMqttClient } from './mqtt';
import { ensureBucket } from './s3';
import { startTimepointChecker } from './automations';
import authRouter, { COOKIE_NAME, verifyToken } from './routes/auth';
import sensorsRouter from './routes/sensors';
import growsRouter from './routes/grows';
import timepointsRouter from './routes/timepoints';
import mediaRouter from './routes/media';
import camerasRouter from './routes/cameras';
import exportsRouter from './routes/exports';
import automationsRouter from './routes/automations';
import notificationsRouter from './routes/notifications';
import aiRouter from './routes/ai';
import schedulesRouter from './routes/schedules';
import { startScheduler } from './scheduler';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  getDb();
  console.log('[DB] Database initialized');

  rebuildTopicMap();

  try {
    await ensureBucket();
    console.log('[S3] Bucket ready');
  } catch (err) {
    console.warn('[S3] Initial bucket check failed, will retry:', (err as Error).message);
  }

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Auth routes (unprotected)
  app.use('/api/auth', authRouter);

  // Auth middleware for all other /api routes
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth')) return next();
    const token = req.cookies?.[COOKIE_NAME];
    if (token && verifyToken(token)) return next();
    res.status(401).json({ error: 'Not authenticated' });
  });

  app.use('/api/sensors', sensorsRouter);
  app.use('/api/grows', growsRouter);
  app.use('/api/timepoints', timepointsRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/cameras', camerasRouter);
  app.use('/api/exports', exportsRouter);
  app.use('/api/automations', automationsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/schedules', schedulesRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/actuators/:id/command', (req, res) => {
    const db = getDb();
    const actuator = db.prepare('SELECT * FROM sensors WHERE id = ? AND type = ?').get(req.params.id, 'actuator') as any;
    if (!actuator) { res.status(404).json({ error: 'Actuator not found' }); return; }
    if (!actuator.command_topic) { res.status(400).json({ error: 'No command topic configured' }); return; }

    const { state } = req.body;
    const payload = state ? 'ON' : 'OFF';

    const mqttClient = getMqttClient();
    if (!mqttClient?.connected) { res.status(503).json({ error: 'MQTT not connected' }); return; }

    mqttClient.publish(actuator.command_topic, payload, { qos: 1 }, (err) => {
      if (err) { res.status(500).json({ error: 'Failed to publish command' }); return; }
      res.json({ ok: true, actuator: actuator.id, command_topic: actuator.command_topic, payload });
    });
  });

  app.get('/api/analytics/grow/:growId', (req, res) => {
    const db = getDb();
    const grow = db.prepare('SELECT * FROM grows WHERE id = ?').get(req.params.growId) as any;
    if (!grow) {
      res.status(404).json({ error: 'Grow not found' });
      return;
    }

    const sensorIds = req.query.sensors
      ? (req.query.sensors as string).split(',')
      : db.prepare('SELECT id FROM sensors').all().map((s: any) => s.id);

    const resolution = (req.query.resolution as string) || 'hour';
    const groupFn = resolution === 'minute'
      ? "strftime('%Y-%m-%dT%H:%M:00', timestamp)"
      : resolution === 'day'
        ? "strftime('%Y-%m-%dT00:00:00', timestamp)"
        : "strftime('%Y-%m-%dT%H:00:00', timestamp)";

    const placeholders = sensorIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT sensor_id, AVG(value) as value, MIN(value) as value_min, MAX(value) as value_max,
        ${groupFn} as timestamp
      FROM telemetry
      WHERE sensor_id IN (${placeholders})
        AND timestamp >= ? AND timestamp <= COALESCE(?, datetime('now'))
      GROUP BY sensor_id, ${groupFn}
      ORDER BY timestamp ASC
    `).all(...sensorIds, grow.start_date, grow.end_date);

    const timepoints = db.prepare(
      'SELECT * FROM timepoints WHERE grow_id = ? ORDER BY scheduled_at'
    ).all(req.params.growId);

    const media = db.prepare(
      'SELECT id, camera_id, source, s3_key, original_name, mime_type, captured_at FROM media WHERE grow_id = ? ORDER BY captured_at'
    ).all(req.params.growId);

    res.json({ grow, telemetry: rows, timepoints, media });
  });

  app.get('/api/analytics/history', (req, res) => {
    const db = getDb();
    const { sensors, from, to, resolution = 'hour' } = req.query;

    const sensorIds = sensors
      ? (sensors as string).split(',')
      : db.prepare('SELECT id FROM sensors').all().map((s: any) => s.id);

    if (sensorIds.length === 0) {
      res.json({ telemetry: [] });
      return;
    }

    const normTs = (ts: string) => ts.replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
    const normFrom = from ? normTs(from as string) : null;
    const normTo = to ? normTs(to as string) : null;

    const groupFn = resolution === 'minute'
      ? "strftime('%Y-%m-%dT%H:%M:00', timestamp)"
      : resolution === 'day'
        ? "strftime('%Y-%m-%dT00:00:00', timestamp)"
        : "strftime('%Y-%m-%dT%H:00:00', timestamp)";

    const placeholders = sensorIds.map(() => '?').join(',');
    const params: any[] = [...sensorIds];
    let whereTime = '';
    if (normFrom) { whereTime += ' AND timestamp >= ?'; params.push(normFrom); }
    if (normTo) { whereTime += ' AND timestamp <= ?'; params.push(normTo); }

    const rows = db.prepare(`
      SELECT sensor_id, AVG(value) as value, MIN(value) as value_min, MAX(value) as value_max,
        ${groupFn} as timestamp
      FROM telemetry
      WHERE sensor_id IN (${placeholders}) ${whereTime}
      GROUP BY sensor_id, ${groupFn}
      ORDER BY timestamp ASC
    `).all(...params);

    const sensorMeta = db.prepare(`
      SELECT id, name, unit, type FROM sensors WHERE id IN (${placeholders})
    `).all(...sensorIds);

    res.json({ telemetry: rows, sensors: sensorMeta });
  });

  try {
    await initMqtt();
    console.log('[MQTT] Subscriber active');
  } catch (err) {
    console.warn('[MQTT] Initial connection failed, will retry:', (err as Error).message);
  }

  startTimepointChecker();
  console.log('[TP-CHECK] Timepoint checker started');

  startScheduler();
  console.log('[Scheduler] Actuator scheduler started');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] plant.io API listening on port ${PORT}`);
  });
}

main().catch(console.error);
