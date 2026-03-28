import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';
import { VAPID_PUBLIC_KEY } from '../push';

const router = Router();

router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post('/register', (req: Request, res: Response) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) {
    res.status(400).json({ error: 'Invalid push subscription' });
    return;
  }

  const db = getDb();
  const subJson = JSON.stringify(subscription);

  const existing = db.prepare('SELECT id FROM push_tokens WHERE token = ?').get(subscription.endpoint);
  if (existing) {
    db.prepare('UPDATE push_tokens SET subscription = ? WHERE token = ?').run(subJson, subscription.endpoint);
  } else {
    db.prepare(`
      INSERT INTO push_tokens (id, token, platform, subscription)
      VALUES (?, ?, 'web', ?)
    `).run(uuid(), subscription.endpoint, subJson);
  }

  res.json({ ok: true });
});

router.delete('/unregister', (req: Request, res: Response) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint required' });
    return;
  }

  const db = getDb();
  db.prepare('DELETE FROM push_tokens WHERE token = ?').run(endpoint);
  res.json({ ok: true });
});

export default router;
