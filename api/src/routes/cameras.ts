import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const cameras = db.prepare('SELECT * FROM cameras ORDER BY created_at DESC').all();
  res.json(cameras);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, type, url, device_index, resolution_w, resolution_h } = req.body;
  const id = uuid();

  db.prepare(`
    INSERT INTO cameras (id, name, type, url, device_index, resolution_w, resolution_h)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, url || null, device_index ?? null, resolution_w || 1920, resolution_h || 1080);

  const camera = db.prepare('SELECT * FROM cameras WHERE id = ?').get(id);
  res.status(201).json(camera);
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, type, url, device_index, resolution_w, resolution_h, enabled } = req.body;

  db.prepare(`
    UPDATE cameras SET name = ?, type = ?, url = ?, device_index = ?,
      resolution_w = ?, resolution_h = ?, enabled = ?
    WHERE id = ?
  `).run(name, type, url || null, device_index ?? null, resolution_w || 1920, resolution_h || 1080, enabled ?? 1, req.params.id);

  const camera = db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id);
  res.json(camera);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM cameras WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

router.get('/:id/schedules', (req: Request, res: Response) => {
  const db = getDb();
  const schedules = db.prepare(
    'SELECT * FROM capture_schedules WHERE camera_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(schedules);
});

router.post('/:id/schedules', (req: Request, res: Response) => {
  const db = getDb();
  const { grow_id, interval_seconds, enabled } = req.body;
  const id = uuid();

  const nextCapture = new Date(Date.now() + (interval_seconds || 3600) * 1000).toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');

  db.prepare(`
    INSERT INTO capture_schedules (id, camera_id, grow_id, interval_seconds, enabled, next_capture_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, grow_id || null, interval_seconds || 3600, enabled ?? 1, nextCapture);

  const schedule = db.prepare('SELECT * FROM capture_schedules WHERE id = ?').get(id);
  res.status(201).json(schedule);
});

router.put('/schedules/:scheduleId', (req: Request, res: Response) => {
  const db = getDb();
  const { interval_seconds, enabled, grow_id } = req.body;

  db.prepare(`
    UPDATE capture_schedules SET interval_seconds = ?, enabled = ?, grow_id = ? WHERE id = ?
  `).run(interval_seconds, enabled ?? 1, grow_id || null, req.params.scheduleId);

  const schedule = db.prepare('SELECT * FROM capture_schedules WHERE id = ?').get(req.params.scheduleId);
  res.json(schedule);
});

router.delete('/schedules/:scheduleId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM capture_schedules WHERE id = ?').run(req.params.scheduleId);
  res.status(204).send();
});

export default router;
