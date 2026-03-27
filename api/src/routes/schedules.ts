import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { reloadSchedules } from '../scheduler';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { actuator_id } = req.query;

  let sql = `
    SELECT s.*, sen.name as actuator_name, g.name as grow_name, p.name as phase_name
    FROM actuator_schedules s
    JOIN sensors sen ON sen.id = s.actuator_id
    LEFT JOIN grows g ON g.id = s.grow_id
    LEFT JOIN protocol_phases p ON p.id = s.phase_id
  `;
  const params: any[] = [];

  if (actuator_id) {
    sql += ' WHERE s.actuator_id = ?';
    params.push(actuator_id);
  }

  sql += ' ORDER BY s.actuator_id, s.priority DESC, s.created_at';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT s.*, sen.name as actuator_name
    FROM actuator_schedules s
    JOIN sensors sen ON sen.id = s.actuator_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!row) { res.status(404).json({ error: 'Schedule not found' }); return; }
  res.json(row);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const {
    actuator_id, name, enabled = 1, mode = 'duty_cycle',
    interval_seconds = 30, on_seconds = 5,
    grow_id = null, phase_id = null, priority = 0,
  } = req.body;

  if (!actuator_id || !name) {
    res.status(400).json({ error: 'actuator_id and name are required' });
    return;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO actuator_schedules (id, actuator_id, name, enabled, mode, interval_seconds, on_seconds, grow_id, phase_id, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, actuator_id, name, enabled ? 1 : 0, mode, interval_seconds, on_seconds, grow_id, phase_id, priority);

  reloadSchedules();
  res.json(db.prepare('SELECT * FROM actuator_schedules WHERE id = ?').get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM actuator_schedules WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Schedule not found' }); return; }

  const {
    name, enabled, mode, interval_seconds, on_seconds,
    grow_id, phase_id, priority,
  } = req.body;

  db.prepare(`
    UPDATE actuator_schedules SET
      name = COALESCE(?, name),
      enabled = COALESCE(?, enabled),
      mode = COALESCE(?, mode),
      interval_seconds = COALESCE(?, interval_seconds),
      on_seconds = COALESCE(?, on_seconds),
      grow_id = ?,
      phase_id = ?,
      priority = COALESCE(?, priority),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null, enabled !== undefined ? (enabled ? 1 : 0) : null,
    mode ?? null, interval_seconds ?? null, on_seconds ?? null,
    grow_id !== undefined ? grow_id : (existing as any).grow_id,
    phase_id !== undefined ? phase_id : (existing as any).phase_id,
    priority ?? null, req.params.id,
  );

  reloadSchedules();
  res.json(db.prepare('SELECT * FROM actuator_schedules WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM actuator_schedules WHERE id = ?').run(req.params.id);
  reloadSchedules();
  res.status(204).send();
});

router.post('/:id/toggle', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT enabled FROM actuator_schedules WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Schedule not found' }); return; }

  const newEnabled = row.enabled ? 0 : 1;
  db.prepare('UPDATE actuator_schedules SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newEnabled, req.params.id);

  reloadSchedules();
  res.json({ id: req.params.id, enabled: newEnabled });
});

export default router;
