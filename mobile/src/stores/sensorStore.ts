import { create } from 'zustand';
import type { Sensor, GaugeConfig } from '../types';

interface LiveValue {
  value: number | string;
  timestamp: number;
}

interface DiscoveryPayload {
  id: string;
  name: string;
  type: 'sensor' | 'actuator';
  data_type: string;
  unit: string;
  icon: string;
  topic: string;
  command_topic?: string;
  gauge?: GaugeConfig;
}

interface SensorState {
  sensors: Map<string, Sensor>;
  liveValues: Map<string, LiveValue>;
  connected: boolean;

  setSensors: (sensors: Sensor[]) => void;
  updateLiveValue: (topic: string, value: string) => void;
  setConnected: (connected: boolean) => void;
  getSensorByTopic: (topic: string) => Sensor | undefined;
  registerDiscovery: (config: DiscoveryPayload) => void;
}

export const useSensorStore = create<SensorState>((set, get) => ({
  sensors: new Map(),
  liveValues: new Map(),
  connected: false,

  setSensors: (sensors) => {
    const map = new Map<string, Sensor>();
    sensors.forEach((s) => map.set(s.id, s));
    set({ sensors: map });
  },

  updateLiveValue: (topic, value) => {
    const { liveValues, sensors } = get();
    const sensor = Array.from(sensors.values()).find((s) => s.topic === topic);
    if (!sensor) return;

    const newMap = new Map(liveValues);
    const numVal = parseFloat(value);
    newMap.set(sensor.id, {
      value: isNaN(numVal) ? value : numVal,
      timestamp: Date.now(),
    });
    set({ liveValues: newMap });
  },

  setConnected: (connected) => set({ connected }),

  getSensorByTopic: (topic) => {
    const { sensors } = get();
    return Array.from(sensors.values()).find((s) => s.topic === topic);
  },

  registerDiscovery: (config) => {
    const { sensors } = get();
    const newMap = new Map(sensors);
    const existing = newMap.get(config.id);

    newMap.set(config.id, {
      id: config.id,
      name: config.name,
      type: config.type,
      data_type: config.data_type as 'number' | 'binary',
      unit: config.unit,
      icon: config.icon,
      topic: config.topic,
      command_topic: config.command_topic,
      gauge_config: config.gauge || null,
      discovered_at: existing?.discovered_at || new Date().toISOString(),
      last_seen: new Date().toISOString(),
      last_value: existing?.last_value ?? null,
      last_value_text: existing?.last_value_text ?? null,
      last_reading: existing?.last_reading ?? null,
    });

    set({ sensors: newMap });
  },
}));
