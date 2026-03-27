import type { Sensor } from '../types';
import { useSensorStore } from '../stores/sensorStore';
import { Power } from 'lucide-react';

interface Props {
  sensor: Sensor;
  onClick?: () => void;
}

export function ActuatorTile({ sensor, onClick }: Props) {
  const liveValues = useSensorStore((s) => s.liveValues);
  const live = liveValues.get(sensor.id);

  const rawValue = live?.value ?? sensor.last_value_text ?? sensor.last_value;
  const isOn = rawValue === 'ON' || rawValue === 1 || rawValue === '1';
  const stale = live ? (Date.now() - live.timestamp > 120_000) : true;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left w-full
        ${isOn
          ? 'bg-emerald-950/40 border-emerald-700/50 shadow-[0_0_20px_-5px_rgba(34,197,94,0.15)]'
          : 'bg-gray-900/60 border-gray-800 hover:border-gray-600'
        }
      `}
    >
      <div className={`
        flex items-center justify-center w-10 h-10 rounded-lg transition-colors
        ${isOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}
      `}>
        <Power size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-200 truncate">{sensor.name}</div>
        <div className={`text-xs font-mono ${isOn ? 'text-emerald-400' : 'text-gray-500'}`}>
          {isOn ? 'RUNNING' : 'OFF'}
        </div>
      </div>
      <span className={`w-2 h-2 rounded-full shrink-0 ${
        stale ? 'bg-gray-600' : isOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
      }`} />
    </button>
  );
}
