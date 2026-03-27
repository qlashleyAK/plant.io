import mqtt from 'mqtt';
import { getDb } from './database';
import { evaluateAutomations } from './automations';

const BROKER_URL = process.env.MQTT_BROKER || 'mqtt://localhost:1883';

let client: mqtt.MqttClient;

interface SensorConfig {
  id: string;
  name: string;
  type: 'sensor' | 'actuator';
  data_type: string;
  unit: string;
  icon: string;
  topic: string;
  command_topic?: string;
  gauge?: unknown;
}

const topicToSensorId = new Map<string, string>();

export function getMqttClient(): mqtt.MqttClient {
  return client;
}

export function initMqtt(): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    client = mqtt.connect(BROKER_URL, {
      clientId: `pio-api-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      will: {
        topic: 'pio/status/api',
        payload: Buffer.from('offline'),
        qos: 1,
        retain: true,
      },
    });

    client.on('connect', () => {
      console.log(`[MQTT] Connected to ${BROKER_URL}`);
      client.publish('pio/status/api', 'online', { retain: true, qos: 1 });

      client.subscribe('pio/discovery/#', { qos: 1 });
      client.subscribe('airoponic/telemetry/#', { qos: 0 });

      resolve(client);
    });

    client.on('error', (err) => {
      console.error('[MQTT] Error:', err.message);
      reject(err);
    });

    client.on('message', (topic, payload) => {
      const message = payload.toString();

      if (topic.startsWith('pio/discovery/')) {
        handleDiscovery(topic, message);
      } else if (topic.startsWith('airoponic/telemetry/')) {
        handleTelemetry(topic, message);
      }
    });
  });
}

function handleDiscovery(_topic: string, message: string) {
  try {
    const config: SensorConfig = JSON.parse(message);
    const db = getDb();

    db.prepare(`
      INSERT INTO sensors (id, name, type, data_type, unit, icon, topic, command_topic, gauge_config, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        data_type = excluded.data_type,
        unit = excluded.unit,
        icon = excluded.icon,
        topic = excluded.topic,
        command_topic = excluded.command_topic,
        gauge_config = excluded.gauge_config,
        last_seen = datetime('now')
    `).run(
      config.id,
      config.name,
      config.type,
      config.data_type,
      config.unit,
      config.icon,
      config.topic,
      config.command_topic || null,
      config.gauge ? JSON.stringify(config.gauge) : null,
    );

    topicToSensorId.set(config.topic, config.id);
    console.log(`[Discovery] Registered ${config.type}: ${config.name} (${config.id})`);
  } catch (err) {
    console.error('[Discovery] Failed to parse:', err);
  }
}

function handleTelemetry(topic: string, message: string) {
  let sensorId = topicToSensorId.get(topic);

  if (!sensorId) {
    const db = getDb();
    const row = db.prepare('SELECT id FROM sensors WHERE topic = ?').get(topic) as { id: string } | undefined;
    if (row) {
      sensorId = row.id;
      topicToSensorId.set(topic, sensorId);
    } else {
      return;
    }
  }

  const numValue = parseFloat(message);
  const isNumeric = !isNaN(numValue);

  // Convert binary text states to numeric for consistent storage
  const upper = message.trim().toUpperCase();
  const binaryVal = (upper === 'ON' || upper === 'TRUE') ? 1 : (upper === 'OFF' || upper === 'FALSE') ? 0 : null;
  const storeValue = isNumeric ? numValue : binaryVal;

  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO telemetry (sensor_id, topic, value, value_text, timestamp)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(sensorId, topic, storeValue, message);

    db.prepare(`UPDATE sensors SET last_seen = datetime('now') WHERE id = ?`).run(sensorId);

    if (storeValue !== null) {
      evaluateAutomations(sensorId, storeValue);
    }
  } catch (err) {
    console.error('[Telemetry] Insert error:', err);
  }
}

export function rebuildTopicMap() {
  const db = getDb();
  const rows = db.prepare('SELECT id, topic FROM sensors').all() as { id: string; topic: string }[];
  topicToSensorId.clear();
  for (const row of rows) {
    topicToSensorId.set(row.topic, row.id);
  }
}
