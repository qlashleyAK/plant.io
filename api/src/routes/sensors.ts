import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const sensors = db.prepare(`
    SELECT s.*, 
      (SELECT value FROM telemetry WHERE sensor_id = s.id ORDER BY timestamp DESC LIMIT 1) as last_value,
      (SELECT value_text FROM telemetry WHERE sensor_id = s.id ORDER BY timestamp DESC LIMIT 1) as last_value_text,
      (SELECT timestamp FROM telemetry WHERE sensor_id = s.id ORDER BY timestamp DESC LIMIT 1) as last_reading
    FROM sensors s
    ORDER BY s.type, s.name
  `).all();

  const parsed = sensors.map((s: any) => ({
    ...s,
    gauge_config: s.gauge_config ? JSON.parse(s.gauge_config) : null,
  }));

  res.json(parsed);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id) as any;
  if (!sensor) {
    res.status(404).json({ error: 'Sensor not found' });
    return;
  }
  sensor.gauge_config = sensor.gauge_config ? JSON.parse(sensor.gauge_config) : null;
  res.json(sensor);
});

router.get('/:id/telemetry', (req: Request, res: Response) => {
  const db = getDb();
  const { from, to, limit = '1000', resolution } = req.query;

  // Normalize ISO timestamps (strip trailing Z, replace T with space) to match SQLite's datetime() format
  const normTs = (ts: string) => ts.replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
  const normFrom = from ? normTs(from as string) : null;
  const normTo = to ? normTs(to as string) : null;

  const params: any[] = [req.params.id];
  if (normFrom) params.push(normFrom);
  if (normTo) params.push(normTo);

  const whereFrom = normFrom ? ' AND timestamp >= ?' : '';
  const whereTo = normTo ? ' AND timestamp <= ?' : '';

  let query: string;

  if (resolution === 'minute') {
    query = `
      SELECT AVG(value) as value,
        strftime('%Y-%m-%dT%H:%M:00', timestamp) as timestamp
      FROM telemetry WHERE sensor_id = ? ${whereFrom} ${whereTo}
      GROUP BY strftime('%Y-%m-%dT%H:%M', timestamp)
      ORDER BY timestamp ASC LIMIT ?
    `;
  } else if (resolution === 'hour') {
    query = `
      SELECT AVG(value) as value, MIN(value) as value_min, MAX(value) as value_max,
        strftime('%Y-%m-%dT%H:00:00', timestamp) as timestamp
      FROM telemetry WHERE sensor_id = ? ${whereFrom} ${whereTo}
      GROUP BY strftime('%Y-%m-%dT%H', timestamp)
      ORDER BY timestamp ASC LIMIT ?
    `;
  } else if (resolution === 'day') {
    query = `
      SELECT AVG(value) as value, MIN(value) as value_min, MAX(value) as value_max,
        strftime('%Y-%m-%dT00:00:00', timestamp) as timestamp
      FROM telemetry WHERE sensor_id = ? ${whereFrom} ${whereTo}
      GROUP BY strftime('%Y-%m-%d', timestamp)
      ORDER BY timestamp ASC LIMIT ?
    `;
  } else {
    query = `
      SELECT value, value_text, timestamp
      FROM telemetry WHERE sensor_id = ? ${whereFrom} ${whereTo}
      ORDER BY timestamp ASC LIMIT ?
    `;
  }

  params.push(parseInt(limit as string, 10));
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

export default router;
