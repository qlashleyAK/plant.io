import { getDb } from './database';
import { getMqttClient } from './mqtt';
import { v4 as uuid } from 'uuid';

interface AutomationRule {
  id: string;
  name: string;
  enabled: number;
  sensor_id: string;
  operator: string;
  threshold: number;
  sustained_seconds: number;
  cooldown_seconds: number;
  last_triggered_at: string | null;
  trigger_count: number;
  actions: string;
}

interface Action {
  type: 'mqtt_command' | 'notification';
  topic?: string;
  payload?: string;
  severity?: 'info' | 'warning' | 'critical';
  message?: string;
}

const sustainedState = new Map<string, number>();

function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '<': return value < threshold;
    case '<=': return value <= threshold;
    case '>': return value > threshold;
    case '>=': return value >= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default: return false;
  }
}

export function evaluateAutomations(sensorId: string, value: number): void {
  const db = getDb();

  const rules = db.prepare(`
    SELECT * FROM automations WHERE sensor_id = ? AND enabled = 1
  `).all(sensorId) as AutomationRule[];

  if (rules.length === 0) return;

  const now = Date.now();
  const nowSqlite = new Date().toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');

  for (const rule of rules) {
    const conditionMet = evaluateCondition(value, rule.operator, rule.threshold);

    if (!conditionMet) {
      sustainedState.delete(rule.id);
      continue;
    }

    if (rule.sustained_seconds > 0) {
      const firstSeen = sustainedState.get(rule.id);
      if (!firstSeen) {
        sustainedState.set(rule.id, now);
        continue;
      }
      if ((now - firstSeen) / 1000 < rule.sustained_seconds) {
        continue;
      }
    }

    if (rule.last_triggered_at) {
      const lastTriggered = new Date(rule.last_triggered_at).getTime();
      if ((now - lastTriggered) / 1000 < rule.cooldown_seconds) {
        continue;
      }
    }

    sustainedState.delete(rule.id);

    db.prepare(`
      UPDATE automations SET last_triggered_at = ?, trigger_count = trigger_count + 1 WHERE id = ?
    `).run(nowSqlite, rule.id);

    let actions: Action[];
    try {
      actions = JSON.parse(rule.actions);
    } catch {
      continue;
    }

    const sensor = db.prepare('SELECT name, unit FROM sensors WHERE id = ?').get(sensorId) as any;
    const sensorLabel = sensor ? `${sensor.name} (${value}${sensor.unit || ''})` : sensorId;

    for (const action of actions) {
      if (action.type === 'mqtt_command') {
        const client = getMqttClient();
        if (client?.connected && action.topic) {
          client.publish(action.topic, action.payload || '', { qos: 1 });
          console.log(`[AUTO] ${rule.name}: published to ${action.topic}`);
        }
      } else if (action.type === 'notification') {
        const notifId = uuid();
        const severity = action.severity || 'warning';
        const message = action.message
          ? action.message.replace('{sensor}', sensorLabel).replace('{value}', String(value))
          : `${rule.name}: ${sensorLabel} triggered (${rule.operator} ${rule.threshold})`;

        db.prepare(`
          INSERT INTO notifications (id, type, severity, title, message, automation_id, sensor_id)
          VALUES (?, 'automation', ?, ?, ?, ?, ?)
        `).run(notifId, severity, rule.name, message, rule.id, sensorId);

        console.log(`[AUTO] ${rule.name}: notification created (${severity})`);

        const client = getMqttClient();
        if (client?.connected) {
          client.publish('pio/notifications', JSON.stringify({
            id: notifId, type: 'automation', severity, title: rule.name, message,
          }), { qos: 1 });
        }
      }
    }
  }
}

export function startTimepointChecker(): void {
  const INTERVAL_MS = 60_000;

  setInterval(() => {
    try {
      checkTimepoints();
    } catch (err: any) {
      console.error('[TP-CHECK] Error:', err.message);
    }
  }, INTERVAL_MS);

  setTimeout(() => { try { checkTimepoints(); } catch {} }, 5000);
}

function checkTimepoints(): void {
  const db = getDb();
  const nowSqlite = new Date().toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');

  const overduePoints = db.prepare(`
    SELECT tp.*, g.name as grow_name
    FROM timepoints tp
    JOIN grows g ON tp.grow_id = g.id
    WHERE tp.status = 'pending' AND tp.scheduled_at <= ? AND g.status = 'active'
  `).all(nowSqlite) as any[];

  for (const tp of overduePoints) {
    db.prepare(`UPDATE timepoints SET status = 'overdue' WHERE id = ? AND status = 'pending'`).run(tp.id);

    const existing = db.prepare(`
      SELECT id FROM notifications WHERE timepoint_id = ? AND type = 'timepoint' AND dismissed = 0
    `).get(tp.id);

    if (existing) continue;

    const notifId = uuid();
    const message = `"${tp.title}" for grow "${tp.grow_name}" was due at ${new Date(tp.scheduled_at).toLocaleString()}`;

    db.prepare(`
      INSERT INTO notifications (id, type, severity, title, message, timepoint_id)
      VALUES (?, 'timepoint', 'warning', ?, ?, ?)
    `).run(notifId, `Timepoint overdue: ${tp.title}`, message, tp.id);

    const client = getMqttClient();
    if (client?.connected) {
      client.publish('pio/notifications', JSON.stringify({
        id: notifId, type: 'timepoint', severity: 'warning',
        title: `Timepoint overdue: ${tp.title}`, message,
      }), { qos: 1 });
    }
  }

  const upcomingPoints = db.prepare(`
    SELECT tp.*, g.name as grow_name
    FROM timepoints tp
    JOIN grows g ON tp.grow_id = g.id
    WHERE tp.status = 'pending' AND g.status = 'active'
      AND tp.scheduled_at > ? AND tp.scheduled_at <= datetime(?, '+15 minutes')
  `).all(nowSqlite, nowSqlite) as any[];

  for (const tp of upcomingPoints) {
    const existing = db.prepare(`
      SELECT id FROM notifications WHERE timepoint_id = ? AND type = 'timepoint' AND dismissed = 0
    `).get(tp.id);

    if (existing) continue;

    const notifId = uuid();
    const message = `"${tp.title}" for grow "${tp.grow_name}" is due at ${new Date(tp.scheduled_at).toLocaleString()}`;

    db.prepare(`
      INSERT INTO notifications (id, type, severity, title, message, timepoint_id)
      VALUES (?, 'timepoint', 'info', ?, ?, ?)
    `).run(notifId, `Upcoming: ${tp.title}`, message, tp.id);

    const client = getMqttClient();
    if (client?.connected) {
      client.publish('pio/notifications', JSON.stringify({
        id: notifId, type: 'timepoint', severity: 'info',
        title: `Upcoming: ${tp.title}`, message,
      }), { qos: 1 });
    }
  }
}
