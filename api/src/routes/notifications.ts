import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { unread_only, limit = '50' } = req.query;

  let query = 'SELECT * FROM notifications WHERE dismissed = 0';
  if (unread_only === 'true') query += ' AND read = 0';
  query += ' ORDER BY created_at DESC LIMIT ?';

  const rows = db.prepare(query).all(parseInt(limit as string, 10));
  res.json(rows);
});

router.get('/count', (_req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE read = 0 AND dismissed = 0').get() as any;
  res.json({ count: result.count });
});

router.put('/:id/read', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/read-all', (_req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
  res.json({ ok: true });
});

router.put('/:id/dismiss', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET dismissed = 1, read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/dismiss-all', (_req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET dismissed = 1, read = 1 WHERE dismissed = 0').run();
  res.json({ ok: true });
});

export default router;
