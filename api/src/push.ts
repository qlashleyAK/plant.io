import webpush from 'web-push';
import { getDb } from './database';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'REDACTED_VAPID_PUBLIC_KEY';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'REDACTED_VAPID_PRIVATE_KEY';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:qlashley@plantio.net';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export { VAPID_PUBLIC_KEY };

export async function sendPushNotifications(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const db = getDb();
  const subs = db.prepare('SELECT id, subscription FROM push_tokens').all() as { id: string; subscription: string }[];

  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, data: data || {} });

  for (const row of subs) {
    try {
      const subscription = JSON.parse(row.subscription);
      await webpush.sendNotification(subscription, payload);
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_tokens WHERE id = ?').run(row.id);
        console.log(`[PUSH] Removed expired subscription ${row.id}`);
      } else {
        console.error(`[PUSH] Send failed for ${row.id}:`, err.message);
      }
    }
  }
}
