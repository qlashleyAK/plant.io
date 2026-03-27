import { useMemo } from 'react';
import type { Sensor, GaugeConfig } from '../types';
import { useSensorStore } from '../stores/sensorStore';

interface Props {
  sensor: Sensor;
  onClick?: () => void;
}

function getSegmentColor(value: number, config: GaugeConfig): string {
  const sorted = [...config.segments].sort((a, b) => b.from - a.from);
  for (const seg of sorted) {
    if (value >= seg.from) return seg.color;
  }
  return sorted[sorted.length - 1]?.color || '#6b7280';
}

export function SensorGauge({ sensor, onClick }: Props) {
  const liveValues = useSensorStore((s) => s.liveValues);
  const live = liveValues.get(sensor.id);

  const value = live
    ? (typeof live.value === 'number' ? live.value : parseFloat(live.value as string))
    : sensor.last_value;

  const displayValue = value !== null && value !== undefined && !isNaN(value)
    ? (Math.abs(value) < 10 ? value.toFixed(2) : Math.abs(value) < 100 ? value.toFixed(1) : Math.round(value))
    : '--';

  const gauge = sensor.gauge_config;
  const pct = useMemo(() => {
    if (!gauge || value === null || value === undefined || isNaN(value)) return 0;
    return Math.max(0, Math.min(1, (value - gauge.min) / (gauge.max - gauge.min)));
  }, [gauge, value]);

  const color = gauge && value !== null && !isNaN(value as number)
    ? getSegmentColor(value as number, gauge)
    : '#6b7280';

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const offset = arcLength * (1 - pct);

  const stale = live ? (Date.now() - live.timestamp > 120_000) : true;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center p-4 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-gray-600 transition-all hover:bg-gray-900/80 cursor-pointer group"
    >
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="#1f2937"
            strokeWidth="6"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="gauge-ring"
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold font-mono leading-none" style={{ color }}>
            {displayValue}
          </span>
          <span className="text-[10px] text-gray-500 mt-0.5">{sensor.unit}</span>
        </div>
      </div>
      <span className="mt-1 text-xs text-gray-400 group-hover:text-gray-200 transition-colors truncate max-w-full">
        {sensor.name}
      </span>
      <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${stale ? 'bg-gray-600' : 'bg-emerald-400 animate-pulse'}`} />
    </button>
  );
}
