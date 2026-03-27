import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.*, s.name as sensor_name, s.unit as sensor_unit
    FROM automations a
    JOIN sensors s ON a.sensor_id = s.id
    ORDER BY a.created_at DESC
  `).all();
  res.json(rows);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT a.*, s.name as sensor_name, s.unit as sensor_unit
    FROM automations a
    JOIN sensors s ON a.sensor_id = s.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Automation not found' });
    return;
  }
  res.json(row);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, sensor_id, operator, threshold, sustained_seconds, cooldown_seconds, actions, enabled } = req.body;
  const id = uuid();

  db.prepare(`
    INSERT INTO automations (id, name, sensor_id, operator, threshold, sustained_seconds, cooldown_seconds, actions, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, sensor_id, operator, threshold,
    sustained_seconds || 0, cooldown_seconds || 300,
    JSON.stringify(actions || []), enabled ?? 1,
  );

  const row = db.prepare(`
    SELECT a.*, s.name as sensor_name, s.unit as sensor_unit
    FROM automations a JOIN sensors s ON a.sensor_id = s.id WHERE a.id = ?
  `).get(id);
  res.status(201).json(row);
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, sensor_id, operator, threshold, sustained_seconds, cooldown_seconds, actions, enabled } = req.body;

  db.prepare(`
    UPDATE automations SET name = ?, sensor_id = ?, operator = ?, threshold = ?,
      sustained_seconds = ?, cooldown_seconds = ?, actions = ?, enabled = ?
    WHERE id = ?
  `).run(
    name, sensor_id, operator, threshold,
    sustained_seconds || 0, cooldown_seconds || 300,
    JSON.stringify(actions || []), enabled ?? 1,
    req.params.id,
  );

  const row = db.prepare(`
    SELECT a.*, s.name as sensor_name, s.unit as sensor_unit
    FROM automations a JOIN sensors s ON a.sensor_id = s.id WHERE a.id = ?
  `).get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM automations WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
