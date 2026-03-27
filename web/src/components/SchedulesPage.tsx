import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import { useSensorStore } from '../stores/sensorStore';
import type { Sensor } from '../types';
import {
  CalendarClock, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Wifi, WifiOff, Timer, Infinity as InfinityIcon, Pencil, X, Check,
} from 'lucide-react';

interface Schedule {
  id: string;
  actuator_id: string;
  actuator_name: string;
  name: string;
  enabled: number;
  mode: 'duty_cycle' | 'continuous';
  interval_seconds: number;
  on_seconds: number;
  grow_id: string | null;
  grow_name: string | null;
  phase_id: string | null;
  phase_name: string | null;
  priority: number;
}

interface Grow { id: string; name: string; status: string; }
interface GrowDetail extends Grow { phases?: { id: string; name: string; start_day: number; end_day: number | null; }[]; }

const EMPTY_FORM = {
  name: '', mode: 'duty_cycle' as 'duty_cycle' | 'continuous',
  interval_seconds: 30, on_seconds: 5,
  grow_id: '', phase_id: '', priority: 0,
};

function DutyCycleBar({ interval, onTime }: { interval: number; onTime: number }) {
  const pct = Math.min((onTime / interval) * 100, 100);
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 whitespace-nowrap">{onTime}s ON / {interval - onTime}s OFF</span>
    </div>
  );
}

export function SchedulesPage() {
  const [actuators, setActuators] = useState<Sensor[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [grows, setGrows] = useState<Grow[]>([]);
  const [growDetail, setGrowDetail] = useState<GrowDetail | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { liveValues, connected } = useSensorStore();

  const load = useCallback(async () => {
    const [all, scheds, gs] = await Promise.all([
      api.sensors.list(),
      api.schedules.list(),
      api.grows.list(),
    ]);
    setActuators(all.filter((s: Sensor) => s.type === 'actuator'));
    setSchedules(scheds);
    setGrows(gs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getState = (a: Sensor): boolean => {
    const live = liveValues.get(a.id);
    const raw = live?.value ?? a.last_value_text ?? a.last_value;
    if (raw === null || raw === undefined) return false;
    return String(raw).toUpperCase() === 'ON' || String(raw) === '1' || String(raw).toUpperCase() === 'TRUE';
  };

  const schedulesFor = (actuatorId: string) =>
    schedules.filter((s) => s.actuator_id === actuatorId).sort((a, b) => b.priority - a.priority);

  const activeSchedule = (actuatorId: string): Schedule | null => {
    const scheds = schedulesFor(actuatorId);
    return scheds.find((s) => s.enabled) || null;
  };

  const startCreate = (actuatorId: string) => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(actuatorId);
    setExpanded(actuatorId);
  };

  const startEdit = (sched: Schedule) => {
    setEditId(sched.id);
    setForm({
      name: sched.name, mode: sched.mode,
      interval_seconds: sched.interval_seconds, on_seconds: sched.on_seconds,
      grow_id: sched.grow_id || '', phase_id: sched.phase_id || '',
      priority: sched.priority,
    });
    setShowForm(sched.actuator_id);
  };

  const save = async (actuatorId: string) => {
    const data = {
      ...form,
      actuator_id: actuatorId,
      grow_id: form.grow_id || null,
      phase_id: form.phase_id || null,
      enabled: 1,
    };
    if (editId) {
      await api.schedules.update(editId, data);
    } else {
      await api.schedules.create(data);
    }
    setShowForm(null);
    setEditId(null);
    setForm(EMPTY_FORM);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    await api.schedules.delete(id);
    load();
  };

  const handleToggle = async (id: string) => {
    await api.schedules.toggle(id);
    load();
  };

  useEffect(() => {
    if (form.grow_id) {
      api.grows.get(form.grow_id).then(setGrowDetail).catch(() => setGrowDetail(null));
    } else {
      setGrowDetail(null);
    }
  }, [form.grow_id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-100">Actuator Schedules</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
          connected ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'
        }`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'MQTT Connected' : 'Disconnected'}
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Define duty-cycle programs for each actuator. Schedules can be global or bound to a specific grow and protocol phase.
      </p>

      {actuators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarClock className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-500">No actuators discovered</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actuators.map((a) => {
            const isOn = getState(a);
            const scheds = schedulesFor(a.id);
            const active = activeSchedule(a.id);
            const isExpanded = expanded === a.id;

            return (
              <div key={a.id} className={`rounded-xl border transition-all ${
                isOn ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-gray-900/60 border-gray-800'
              }`}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : a.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${isOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                    <div>
                      <div className="text-sm font-medium text-gray-200">{a.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {active ? (
                          <span className="text-blue-400">
                            <Timer size={10} className="inline mr-1" />
                            {active.name}
                            {active.mode === 'duty_cycle'
                              ? ` · ${active.on_seconds}s/${active.interval_seconds}s`
                              : ' · Continuous'}
                            {active.grow_name && ` · ${active.grow_name}`}
                            {active.phase_name && ` / ${active.phase_name}`}
                          </span>
                        ) : (
                          <span className="text-gray-600">No active schedule</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">{scheds.length} schedule{scheds.length !== 1 ? 's' : ''}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-800/50 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Schedules</span>
                      <button onClick={() => startCreate(a.id)}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                        <Plus size={10} /> Add Schedule
                      </button>
                    </div>

                    {showForm === a.id && (
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                        <h4 className="text-xs text-gray-300 font-medium">{editId ? 'Edit Schedule' : 'New Schedule'}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input placeholder="Schedule name" value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600" />
                          <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                            <option value="duty_cycle">Duty Cycle</option>
                            <option value="continuous">Continuous (always ON)</option>
                          </select>
                        </div>

                        {form.mode === 'duty_cycle' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase">Cycle Interval (seconds)</label>
                              <input type="number" min={1} value={form.interval_seconds}
                                onChange={(e) => setForm({ ...form, interval_seconds: parseInt(e.target.value) || 1 })}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 mt-1" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase">ON Duration (seconds)</label>
                              <input type="number" min={1} value={form.on_seconds}
                                onChange={(e) => setForm({ ...form, on_seconds: parseInt(e.target.value) || 1 })}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 mt-1" />
                            </div>
                          </div>
                        )}

                        {form.mode === 'duty_cycle' && (
                          <DutyCycleBar interval={form.interval_seconds} onTime={form.on_seconds} />
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase">Bind to Grow (optional)</label>
                            <select value={form.grow_id} onChange={(e) => setForm({ ...form, grow_id: e.target.value, phase_id: '' })}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 mt-1">
                              <option value="">Global (always)</option>
                              {grows.filter((g) => g.status === 'active').map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                          {form.grow_id && (
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase">Bind to Phase (optional)</label>
                              <select value={form.phase_id} onChange={(e) => setForm({ ...form, phase_id: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 mt-1">
                                <option value="">All phases</option>
                                {growDetail?.phases?.map((p: any) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                )) || null}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase">Priority</label>
                            <input type="number" value={form.priority}
                              onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 mt-1" />
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <button onClick={() => { setShowForm(null); setEditId(null); setForm(EMPTY_FORM); }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">
                            <X size={12} /> Cancel
                          </button>
                          <button onClick={() => save(a.id)} disabled={!form.name}
                            className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">
                            <Check size={12} /> {editId ? 'Update' : 'Create'}
                          </button>
                        </div>
                      </div>
                    )}

                    {scheds.length === 0 && showForm !== a.id ? (
                      <p className="text-xs text-gray-600 text-center py-6">
                        No schedules defined. The API scheduler will not control this actuator.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {scheds.map((s) => (
                          <div key={s.id} className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                            s.enabled ? 'bg-gray-800/40' : 'bg-gray-800/20 opacity-60'
                          }`}>
                            <button onClick={() => handleToggle(s.id)} title={s.enabled ? 'Disable' : 'Enable'}>
                              {s.enabled
                                ? <ToggleRight size={22} className="text-emerald-400" />
                                : <ToggleLeft size={22} className="text-gray-600" />
                              }
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-200">{s.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                                  {s.mode === 'continuous'
                                    ? <><InfinityIcon size={9} className="inline mr-0.5" />Continuous</>
                                    : <><Timer size={9} className="inline mr-0.5" />{s.on_seconds}s / {s.interval_seconds}s</>
                                  }
                                </span>
                                {s.priority > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">P{s.priority}</span>
                                )}
                              </div>
                              {s.mode === 'duty_cycle' && s.enabled && (
                                <DutyCycleBar interval={s.interval_seconds} onTime={s.on_seconds} />
                              )}
                              {(s.grow_name || s.phase_name) && (
                                <div className="text-[10px] text-gray-500 mt-1">
                                  Bound to: {s.grow_name}{s.phase_name && ` / ${s.phase_name}`}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEdit(s)} className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
