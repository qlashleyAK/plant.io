import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Area, AreaChart,
} from 'recharts';
import { api } from '../hooks/useApi';
import type { Sensor, TelemetryPoint } from '../types';
import { History, Download, Plus, X, ChevronDown } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];

const PRESETS: Record<string, { label: string; ms: number; resolution: string }> = {
  '1h': { label: '1 hour', ms: 3_600_000, resolution: 'minute' },
  '6h': { label: '6 hours', ms: 21_600_000, resolution: 'minute' },
  '24h': { label: '24 hours', ms: 86_400_000, resolution: 'hour' },
  '7d': { label: '7 days', ms: 604_800_000, resolution: 'hour' },
  '30d': { label: '30 days', ms: 2_592_000_000, resolution: 'day' },
  '90d': { label: '90 days', ms: 7_776_000_000, resolution: 'day' },
};

interface MergedRow {
  timestamp: string;
  [key: string]: number | string | null;
}

export function HistoryPage() {
  const [allSensors, setAllSensors] = useState<Sensor[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preset, setPreset] = useState('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [chartData, setChartData] = useState<MergedRow[]>([]);
  const [sensorMeta, setSensorMeta] = useState<Record<string, { name: string; unit: string }>>({});
  const [loading, setLoading] = useState(false);
  const [showBands, setShowBands] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    api.sensors.list().then(setAllSensors).catch(console.error);
  }, []);

  const fetchHistory = useCallback(async () => {
    if (selectedIds.length === 0) { setChartData([]); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = { sensors: selectedIds.join(',') };
      if (useCustom && customFrom) {
        params.from = new Date(customFrom).toISOString();
        if (customTo) params.to = new Date(customTo).toISOString();
        const span = (new Date(customTo || Date.now()).getTime() - new Date(customFrom).getTime());
        params.resolution = span > 7 * 86_400_000 ? 'day' : span > 86_400_000 ? 'hour' : 'minute';
      } else {
        const p = PRESETS[preset];
        params.from = new Date(Date.now() - p.ms).toISOString();
        params.resolution = p.resolution;
      }

      const result = await api.analytics.history(params);
      const telemetry: TelemetryPoint[] = result.telemetry || [];
      const sensors: any[] = result.sensors || [];

      const meta: Record<string, { name: string; unit: string }> = {};
      for (const s of sensors) { meta[s.id] = { name: s.name, unit: s.unit }; }
      setSensorMeta(meta);

      const byTs = new Map<string, MergedRow>();
      for (const point of telemetry) {
        const ts = point.timestamp!;
        if (!byTs.has(ts)) byTs.set(ts, { timestamp: ts });
        const row = byTs.get(ts)!;
        row[point.sensor_id! + '_val'] = point.value;
        if (point.value_min != null) row[point.sensor_id! + '_min'] = point.value_min;
        if (point.value_max != null) row[point.sensor_id! + '_max'] = point.value_max;
      }

      const sorted = Array.from(byTs.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      setChartData(sorted);
    } catch (err) {
      console.error('History fetch failed:', err);
    }
    setLoading(false);
  }, [selectedIds, preset, useCustom, customFrom, customTo]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const toggleSensor = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    try {
      const params: any = { type: 'telemetry_csv', params: { sensor_ids: selectedIds } };
      if (useCustom && customFrom) {
        params.params.from = new Date(customFrom).toISOString();
        if (customTo) params.params.to = new Date(customTo).toISOString();
      } else {
        params.params.from = new Date(Date.now() - PRESETS[preset].ms).toISOString();
      }
      const job = await api.exports.create(params);
      if (job.status === 'completed' && job.id) {
        const { url } = await api.exports.downloadUrl(job.id);
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const p = PRESETS[preset];
    if (!useCustom && (preset === '30d' || preset === '90d')) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    if (!useCustom && preset === '7d') {
      return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-gray-100">Historical Analysis</h2>
      </div>

      {/* Controls */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-4">
        {/* Sensor selector */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Sensors</label>
          <div className="relative">
            <button
              onClick={() => setSelectorOpen(!selectorOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
            >
              <span>{selectedIds.length === 0 ? 'Select sensors...' : `${selectedIds.length} selected`}</span>
              <ChevronDown size={14} className={`transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
            </button>
            {selectorOpen && (
              <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {allSensors.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleSensor(s.id)}
                      className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-300">{s.name}</span>
                    {s.type === 'actuator' && (
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">actuator</span>
                    )}
                    <span className="text-xs text-gray-600 ml-auto">{s.unit || (s.type === 'actuator' ? 'ON/OFF' : '')}</span>
                  </label>
                ))}
                {allSensors.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">No sensors found</div>
                )}
              </div>
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedIds.map((id, i) => (
                <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length] }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {sensorMeta[id]?.name || id}
                  <button onClick={() => toggleSensor(id)} className="hover:opacity-70"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Time range */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Time Range</label>
            <div className="flex gap-1">
              {Object.entries(PRESETS).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => { setPreset(key); setUseCustom(false); }}
                  className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                    !useCustom && preset === key
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setUseCustom(true)}
                className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                  useCustom ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {useCustom && (
            <div className="flex gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">From</label>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">To</label>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 ml-auto">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showBands}
                onChange={(e) => setShowBands(e.target.checked)}
                className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
              />
              Min/Max bands
            </label>
            <button
              onClick={handleExport}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors disabled:opacity-40"
            >
              <Download size={12} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-80">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <History className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-500">
            {selectedIds.length === 0 ? 'Select sensors to view historical data' : 'No data for the selected range'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={400}>
            {showBands ? (
              <AreaChart data={chartData} margin={{ top: 5, right: 30, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#374151' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#374151' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString()}
                />
                <Legend />
                {selectedIds.map((id, i) => (
                  <Area
                    key={id}
                    type="monotone"
                    dataKey={`${id}_val`}
                    name={sensorMeta[id]?.name || id}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 5, right: 30, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#374151' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#374151' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString()}
                />
                <Legend />
                {selectedIds.map((id, i) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={`${id}_val`}
                    name={`${sensorMeta[id]?.name || id} (${sensorMeta[id]?.unit || ''})`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>

          <div className="mt-3 text-xs text-gray-600 text-center">
            {chartData.length.toLocaleString()} data points
          </div>
        </div>
      )}
    </div>
  );
}
