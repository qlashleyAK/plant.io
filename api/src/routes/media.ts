import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { uploadToS3, getPresignedUrl, deleteFromS3, getS3Object, S3_BUCKET } from '../s3';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const router = Router();

function s3Key(filename: string): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  return `media/${ymd}/${filename}`;
}

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { grow_id, timepoint_id, camera_id, source, from, to, limit = '200' } = req.query;

  let query = 'SELECT * FROM media WHERE 1=1';
  const params: any[] = [];

  if (grow_id) { query += ' AND grow_id = ?'; params.push(grow_id); }
  if (timepoint_id) { query += ' AND timepoint_id = ?'; params.push(timepoint_id); }
  if (camera_id) { query += ' AND camera_id = ?'; params.push(camera_id); }
  if (source) { query += ' AND source = ?'; params.push(source); }
  if (from) { query += ' AND captured_at >= ?'; params.push(from); }
  if (to) { query += ' AND captured_at <= ?'; params.push(to); }

  query += ' ORDER BY captured_at DESC LIMIT ?';
  params.push(parseInt(limit as string, 10));

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

router.post('/upload', upload.array('files', 20), async (req: Request, res: Response) => {
  const db = getDb();
  const files = req.files as Express.Multer.File[];
  const { grow_id, timepoint_id, camera_id, source, caption, tags } = req.body;

  const results = [];
  for (const file of files) {
    const id = uuid();
    const ext = path.extname(file.originalname);
    const filename = `${id}${ext}`;
    const key = s3Key(filename);

    await uploadToS3(key, file.buffer, file.mimetype);

    db.prepare(`
      INSERT INTO media (id, grow_id, timepoint_id, camera_id, source, s3_key, s3_bucket, original_name, mime_type, size, caption, tags, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      grow_id || null,
      timepoint_id || null,
      camera_id || null,
      source || 'manual',
      key,
      S3_BUCKET,
      file.originalname,
      file.mimetype,
      file.size,
      caption || null,
      tags || null,
    );

    results.push(db.prepare('SELECT * FROM media WHERE id = ?').get(id));
  }

  res.status(201).json(results);
});

router.get('/:id/url', async (req: Request, res: Response) => {
  const db = getDb();
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id) as any;
  if (!media) {
    res.status(404).json({ error: 'Media not found' });
    return;
  }
  const url = await getPresignedUrl(media.s3_key);
  res.json({ url });
});

router.get('/:id/file', async (req: Request, res: Response) => {
  const db = getDb();
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id) as any;
  if (!media) {
    res.status(404).json({ error: 'Media not found' });
    return;
  }

  try {
    const s3Response = await getS3Object(media.s3_key);
    res.setHeader('Content-Type', media.mime_type);
    if (s3Response.ContentLength) {
      res.setHeader('Content-Length', s3Response.ContentLength);
    }
    const stream = s3Response.Body as any;
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id) as any;
  if (media) {
    try { await deleteFromS3(media.s3_key); } catch {}
  }
  db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
