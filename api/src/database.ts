import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'plantio.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sensors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('sensor', 'actuator')),
      data_type TEXT NOT NULL DEFAULT 'number',
      unit TEXT DEFAULT '',
      icon TEXT DEFAULT '',
      topic TEXT NOT NULL,
      command_topic TEXT,
      gauge_config TEXT,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      value REAL,
      value_text TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_ts
      ON telemetry(sensor_id, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_telemetry_ts
      ON telemetry(timestamp DESC);

    CREATE TABLE IF NOT EXISTS grows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      strain TEXT,
      grow_medium TEXT DEFAULT 'aeroponic',
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('planning', 'active', 'completed', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS protocol_phases (
      id TEXT PRIMARY KEY,
      grow_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      start_day INTEGER NOT NULL,
      end_day INTEGER,
      target_values TEXT,
      check_cadence_hours REAL NOT NULL DEFAULT 24,
      check_times TEXT NOT NULL DEFAULT '["09:00"]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (grow_id) REFERENCES grows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timepoint_templates (
      id TEXT PRIMARY KEY,
      phase_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'observation' CHECK(type IN ('observation', 'measurement', 'task', 'feeding', 'harvest', 'photo')),
      description TEXT,
      required_checks TEXT NOT NULL DEFAULT '[]',
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (phase_id) REFERENCES protocol_phases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timepoints (
      id TEXT PRIMARY KEY,
      grow_id TEXT NOT NULL,
      phase_id TEXT,
      template_id TEXT,
      scheduled_at TEXT NOT NULL,
      completed_at TEXT,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'observation' CHECK(type IN ('observation', 'measurement', 'task', 'feeding', 'harvest', 'photo')),
      required_checks TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped', 'overdue')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (grow_id) REFERENCES grows(id) ON DELETE CASCADE,
      FOREIGN KEY (phase_id) REFERENCES protocol_phases(id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES timepoint_templates(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS timepoint_data (
      id TEXT PRIMARY KEY,
      timepoint_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text' CHECK(field_type IN ('text', 'number', 'boolean', 'photo', 'video', 'file')),
      value_text TEXT,
      value_number REAL,
      unit TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (timepoint_id) REFERENCES timepoints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      grow_id TEXT,
      timepoint_id TEXT,
      camera_id TEXT,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'auto_capture', 'upload')),
      s3_key TEXT NOT NULL,
      s3_bucket TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      width INTEGER,
      height INTEGER,
      caption TEXT,
      tags TEXT,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (grow_id) REFERENCES grows(id) ON DELETE SET NULL,
      FOREIGN KEY (timepoint_id) REFERENCES timepoints(id) ON DELETE SET NULL,
      FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_grow ON media(grow_id);
    CREATE INDEX IF NOT EXISTS idx_media_captured ON media(captured_at);
    CREATE INDEX IF NOT EXISTS idx_media_camera ON media(camera_id, captured_at);
    CREATE INDEX IF NOT EXISTS idx_timepoints_grow ON timepoints(grow_id, scheduled_at);

    CREATE TABLE IF NOT EXISTS cameras (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('usb', 'ip', 'rtsp', 'mjpeg')),
      url TEXT,
      device_index INTEGER,
      resolution_w INTEGER DEFAULT 1920,
      resolution_h INTEGER DEFAULT 1080,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS capture_schedules (
      id TEXT PRIMARY KEY,
      camera_id TEXT NOT NULL,
      grow_id TEXT,
      interval_seconds INTEGER NOT NULL DEFAULT 3600,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_capture_at TEXT,
      next_capture_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE,
      FOREIGN KEY (grow_id) REFERENCES grows(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('telemetry_csv', 'full_dataset', 'media_manifest')),
      grow_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
      params TEXT,
      s3_key TEXT,
      row_count INTEGER,
      error TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (grow_id) REFERENCES grows(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sensor_id TEXT NOT NULL,
      operator TEXT NOT NULL CHECK(operator IN ('<', '<=', '>', '>=', '==', '!=')),
      threshold REAL NOT NULL,
      sustained_seconds INTEGER NOT NULL DEFAULT 0,
      cooldown_seconds INTEGER NOT NULL DEFAULT 300,
      last_triggered_at TEXT,
      trigger_count INTEGER NOT NULL DEFAULT 0,
      actions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('automation', 'timepoint', 'system')),
      severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'critical')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      automation_id TEXT,
      timepoint_id TEXT,
      sensor_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE SET NULL,
      FOREIGN KEY (timepoint_id) REFERENCES timepoints(id) ON DELETE SET NULL,
      FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_unread
      ON notifications(dismissed, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_automations_sensor
      ON automations(sensor_id, enabled);

    CREATE TABLE IF NOT EXISTS actuator_schedules (
      id TEXT PRIMARY KEY,
      actuator_id TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      mode TEXT NOT NULL DEFAULT 'duty_cycle' CHECK(mode IN ('duty_cycle', 'continuous')),
      interval_seconds INTEGER NOT NULL DEFAULT 30,
      on_seconds INTEGER NOT NULL DEFAULT 5,
      grow_id TEXT,
      phase_id TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (actuator_id) REFERENCES sensors(id) ON DELETE CASCADE,
      FOREIGN KEY (grow_id) REFERENCES grows(id) ON DELETE SET NULL,
      FOREIGN KEY (phase_id) REFERENCES protocol_phases(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_actuator_schedules_actuator
      ON actuator_schedules(actuator_id, enabled);

    CREATE TABLE IF NOT EXISTS push_tokens (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL DEFAULT 'web',
      subscription TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      grow_id TEXT,
      media_id TEXT,
      title TEXT NOT NULL DEFAULT 'New conversation',
      model TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (grow_id) REFERENCES grows(id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ai_conv_grow ON ai_conversations(grow_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_conv_media ON ai_conversations(media_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      model TEXT,
      duration_ms INTEGER,
      context TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, created_at ASC);
  `);

  // Migrations for existing databases
  const pushCols = db.pragma('table_info(push_tokens)') as { name: string }[];
  if (pushCols.length > 0 && !pushCols.find(c => c.name === 'subscription')) {
    db.exec('ALTER TABLE push_tokens ADD COLUMN subscription TEXT');
  }

  const tplCols = db.pragma('table_info(timepoint_templates)') as { name: string }[];
  if (tplCols.length > 0 && !tplCols.find(c => c.name === 'camera_id')) {
    db.exec('ALTER TABLE timepoint_templates ADD COLUMN camera_id TEXT REFERENCES cameras(id) ON DELETE SET NULL');
  }

  const tpCols = db.pragma('table_info(timepoints)') as { name: string }[];
  if (tpCols.length > 0 && !tpCols.find(c => c.name === 'camera_id')) {
    db.exec('ALTER TABLE timepoints ADD COLUMN camera_id TEXT REFERENCES cameras(id) ON DELETE SET NULL');
  }

  const tplCols2 = db.pragma('table_info(timepoint_templates)') as { name: string }[];
  if (tplCols2.length > 0 && !tplCols2.find(c => c.name === 'ai_config')) {
    db.exec('ALTER TABLE timepoint_templates ADD COLUMN ai_config TEXT');
  }

  const tpCols2 = db.pragma('table_info(timepoints)') as { name: string }[];
  if (tpCols2.length > 0 && !tpCols2.find(c => c.name === 'ai_config')) {
    db.exec('ALTER TABLE timepoints ADD COLUMN ai_config TEXT');
  }
}
