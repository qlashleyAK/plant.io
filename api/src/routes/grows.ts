import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const grows = db.prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM timepoints WHERE grow_id = g.id) as timepoint_count,
      (SELECT COUNT(*) FROM timepoints WHERE grow_id = g.id AND status = 'completed') as completed_timepoints,
      (SELECT COUNT(*) FROM protocol_phases WHERE grow_id = g.id) as phase_count
    FROM grows g ORDER BY g.created_at DESC
  `).all();
  res.json(grows);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const { name, description, strain, grow_medium, start_date, status } = req.body;

  db.prepare(`
    INSERT INTO grows (id, name, description, strain, grow_medium, start_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, strain || null, grow_medium || 'aeroponic', start_date, status || 'active');

  const grow = db.prepare('SELECT * FROM grows WHERE id = ?').get(id);
  res.status(201).json(grow);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const grow = db.prepare('SELECT * FROM grows WHERE id = ?').get(req.params.id);
  if (!grow) {
    res.status(404).json({ error: 'Grow not found' });
    return;
  }

  const phases = db.prepare(
    'SELECT * FROM protocol_phases WHERE grow_id = ? ORDER BY order_index'
  ).all(req.params.id);

  const templates = db.prepare(`
    SELECT tt.* FROM timepoint_templates tt
    JOIN protocol_phases pp ON tt.phase_id = pp.id
    WHERE pp.grow_id = ? ORDER BY pp.order_index, tt.order_index
  `).all(req.params.id);

  const timepoints = db.prepare(
    'SELECT * FROM timepoints WHERE grow_id = ? ORDER BY scheduled_at'
  ).all(req.params.id);

  const media = db.prepare(
    'SELECT * FROM media WHERE grow_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  res.json({ ...(grow as object), phases, templates, timepoints, media });
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, description, strain, grow_medium, start_date, end_date, status } = req.body;

  db.prepare(`
    UPDATE grows SET name = ?, description = ?, strain = ?, grow_medium = ?,
      start_date = ?, end_date = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, description, strain, grow_medium, start_date, end_date, status, req.params.id);

  const grow = db.prepare('SELECT * FROM grows WHERE id = ?').get(req.params.id);
  res.json(grow);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM grows WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// --- Protocol Phases ---

router.post('/:id/phases', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const { name, description, order_index, start_day, end_day, target_values, check_cadence_hours, check_times } = req.body;

  db.prepare(`
    INSERT INTO protocol_phases (id, grow_id, name, description, order_index, start_day, end_day, target_values, check_cadence_hours, check_times)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, name, description, order_index || 0, start_day, end_day,
    target_values ? JSON.stringify(target_values) : null,
    check_cadence_hours ?? 24,
    JSON.stringify(check_times || ['09:00']),
  );

  const phase = db.prepare('SELECT * FROM protocol_phases WHERE id = ?').get(id);
  res.status(201).json(phase);
});

router.put('/:growId/phases/:phaseId', (req: Request, res: Response) => {
  const db = getDb();
  const { name, description, order_index, start_day, end_day, target_values, check_cadence_hours, check_times } = req.body;

  db.prepare(`
    UPDATE protocol_phases SET name = ?, description = ?, order_index = ?,
      start_day = ?, end_day = ?, target_values = ?, check_cadence_hours = ?, check_times = ?
    WHERE id = ? AND grow_id = ?
  `).run(
    name, description, order_index, start_day, end_day,
    target_values ? JSON.stringify(target_values) : null,
    check_cadence_hours ?? 24,
    JSON.stringify(check_times || ['09:00']),
    req.params.phaseId, req.params.growId,
  );

  const phase = db.prepare('SELECT * FROM protocol_phases WHERE id = ?').get(req.params.phaseId);
  res.json(phase);
});

router.delete('/:growId/phases/:phaseId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM protocol_phases WHERE id = ? AND grow_id = ?').run(req.params.phaseId, req.params.growId);
  res.status(204).send();
});

// --- Timepoint Templates ---

router.get('/:growId/phases/:phaseId/templates', (req: Request, res: Response) => {
  const db = getDb();
  const templates = db.prepare(
    'SELECT * FROM timepoint_templates WHERE phase_id = ? ORDER BY order_index'
  ).all(req.params.phaseId);
  res.json(templates);
});

router.post('/:growId/phases/:phaseId/templates', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const { title, type, description, required_checks, order_index } = req.body;

  db.prepare(`
    INSERT INTO timepoint_templates (id, phase_id, title, type, description, required_checks, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.phaseId, title, type || 'observation',
    description || null, JSON.stringify(required_checks || []),
    order_index ?? 0,
  );

  const tpl = db.prepare('SELECT * FROM timepoint_templates WHERE id = ?').get(id);
  res.status(201).json(tpl);
});

router.put('/:growId/templates/:templateId', (req: Request, res: Response) => {
  const db = getDb();
  const { title, type, description, required_checks, order_index } = req.body;

  db.prepare(`
    UPDATE timepoint_templates SET title = ?, type = ?, description = ?, required_checks = ?, order_index = ?
    WHERE id = ?
  `).run(title, type, description || null, JSON.stringify(required_checks || []), order_index ?? 0, req.params.templateId);

  const tpl = db.prepare('SELECT * FROM timepoint_templates WHERE id = ?').get(req.params.templateId);
  res.json(tpl);
});

router.delete('/:growId/templates/:templateId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM timepoint_templates WHERE id = ?').run(req.params.templateId);
  res.status(204).send();
});

// --- Auto-generate Timepoints ---

router.post('/:id/generate-timepoints', (req: Request, res: Response) => {
  const db = getDb();
  const grow = db.prepare('SELECT * FROM grows WHERE id = ?').get(req.params.id) as any;
  if (!grow) { res.status(404).json({ error: 'Grow not found' }); return; }

  const { clear_pending } = req.body;
  if (clear_pending) {
    db.prepare("DELETE FROM timepoints WHERE grow_id = ? AND status IN ('pending', 'overdue')").run(req.params.id);
  }

  const phases = db.prepare(
    'SELECT * FROM protocol_phases WHERE grow_id = ? ORDER BY order_index'
  ).all(req.params.id) as any[];

  const growStart = new Date(grow.start_date);
  const insert = db.prepare(`
    INSERT INTO timepoints (id, grow_id, phase_id, template_id, scheduled_at, title, description, type, required_checks, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  let generated = 0;

  const generate = db.transaction(() => {
    for (const phase of phases) {
      const templates = db.prepare(
        'SELECT * FROM timepoint_templates WHERE phase_id = ? ORDER BY order_index'
      ).all(phase.id) as any[];

      if (templates.length === 0) continue;

      let checkTimes: string[];
      try { checkTimes = JSON.parse(phase.check_times); } catch { checkTimes = ['09:00']; }
      const endDay = phase.end_day ?? (phase.start_day + 30);

      for (let day = phase.start_day; day <= endDay; day++) {
        for (const timeStr of checkTimes) {
          const [hh, mm] = timeStr.split(':').map(Number);
          const schedDate = new Date(growStart);
          schedDate.setDate(schedDate.getDate() + day);
          schedDate.setHours(hh, mm, 0, 0);

          if (schedDate.getTime() < Date.now() - 86_400_000) continue;

          const scheduledAt = schedDate.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');

          for (const tpl of templates) {
            const id = uuid();
            insert.run(
              id, req.params.id, phase.id, tpl.id,
              scheduledAt,
              `${tpl.title} (Day ${day})`,
              tpl.description || null,
              tpl.type,
              tpl.required_checks || '[]',
            );
            generated++;
          }
        }
      }
    }
  });

  generate();

  res.json({ generated, message: `Generated ${generated} timepoints` });
});

// --- Default protocol helper ---

router.post('/:id/default-protocol', (req: Request, res: Response) => {
  const db = getDb();
  const grow = db.prepare('SELECT * FROM grows WHERE id = ?').get(req.params.id) as any;
  if (!grow) { res.status(404).json({ error: 'Grow not found' }); return; }

  const defaultChecks = [
    { field_name: 'pH', field_type: 'number', unit: 'pH' },
    { field_name: 'EC/TDS', field_type: 'number', unit: 'ppm' },
    { field_name: 'Water Temperature', field_type: 'number', unit: '°F' },
    { field_name: 'Visual Health', field_type: 'text', unit: '' },
    { field_name: 'Notes', field_type: 'text', unit: '' },
  ];

  const phases = [
    { name: 'Seedling/Clone', start_day: 0, end_day: 14, check_times: ['09:00'], desc: 'Establishment phase - gentle monitoring' },
    { name: 'Vegetative', start_day: 15, end_day: 45, check_times: ['09:00', '21:00'], desc: 'Active growth - twice daily checks' },
    { name: 'Flowering/Fruiting', start_day: 46, end_day: 90, check_times: ['09:00', '21:00'], desc: 'Production phase - watch pH closely' },
    { name: 'Late/Harvest', start_day: 91, end_day: 105, check_times: ['09:00'], desc: 'Flush and harvest prep' },
  ];

  const build = db.transaction(() => {
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      const phaseId = uuid();
      db.prepare(`
        INSERT INTO protocol_phases (id, grow_id, name, description, order_index, start_day, end_day, check_cadence_hours, check_times)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(phaseId, req.params.id, p.name, p.desc, i, p.start_day, p.end_day, 24, JSON.stringify(p.check_times));

      const dailyCheckId = uuid();
      db.prepare(`
        INSERT INTO timepoint_templates (id, phase_id, title, type, description, required_checks, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(dailyCheckId, phaseId, 'Daily Check', 'measurement', 'Routine system and plant inspection', JSON.stringify(defaultChecks), 0);

      const photoId = uuid();
      db.prepare(`
        INSERT INTO timepoint_templates (id, phase_id, title, type, description, required_checks, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(photoId, phaseId, 'Photo Documentation', 'photo', 'Take photos from consistent angles', JSON.stringify([
        { field_name: 'Photo Angle', field_type: 'text', unit: '' },
      ]), 1);
    }
  });

  build();

  const detail = db.prepare('SELECT * FROM grows WHERE id = ?').get(req.params.id);
  const allPhases = db.prepare('SELECT * FROM protocol_phases WHERE grow_id = ? ORDER BY order_index').all(req.params.id);
  const templates = db.prepare(`
    SELECT tt.* FROM timepoint_templates tt
    JOIN protocol_phases pp ON tt.phase_id = pp.id
    WHERE pp.grow_id = ? ORDER BY pp.order_index, tt.order_index
  `).all(req.params.id);

  res.status(201).json({ ...(detail as object), phases: allPhases, templates });
});

export default router;
