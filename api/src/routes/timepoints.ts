import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { grow_id, phase_id, status, from, to } = req.query;

  let query = 'SELECT t.*, g.name as grow_name FROM timepoints t LEFT JOIN grows g ON g.id = t.grow_id WHERE 1=1';
  const params: any[] = [];

  if (grow_id) { query += ' AND t.grow_id = ?'; params.push(grow_id); }
  if (phase_id) { query += ' AND t.phase_id = ?'; params.push(phase_id); }
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (from) { query += ' AND t.scheduled_at >= ?'; params.push(from); }
  if (to) { query += ' AND t.scheduled_at <= ?'; params.push(to); }

  query += ' ORDER BY t.scheduled_at ASC';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const { grow_id, phase_id, template_id, scheduled_at, title, description, type, required_checks } = req.body;

  db.prepare(`
    INSERT INTO timepoints (id, grow_id, phase_id, template_id, scheduled_at, title, description, type, required_checks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, grow_id, phase_id || null, template_id || null,
    scheduled_at, title, description || null, type || 'observation',
    JSON.stringify(required_checks || []),
  );

  const tp = db.prepare('SELECT * FROM timepoints WHERE id = ?').get(id);
  res.status(201).json(tp);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const tp = db.prepare('SELECT * FROM timepoints WHERE id = ?').get(req.params.id);
  if (!tp) {
    res.status(404).json({ error: 'Timepoint not found' });
    return;
  }

  const data = db.prepare('SELECT * FROM timepoint_data WHERE timepoint_id = ?').all(req.params.id);
  const media = db.prepare('SELECT * FROM media WHERE timepoint_id = ?').all(req.params.id);

  res.json({ ...(tp as object), data, media });
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { scheduled_at, title, description, type, status, required_checks } = req.body;
  const completed_at = status === 'completed' ? new Date().toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '') : null;

  db.prepare(`
    UPDATE timepoints SET scheduled_at = ?, title = ?, description = ?,
      type = ?, status = ?, required_checks = COALESCE(?, required_checks),
      completed_at = COALESCE(?, completed_at)
    WHERE id = ?
  `).run(
    scheduled_at, title, description, type, status,
    required_checks ? JSON.stringify(required_checks) : null,
    completed_at, req.params.id,
  );

  const tp = db.prepare('SELECT * FROM timepoints WHERE id = ?').get(req.params.id);
  res.json(tp);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM timepoints WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

router.post('/:id/data', (req: Request, res: Response) => {
  const db = getDb();
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.prepare(`
    INSERT INTO timepoint_data (id, timepoint_id, field_name, field_type, value_text, value_number, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const results = db.transaction(() => {
    return entries.map((entry: any) => {
      const id = uuid();
      insert.run(
        id, req.params.id, entry.field_name, entry.field_type || 'text',
        entry.value_text || null, entry.value_number ?? null, entry.unit || null
      );
      return db.prepare('SELECT * FROM timepoint_data WHERE id = ?').get(id);
    });
  })();

  res.status(201).json(results);
});

export default router;
