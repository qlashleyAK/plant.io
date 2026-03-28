import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

const ACCESS_KEY = process.env.ACCESS_KEY || 'REDACTED_ACCESS_KEY';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'pio_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signToken(payload: string): string {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(payload);
  return `${payload}.${hmac.digest('hex')}`;
}

function verifyToken(token: string): boolean {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const expected = signToken(payload);
  if (token !== expected) return false;
  const ts = parseInt(payload, 10);
  return Date.now() - ts < MAX_AGE_MS;
}

router.post('/login', (req: Request, res: Response) => {
  const { key } = req.body;
  if (key !== ACCESS_KEY) {
    res.status(401).json({ error: 'Invalid access key' });
    return;
  }

  const token = signToken(String(Date.now()));
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
  res.json({ ok: true, token });
});

router.get('/verify', (req: Request, res: Response) => {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken && verifyToken(cookieToken)) {
    res.status(200).json({ ok: true });
    return;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7);
    if (verifyToken(bearerToken)) {
      res.status(200).json({ ok: true });
      return;
    }
  }
  res.status(401).json({ error: 'Not authenticated' });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

export { COOKIE_NAME, verifyToken };
export default router;
