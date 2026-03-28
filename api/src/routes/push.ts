import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuid } from 'uuid';
import { Expo } from 'expo-server-sdk';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  const { token, platform } = req.body;
  if (!token || !Expo.isExpoPushToken(token)) {
    res.status(400).json({ error: 'Invalid Expo push token' });
    return;
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO push_tokens (id, token, platform)
    VALUES (?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET platform = excluded.platform
  `).run(uuid(), token, platform || 'android');

  res.json({ ok: true });
});

router.delete('/unregister', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Token required' });
    return;
  }

  const db = getDb();
  db.prepare('DELETE FROM push_tokens WHERE token = ?').run(token);
  res.json({ ok: true });
});

export default router;
