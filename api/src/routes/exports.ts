import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';
import { uploadToS3, getPresignedUrl, S3_BUCKET } from '../s3';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const jobs = db.prepare('SELECT * FROM export_jobs ORDER BY created_at DESC LIMIT 50').all();
  res.json(jobs);
});

router.post('/', async (req: Request, res: Response) => {
  const db = getDb();
  const { type, grow_id, params: exportParams } = req.body;
  const id = uuid();

  db.prepare(`
    INSERT INTO export_jobs (id, type, grow_id, params, status, started_at)
    VALUES (?, ?, ?, ?, 'running', datetime('now'))
  `).run(id, type, grow_id || null, JSON.stringify(exportParams || {}));

  try {
    let csv = '';
    let rowCount = 0;

    if (type === 'telemetry_csv') {
      const p = exportParams || {};
      const sensorIds: string[] = p.sensor_ids || db.prepare('SELECT id FROM sensors').all().map((s: any) => s.id);
      const placeholders = sensorIds.map(() => '?').join(',');

      let query = `
        SELECT t.sensor_id, s.name as sensor_name, s.unit, t.value, t.value_text, t.timestamp
        FROM telemetry t JOIN sensors s ON t.sensor_id = s.id
        WHERE t.sensor_id IN (${placeholders})
      `;
      const queryParams: any[] = [...sensorIds];

      if (p.from) { query += ' AND t.timestamp >= ?'; queryParams.push(p.from); }
      if (p.to) { query += ' AND t.timestamp <= ?'; queryParams.push(p.to); }
      if (grow_id) {
        const grow = db.prepare('SELECT start_date, end_date FROM grows WHERE id = ?').get(grow_id) as any;
        if (grow) {
          query += ' AND t.timestamp >= ?';
          queryParams.push(grow.start_date);
          if (grow.end_date) { query += ' AND t.timestamp <= ?'; queryParams.push(grow.end_date); }
        }
      }

      query += ' ORDER BY t.timestamp ASC';
      const rows = db.prepare(query).all(...queryParams) as any[];
      rowCount = rows.length;

      csv = 'sensor_id,sensor_name,unit,value,value_text,timestamp\n';
      for (const r of rows) {
        csv += `${esc(r.sensor_id)},${esc(r.sensor_name)},${esc(r.unit)},${r.value ?? ''},${esc(r.value_text || '')},${r.timestamp}\n`;
      }
    } else if (type === 'full_dataset') {
      csv = 'record_type,id,sensor_id,sensor_name,unit,value,value_text,field_name,field_type,timestamp\n';
      let query = 'SELECT t.sensor_id, s.name as sensor_name, s.unit, t.value, t.value_text, t.timestamp FROM telemetry t JOIN sensors s ON t.sensor_id = s.id';
      const queryParams: any[] = [];

      if (grow_id) {
        const grow = db.prepare('SELECT start_date, end_date FROM grows WHERE id = ?').get(grow_id) as any;
        if (grow) {
          query += ' WHERE t.timestamp >= ?';
          queryParams.push(grow.start_date);
          if (grow.end_date) { query += ' AND t.timestamp <= ?'; queryParams.push(grow.end_date); }
        }
      }
      query += ' ORDER BY t.timestamp ASC';
      const telemetryRows = db.prepare(query).all(...queryParams) as any[];

      for (const r of telemetryRows) {
        csv += `telemetry,,${esc(r.sensor_id)},${esc(r.sensor_name)},${esc(r.unit)},${r.value ?? ''},${esc(r.value_text || '')},,${r.timestamp}\n`;
      }

      let tpQuery = `
        SELECT td.*, tp.grow_id, tp.scheduled_at
        FROM timepoint_data td JOIN timepoints tp ON td.timepoint_id = tp.id
      `;
      const tpParams: any[] = [];
      if (grow_id) { tpQuery += ' WHERE tp.grow_id = ?'; tpParams.push(grow_id); }
      tpQuery += ' ORDER BY tp.scheduled_at ASC';

      const tpRows = db.prepare(tpQuery).all(...tpParams) as any[];
      for (const r of tpRows) {
        csv += `timepoint,${r.timepoint_id},,,,${r.value_number ?? ''},${esc(r.value_text || '')},${esc(r.field_name)},${r.field_type},${r.scheduled_at}\n`;
      }

      rowCount = telemetryRows.length + tpRows.length;
    } else if (type === 'media_manifest') {
      csv = 'media_id,grow_id,camera_id,source,s3_key,s3_bucket,original_name,mime_type,width,height,captured_at\n';
      let mQuery = 'SELECT * FROM media';
      const mParams: any[] = [];
      if (grow_id) { mQuery += ' WHERE grow_id = ?'; mParams.push(grow_id); }
      mQuery += ' ORDER BY captured_at ASC';

      const mediaRows = db.prepare(mQuery).all(...mParams) as any[];
      rowCount = mediaRows.length;
      for (const r of mediaRows) {
        csv += `${r.id},${r.grow_id || ''},${r.camera_id || ''},${r.source},${r.s3_key},${r.s3_bucket},${esc(r.original_name)},${r.mime_type},${r.width || ''},${r.height || ''},${r.captured_at}\n`;
      }
    }

    const s3Key = `exports/${id}.csv`;
    await uploadToS3(s3Key, Buffer.from(csv, 'utf-8'), 'text/csv');

    db.prepare(`
      UPDATE export_jobs SET status = 'completed', s3_key = ?, row_count = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(s3Key, rowCount, id);

    const job = db.prepare('SELECT * FROM export_jobs WHERE id = ?').get(id);
    res.status(201).json(job);
  } catch (err: any) {
    db.prepare(`
      UPDATE export_jobs SET status = 'failed', error = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(err.message, id);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/download', async (req: Request, res: Response) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM export_jobs WHERE id = ?').get(req.params.id) as any;
  if (!job || !job.s3_key) {
    res.status(404).json({ error: 'Export not found' });
    return;
  }
  const url = await getPresignedUrl(job.s3_key);
  res.json({ url });
});

function esc(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export default router;
