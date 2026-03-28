import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { getDb } from './database';

const expo = new Expo();

export async function sendPushNotifications(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const db = getDb();
  const tokens = db.prepare('SELECT token FROM push_tokens').all() as { token: string }[];

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = [];
  for (const { token } of tokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`[PUSH] Invalid token removed: ${token}`);
      db.prepare('DELETE FROM push_tokens WHERE token = ?').run(token);
      continue;
    }
    messages.push({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (const receipt of receipts) {
        if (receipt.status === 'error') {
          console.error('[PUSH] Send error:', receipt.message);
        }
      }
    } catch (err) {
      console.error('[PUSH] Chunk send failed:', err);
    }
  }
}
