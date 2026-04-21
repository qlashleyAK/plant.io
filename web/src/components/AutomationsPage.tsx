import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { Sensor, Automation, AutomationAction, Camera, Grow } from '../types';
import { Zap, Plus, Trash2, Power, PowerOff, ChevronDown, ChevronUp, Bell, Radio, Camera as CameraIcon } from 'lucide-react';

const OPERATORS = [
  { value: '<', label: 'less than (<)' },
  { value: '<=', label: 'at most (<=)' },
  { value: '>', label: 'greater than (>)' },
  { value: '>=', label: 'at least (>=)' },
  { value: '==', label: 'equal to (==)' },
  { value: '!=', label: 'not equal to (!=)' },
];

export function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [grows, setGrows] = useState<Grow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const emptyForm = {
    name: '', sensor_id: '', operator: '>' as Automation['operator'],
    threshold: 0, sustained_seconds: 0, cooldown_seconds: 300,
    actions: [] as AutomationAction[], enabled: 1,
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const [a, s, c, g] = await Promise.all([
      api.automations.list(), api.sensors.list(), api.cameras.list(), api.grows.list(),
    ]);
    setAutomations(a);
    setSensors(s.filter((x: Sensor) => x.type === 'sensor'));
    setCameras(c.filter((x: Camera) => x.enabled));
    setGrows(g.filter((x: Grow) => x.status === 'active' || x.status === 'planning'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    try {
      if (editId) {
        await api.automations.update(editId, form);
      } else {
        await api.automations.create(form);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      load();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    await api.automations.delete(id);
    load();
  };

  const handleToggle = async (auto: Automation) => {
    const actions = JSON.parse(auto.actions);
    await api.automations.update(auto.id, {
      ...auto, actions, enabled: auto.enabled ? 0 : 1,
    });
    load();
  };

  const openEdit = (auto: Automation) => {
    setEditId(auto.id);
    setForm({
      name: auto.name, sensor_id: auto.sensor_id, operator: auto.operator,
      threshold: auto.threshold, sustained_seconds: auto.sustained_seconds,
      cooldown_seconds: auto.cooldown_seconds,
      actions: JSON.parse(auto.actions), enabled: auto.enabled,
    });
    setShowForm(true);
  };

  const addAction = (type: AutomationAction['type']) => {
    let action: AutomationAction;
    if (type === 'mqtt_command') action = { type: 'mqtt_command', topic: '', payload: '' };
    else if (type === 'capture') action = { type: 'capture', camera_id: cameras[0]?.id || '', grow_id: '' };
    else action = { type: 'notification', severity: 'warning', message: '' };
    setForm({ ...form, actions: [...form.actions, action] });
  };

  const updateAction = (idx: number, updates: Partial<AutomationAction>) => {
    const actions = [...form.actions];
    actions[idx] = { ...actions[idx], ...updates };
    setForm({ ...form, actions });
  };

  const removeAction = (idx: number) => {
    setForm({ ...form, actions: form.actions.filter((_, i) => i !== idx) });
  };

  const selectedSensor = sensors.find((s) => s.id === form.sensor_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-gray-100">Automations</h2>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors">
          <Plus size={14} /> New Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-gray-300">{editId ? 'Edit Automation' : 'New Automation'}</h3>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Rule Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
              placeholder="Low tank level alert" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">When sensor</label>
              <select value={form.sensor_id} onChange={(e) => setForm({ ...form, sensor_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                <option value="">Select sensor...</option>
                {sensors.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Is</label>
              <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Threshold {selectedSensor ? `(${selectedSensor.unit})` : ''}</label>
              <input type="number" step="any" value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sustained for (seconds, 0 = instant)</label>
              <input type="number" value={form.sustained_seconds}
                onChange={(e) => setForm({ ...form, sustained_seconds: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cooldown between triggers (seconds)</label>
              <input type="number" value={form.cooldown_seconds}
                onChange={(e) => setForm({ ...form, cooldown_seconds: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" />
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Actions</label>
              <div className="flex gap-2">
                <button onClick={() => addAction('mqtt_command')}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                  <Radio size={10} /> MQTT Command
                </button>
                <button onClick={() => addAction('notification')}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                  <Bell size={10} /> Notification
                </button>
                {cameras.length > 0 && (
                  <button onClick={() => addAction('capture')}
                    className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300">
                    <CameraIcon size={10} /> Capture
                  </button>
                )}
              </div>
            </div>

            {form.actions.length === 0 && (
              <p className="text-xs text-gray-600 py-3 text-center border border-dashed border-gray-800 rounded-lg">
                Add at least one action
              </p>
            )}

            <div className="space-y-2">
              {form.actions.map((action, i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${
                      action.type === 'mqtt_command' ? 'text-emerald-400' : action.type === 'capture' ? 'text-pink-400' : 'text-blue-400'
                    }`}>
                      {action.type === 'mqtt_command' ? 'MQTT Command' : action.type === 'capture' ? 'Camera Capture' : 'Notification'}
                    </span>
                    <button onClick={() => removeAction(i)} className="text-gray-600 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {action.type === 'mqtt_command' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">Topic</label>
                        <input value={action.topic || ''} onChange={(e) => updateAction(i, { topic: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 font-mono"
                          placeholder="airoponic/command/recovery_pump/set" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">Payload</label>
                        <input value={action.payload || ''} onChange={(e) => updateAction(i, { payload: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 font-mono"
                          placeholder="ON" />
                      </div>
                    </div>
                  ) : action.type === 'capture' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">Camera</label>
                        <select value={action.camera_id || ''}
                          onChange={(e) => updateAction(i, { camera_id: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200">
                          <option value="">Select camera...</option>
                          {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">Link to grow (optional)</label>
                        <select value={action.grow_id || ''}
                          onChange={(e) => updateAction(i, { grow_id: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200">
                          <option value="">None</option>
                          {grows.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">Severity</label>
                        <select value={action.severity || 'warning'}
                          onChange={(e) => updateAction(i, { severity: e.target.value as any })}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200">
                          <option value="info">Info</option>
                          <option value="warning">Warning</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Message (use {'{sensor}'}, {'{value}'})</label>
                        <input value={action.message || ''} onChange={(e) => updateAction(i, { message: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200"
                          placeholder="pH too high at {value}, add buffer solution" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
            <button onClick={handleSave} disabled={!form.name || !form.sensor_id || form.actions.length === 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors disabled:opacity-40">
              {editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Automation list */}
      {automations.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Zap className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-500">No automations configured</p>
          <p className="text-xs text-gray-600 mt-1 max-w-md">
            Create rules to automatically send commands back to Node-RED or notify you when sensor values cross thresholds
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((auto) => {
            const actions: AutomationAction[] = JSON.parse(auto.actions || '[]');
            const expanded = expandedId === auto.id;

            return (
              <div key={auto.id} className={`bg-gray-900/60 border rounded-xl transition-colors ${
                auto.enabled ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
              }`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <button onClick={() => setExpandedId(expanded ? null : auto.id)}
                    className="flex items-center gap-3 flex-1 text-left">
                    <div className={`w-2 h-2 rounded-full ${auto.enabled ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <div>
                      <div className="text-sm text-gray-200">{auto.name}</div>
                      <div className="text-xs text-gray-500">
                        {auto.sensor_name} {auto.operator} {auto.threshold}{auto.sensor_unit ? ` ${auto.sensor_unit}` : ''}
                        {auto.sustained_seconds > 0 && ` for ${auto.sustained_seconds}s`}
                        <span className="text-gray-700 mx-1.5">|</span>
                        {actions.length} action{actions.length !== 1 ? 's' : ''}
                        {auto.trigger_count > 0 && (
                          <span className="text-gray-700 mx-1.5">|</span>
                        )}
                        {auto.trigger_count > 0 && (
                          <span className="text-yellow-500/70">{auto.trigger_count}x triggered</span>
                        )}
                      </div>
                    </div>
                    {expanded ? <ChevronUp size={14} className="text-gray-600 ml-auto" /> : <ChevronDown size={14} className="text-gray-600 ml-auto" />}
                  </button>
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => handleToggle(auto)} className={auto.enabled ? 'text-emerald-400' : 'text-gray-600'}>
                      {auto.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                    </button>
                    <button onClick={() => openEdit(auto)} className="text-xs text-gray-400 hover:text-gray-200">Edit</button>
                    <button onClick={() => handleDelete(auto.id)} className="text-gray-600 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-gray-800/50 space-y-2">
                    {actions.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {a.type === 'mqtt_command' ? (
                          <>
                            <Radio size={10} className="text-emerald-400" />
                            <span className="text-gray-400">Publish</span>
                            <code className="text-emerald-300 font-mono">{a.payload}</code>
                            <span className="text-gray-400">to</span>
                            <code className="text-gray-300 font-mono">{a.topic}</code>
                          </>
                        ) : a.type === 'capture' ? (
                          <>
                            <CameraIcon size={10} className="text-pink-400" />
                            <span className="text-gray-400">Capture from</span>
                            <span className="text-pink-300">{cameras.find((c) => c.id === a.camera_id)?.name || a.camera_id}</span>
                            {a.grow_id && (
                              <>
                                <span className="text-gray-600">→</span>
                                <span className="text-gray-400">{grows.find((g) => g.id === a.grow_id)?.name || 'grow'}</span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <Bell size={10} className="text-blue-400" />
                            <span className={`px-1 py-0.5 rounded text-[10px] ${
                              a.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                              a.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>{a.severity}</span>
                            <span className="text-gray-400">{a.message || 'Default message'}</span>
                          </>
                        )}
                      </div>
                    ))}
                    {auto.last_triggered_at && (
                      <div className="text-[10px] text-gray-600 pt-1">
                        Last triggered: {new Date(auto.last_triggered_at).toLocaleString()}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600">
                      Cooldown: {auto.cooldown_seconds}s
                    </div>
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
