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

export interface TelemetryPoint {
  value: number | null;
  value_min?: number | null;
  value_max?: number | null;
  value_text: string | null;
  timestamp: string;
  sensor_id?: string;
}

export interface Grow {
  id: string;
  name: string;
  description: string | null;
  strain: string | null;
  grow_medium: string;
  start_date: string;
  end_date: string | null;
  status: 'planning' | 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  timepoint_count?: number;
  completed_timepoints?: number;
  phase_count?: number;
}

export interface ProtocolPhase {
  id: string;
  grow_id: string;
  name: string;
  description: string | null;
  order_index: number;
  start_day: number;
  end_day: number | null;
  target_values: string | null;
  check_cadence_hours: number;
  check_times: string;
  created_at: string;
}

export interface CheckField {
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'photo';
  unit: string;
}

export interface TimepointTemplate {
  id: string;
  phase_id: string;
  title: string;
  type: 'observation' | 'measurement' | 'task' | 'feeding' | 'harvest' | 'photo';
  description: string | null;
  required_checks: string;
  order_index: number;
  created_at: string;
}

export interface Timepoint {
  id: string;
  grow_id: string;
  grow_name?: string;
  phase_id: string | null;
  template_id: string | null;
  scheduled_at: string;
  completed_at: string | null;
  title: string;
  description: string | null;
  type: 'observation' | 'measurement' | 'task' | 'feeding' | 'harvest' | 'photo';
  required_checks: string;
  status: 'pending' | 'completed' | 'skipped' | 'overdue';
  created_at: string;
}

export interface TimepointData {
  id: string;
  timepoint_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'photo' | 'video' | 'file';
  value_text: string | null;
  value_number: number | null;
  unit: string | null;
  created_at: string;
}

export interface Media {
  id: string;
  grow_id: string | null;
  timepoint_id: string | null;
  camera_id: string | null;
  source: 'manual' | 'auto_capture' | 'upload';
  s3_key: string;
  s3_bucket: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  tags: string | null;
  captured_at: string;
  created_at: string;
}

export interface Camera {
  id: string;
  name: string;
  type: 'usb' | 'ip' | 'rtsp' | 'mjpeg';
  url: string | null;
  device_index: number | null;
  resolution_w: number;
  resolution_h: number;
  enabled: number;
  created_at: string;
}

export interface CaptureSchedule {
  id: string;
  camera_id: string;
  grow_id: string | null;
  interval_seconds: number;
  enabled: number;
  last_capture_at: string | null;
  next_capture_at: string | null;
  created_at: string;
}

export interface ExportJob {
  id: string;
  type: 'telemetry_csv' | 'full_dataset' | 'media_manifest';
  grow_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: string | null;
  s3_key: string | null;
  row_count: number | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AutomationAction {
  type: 'mqtt_command' | 'notification';
  topic?: string;
  payload?: string;
  severity?: 'info' | 'warning' | 'critical';
  message?: string;
}

export interface Automation {
  id: string;
  name: string;
  enabled: number;
  sensor_id: string;
  sensor_name?: string;
  sensor_unit?: string;
  operator: '<' | '<=' | '>' | '>=' | '==' | '!=';
  threshold: number;
  sustained_seconds: number;
  cooldown_seconds: number;
  last_triggered_at: string | null;
  trigger_count: number;
  actions: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'automation' | 'timepoint' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  automation_id: string | null;
  timepoint_id: string | null;
  sensor_id: string | null;
  read: number;
  dismissed: number;
  created_at: string;
}

export interface GrowDetail extends Grow {
  phases: ProtocolPhase[];
  templates: TimepointTemplate[];
  timepoints: Timepoint[];
  media: Media[];
}
