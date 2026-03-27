import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { api } from '../hooks/useApi';
import type { Sensor } from '../types';
import { useSensorStore } from '../stores/sensorStore';

interface Props {
  sensor: Sensor;
  height?: number;
}

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#ec4899'];

function computeDomain(data: any[], isBinary: boolean): [number, number] | [string, string] {
  if (isBinary) return [-0.1, 1.1];
  const values = data.map((d) => d.value).filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (values.length === 0) return ['auto', 'auto'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 0.5);
  return [Math.floor((min - padding) * 100) / 100, Math.ceil((max + padding) * 100) / 100];
}

function toBinaryValue(raw: string | number | undefined | null): number {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).toUpperCase();
  return (s === 'ON' || s === '1' || s === 'TRUE') ? 1 : 0;
}

const RANGES: Record<string, { label: string; seconds: number; refreshMs: number }> = {
  '30s': { label: '30s', seconds: 30, refreshMs: 2_000 },
  '1m': { label: '1m', seconds: 60, refreshMs: 3_000 },
  '5m': { label: '5m', seconds: 300, refreshMs: 5_000 },
  '15m': { label: '15m', seconds: 900, refreshMs: 10_000 },
  '30m': { label: '30m', seconds: 1800, refreshMs: 15_000 },
  '1h': { label: '1h', seconds: 3600, refreshMs: 30_000 },
};

export function TimeSeriesChart({ sensor, height = 220 }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [range, setRange] = useState('5m');
  const [loading, setLoading] = useState(false);
  const liveValues = useSensorStore((s) => s.liveValues);
  const isBinary = sensor.type === 'actuator' || sensor.data_type === 'binary';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = RANGES[range];
      const from = new Date(Date.now() - r.seconds * 1000).toISOString();
      const rows = await api.sensors.telemetry(sensor.id, { from, limit: '500' });

      if (isBinary) {
        setData(rows.map((row: any) => ({
          ...row,
          value: row.value != null ? toBinaryValue(row.value) : toBinaryValue(row.value_text),
        })));
      } else {
        setData(rows);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    }
    setLoading(false);
  }, [sensor.id, range, isBinary]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, RANGES[range].refreshMs);
    return () => clearInterval(interval);
  }, [fetchData, range]);

  const live = liveValues.get(sensor.id);
  let chartData = [...data];

  if (live) {
    const liveVal = isBinary ? toBinaryValue(live.value) : (typeof live.value === 'number' ? live.value : null);
    if (liveVal !== null) {
      chartData.push({ value: liveVal, timestamp: new Date(live.timestamp).toISOString() });
    }
  }

  if (chartData.length === 1) {
    const pt = chartData[0];
    const r = RANGES[range];
    const edgeTs = new Date(new Date(pt.timestamp).getTime() - r.seconds * 500).toISOString();
    chartData = [{ ...pt, timestamp: edgeTs }, pt];
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const r = RANGES[range];
    if (r.seconds <= 60) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const liveDisplay = isBinary
    ? (live ? (toBinaryValue(live.value) ? 'ON' : 'OFF') : null)
    : (live && typeof live.value === 'number' ? `${live.value.toFixed(2)} ${sensor.unit}` : null);

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">{sensor.name}</h3>
          {liveDisplay && (
            <span className={`text-xs font-mono ${isBinary && toBinaryValue(live!.value) ? 'text-emerald-400' : isBinary ? 'text-gray-500' : 'text-emerald-400'}`}>
              {liveDisplay}
            </span>
          )}
          {isBinary && <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">actuator</span>}
        </div>
        <div className="flex gap-1">
          {Object.entries(RANGES).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                range === key ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center text-gray-600 text-sm" style={{ height }}>
          No data for this range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={{ stroke: '#374151' }}
              tickLine={{ stroke: '#374151' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={{ stroke: '#374151' }}
              tickLine={{ stroke: '#374151' }}
              width={45}
              domain={computeDomain(chartData, isBinary)}
              allowDataOverflow={false}
              {...(isBinary ? {
                ticks: [0, 1],
                tickFormatter: (v: number) => v === 1 ? 'ON' : 'OFF',
              } : {})}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelFormatter={(ts) => new Date(ts).toLocaleString()}
              formatter={(v: number) => [
                isBinary ? (v >= 0.5 ? 'ON' : 'OFF') : `${v?.toFixed?.(2) ?? v} ${sensor.unit}`,
                sensor.name,
              ]}
            />
            {!isBinary && sensor.gauge_config?.segments.slice(1).map((seg, i) => (
              <ReferenceLine
                key={i}
                y={seg.from}
                stroke={seg.color}
                strokeDasharray="4 4"
                strokeOpacity={0.3}
              />
            ))}
            <Line
              type={isBinary ? 'stepAfter' : 'monotone'}
              dataKey="value"
              stroke={isBinary ? '#3b82f6' : COLORS[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: isBinary ? '#3b82f6' : COLORS[0] }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
