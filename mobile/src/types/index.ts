export interface GaugeSegment {
  from: number;
  color: string;
}

export interface GaugeConfig {
  min: number;
  max: number;
  segments: GaugeSegment[];
}

export interface Sensor {
  id: string;
  name: string;
  type: 'sensor' | 'actuator';
  data_type: 'number' | 'binary';
  unit: string;
  icon: string;
  topic: string;
  command_topic?: string;
  gauge_config: GaugeConfig | null;
  discovered_at: string;
  last_seen: string;
  last_value: number | null;
  last_value_text: string | null;
  last_reading: string | null;
}

export interface Grow {
  id: string;
  name: string;
  description?: string;
  strain?: string;
  grow_medium: string;
  start_date: string;
  end_date?: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  phase_count?: number;
  timepoint_count?: number;
}

export interface Phase {
  id: string;
  grow_id: string;
  name: string;
  description?: string;
  order_index: number;
  start_day: number;
  end_day?: number;
  target_values?: string;
  check_cadence_hours: number;
  check_times: string;
}

export interface Timepoint {
  id: string;
  grow_id: string;
  phase_id?: string;
  template_id?: string;
  scheduled_at: string;
  completed_at?: string;
  title: string;
  description?: string;
  type: 'observation' | 'measurement' | 'task' | 'feeding' | 'harvest' | 'photo';
  required_checks: string;
  status: 'pending' | 'completed' | 'skipped' | 'overdue';
}

export interface Notification {
  id: string;
  type: 'automation' | 'timepoint' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  automation_id?: string;
  timepoint_id?: string;
  sensor_id?: string;
  read: number;
  dismissed: number;
  created_at: string;
}

export interface Automation {
  id: string;
  name: string;
  enabled: number;
  sensor_id: string;
  operator: string;
  threshold: number;
  sustained_seconds: number;
  cooldown_seconds: number;
  last_triggered_at?: string;
  trigger_count: number;
  actions: string;
  sensor_name?: string;
  sensor_unit?: string;
}

export interface ActuatorSchedule {
  id: string;
  actuator_id: string;
  name: string;
  enabled: number;
  mode: 'duty_cycle' | 'continuous';
  interval_seconds: number;
  on_seconds: number;
  grow_id?: string;
  phase_id?: string;
  priority: number;
}

export interface Media {
  id: string;
  grow_id?: string;
  timepoint_id?: string;
  camera_id?: string;
  source: 'manual' | 'auto_capture' | 'upload';
  s3_key: string;
  original_name: string;
  mime_type: string;
  size: number;
  caption?: string;
  captured_at: string;
}
