import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import { useSensorStore } from '../stores/sensorStore';
import type { Sensor } from '../types';
import { Power, ToggleLeft, ToggleRight, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

export function ControlsPage() {
  const [actuators, setActuators] = useState<Sensor[]>([]);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { liveValues, connected } = useSensorStore();

  const loadActuators = useCallback(async () => {
    try {
      const all = await api.sensors.list();
      setActuators(all.filter((s: Sensor) => s.type === 'actuator'));
    } catch (err) {
      console.error('Failed to load actuators:', err);
    }
  }, []);

  useEffect(() => { loadActuators(); }, [loadActuators]);

  const sendCommand = async (actuator: Sensor, state: boolean) => {
    setSending((p) => ({ ...p, [actuator.id]: true }));
    setErrors((p) => ({ ...p, [actuator.id]: '' }));
    try {
      await api.sensors.command(actuator.id, state);
    } catch (err: any) {
      setErrors((p) => ({ ...p, [actuator.id]: err.message || 'Command failed' }));
    }
    setSending((p) => ({ ...p, [actuator.id]: false }));
  };

  const getState = (a: Sensor): boolean => {
    const live = liveValues.get(a.id);
    const raw = live?.value ?? a.last_value_text ?? a.last_value;
    if (raw === null || raw === undefined) return false;
    const s = String(raw).toUpperCase();
    return s === 'ON' || s === '1' || s === 'TRUE';
  };

  const isStale = (a: Sensor): boolean => {
    const live = liveValues.get(a.id);
    return live ? (Date.now() - live.timestamp > 120_000) : true;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Power className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-100">Actuator Controls</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
          connected ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'
        }`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'MQTT Connected' : 'Disconnected'}
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Send ON/OFF commands to actuators via MQTT. Node-RED receives these commands and controls the physical devices.
      </p>

      {actuators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Power className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-500">No actuators discovered</p>
          <p className="text-xs text-gray-600 mt-1">Actuators appear here once Node-RED publishes discovery messages.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {actuators.map((a) => {
            const isOn = getState(a);
            const stale = isStale(a);
            const isSending = sending[a.id];
            const error = errors[a.id];

            return (
              <div key={a.id} className={`rounded-xl border p-5 transition-all ${
                isOn ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-gray-900/60 border-gray-800'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-200">{a.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${
                        stale ? 'bg-gray-600' : isOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                      }`} />
                      <span className={`text-xs font-mono ${isOn ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {isOn ? 'RUNNING' : 'OFF'}
                      </span>
                      {stale && <span className="text-[10px] text-gray-600">(stale)</span>}
                    </div>
                  </div>
                  {a.command_topic ? (
                    <button
                      onClick={() => sendCommand(a, !isOn)}
                      disabled={isSending}
                      className="transition-all disabled:opacity-50"
                      title={isOn ? 'Turn OFF' : 'Turn ON'}
                    >
                      {isOn
                        ? <ToggleRight size={36} className="text-emerald-400" />
                        : <ToggleLeft size={36} className="text-gray-600 hover:text-gray-400" />
                      }
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-1 rounded">read-only</span>
                  )}
                </div>

                {a.command_topic && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendCommand(a, true)}
                      disabled={isSending || isOn}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                        isOn
                          ? 'bg-emerald-600/20 text-emerald-400 cursor-default'
                          : 'bg-gray-800 text-gray-400 hover:bg-emerald-600 hover:text-white disabled:opacity-40'
                      }`}
                    >
                      {isSending ? '...' : 'ON'}
                    </button>
                    <button
                      onClick={() => sendCommand(a, false)}
                      disabled={isSending || !isOn}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                        !isOn
                          ? 'bg-gray-800/50 text-gray-600 cursor-default'
                          : 'bg-gray-800 text-gray-400 hover:bg-red-600 hover:text-white disabled:opacity-40'
                      }`}
                    >
                      {isSending ? '...' : 'OFF'}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                    <AlertTriangle size={10} /> {error}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-800/50">
                  <div className="text-[10px] text-gray-600 space-y-0.5">
                    <div>ID: <span className="text-gray-500 font-mono">{a.id}</span></div>
                    <div>State topic: <span className="text-gray-500 font-mono">{a.topic}</span></div>
                    {a.command_topic && (
                      <div>Command topic: <span className="text-gray-500 font-mono">{a.command_topic}</span></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
