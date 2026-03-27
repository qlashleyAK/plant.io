import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../hooks/useApi';
import type { GrowDetail as GrowDetailType, Timepoint, ProtocolPhase, TimepointTemplate, CheckField } from '../types';
import { TimepointEntry } from './TimepointEntry';
import { MediaGallery } from './MediaGallery';
import {
  ArrowLeft, Plus, Clock, CheckCircle2, Circle, FlaskConical,
  Camera, Leaf, Scissors, Eye, ListChecks, Wand2, Trash2, ChevronDown, ChevronUp, AlertTriangle,
  Sparkles, Send, Loader2, TrendingUp, FileText, MessageCircle,
} from 'lucide-react';

const PAGE_SIZE = 30;

const TYPE_ICONS: Record<string, any> = {
  observation: Eye, measurement: FlaskConical, task: ListChecks,
  feeding: Leaf, harvest: Scissors, photo: Camera,
};
const TYPE_COLORS: Record<string, string> = {
  observation: 'text-blue-400', measurement: 'text-purple-400', task: 'text-yellow-400',
  feeding: 'text-emerald-400', harvest: 'text-orange-400', photo: 'text-pink-400',
};
const STATUS_BG: Record<string, string> = {
  pending: 'bg-gray-800', completed: 'bg-emerald-900', overdue: 'bg-red-900/50', skipped: 'bg-gray-800/50',
};

interface Props { growId: string; onBack: () => void; }

export function GrowDetail({ growId, onBack }: Props) {
  const [grow, setGrow] = useState<GrowDetailType | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'protocol' | 'media' | 'ai'>('protocol');
  const [selectedTp, setSelectedTp] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [showTplForm, setShowTplForm] = useState<string | null>(null);
  const [tlFilter, setTlFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('pending');
  const [tlVisible, setTlVisible] = useState(PAGE_SIZE);

  const [phaseForm, setPhaseForm] = useState({ name: '', start_day: 0, end_day: '', description: '', check_times: '09:00' });
  const [tplForm, setTplForm] = useState({ title: '', type: 'measurement', description: '', checks: [] as CheckField[] });

  const load = useCallback(() => { api.grows.get(growId).then(setGrow).catch(console.error); }, [growId]);
  useEffect(() => { load(); }, [load]);

  if (!grow) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (selectedTp) return <TimepointEntry timepointId={selectedTp} onBack={() => { setSelectedTp(null); load(); }} />;

  const phaseTemplates = (phaseId: string) => (grow.templates || []).filter((t) => t.phase_id === phaseId);

  const addPhase = async () => {
    const times = phaseForm.check_times.split(',').map((t) => t.trim()).filter(Boolean);
    await api.grows.addPhase(growId, {
      ...phaseForm, end_day: phaseForm.end_day ? parseInt(phaseForm.end_day) : null,
      order_index: grow.phases.length, check_times: times, check_cadence_hours: 24 / times.length,
    });
    setShowPhaseForm(false);
    setPhaseForm({ name: '', start_day: 0, end_day: '', description: '', check_times: '09:00' });
    load();
  };

  const addTemplate = async (phaseId: string) => {
    await api.grows.addTemplate(growId, phaseId, {
      title: tplForm.title, type: tplForm.type, description: tplForm.description || undefined,
      required_checks: tplForm.checks, order_index: phaseTemplates(phaseId).length,
    });
    setShowTplForm(null);
    setTplForm({ title: '', type: 'measurement', description: '', checks: [] });
    load();
  };

  const deleteTemplate = async (tplId: string) => {
    await api.grows.deleteTemplate(growId, tplId);
    load();
  };

  const deletePhase = async (phaseId: string) => {
    if (!confirm('Delete this phase and all its templates?')) return;
    await api.grows.deletePhase(growId, phaseId);
    load();
  };

  const handleDefaultProtocol = async () => {
    if (grow.phases.length > 0 && !confirm('This will add default phases alongside existing ones. Continue?')) return;
    await api.grows.defaultProtocol(growId);
    load();
  };

  const handleGenerate = async () => {
    const result = await api.grows.generateTimepoints(growId, { clear_pending: true });
    alert(`Generated ${result.generated} timepoints from protocol templates`);
    load();
  };

  const updateTpStatus = async (tp: Timepoint, status: string) => {
    await api.timepoints.update(tp.id, { ...tp, status });
    load();
  };

  const addCheckField = () => {
    setTplForm({ ...tplForm, checks: [...tplForm.checks, { field_name: '', field_type: 'number', unit: '' }] });
  };
  const updateCheck = (idx: number, upd: Partial<CheckField>) => {
    const checks = [...tplForm.checks];
    checks[idx] = { ...checks[idx], ...upd };
    setTplForm({ ...tplForm, checks });
  };
  const removeCheck = (idx: number) => {
    setTplForm({ ...tplForm, checks: tplForm.checks.filter((_, i) => i !== idx) });
  };

  const pendingCount = grow.timepoints.filter((t) => t.status === 'pending' || t.status === 'overdue').length;
  const completedCount = grow.timepoints.filter((t) => t.status === 'completed').length;

  const tabs = [
    { id: 'protocol' as const, label: 'Protocol' },
    { id: 'timeline' as const, label: `Timeline (${pendingCount} pending)` },
    { id: 'media' as const, label: 'Media' },
    { id: 'ai' as const, label: 'AI Assistant' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-100">{grow.name}</h2>
          <p className="text-xs text-gray-500">
            {grow.strain && `${grow.strain} · `}Started {new Date(grow.start_date).toLocaleDateString()}
            {` · ${completedCount}/${grow.timepoints.length} timepoints done`}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-800 pb-px">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id ? 'text-emerald-400 border-b-2 border-emerald-500 -mb-px' : 'text-gray-500 hover:text-gray-300'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* ===== PROTOCOL TAB ===== */}
      {activeTab === 'protocol' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={handleDefaultProtocol}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
              <Wand2 size={14} /> Default Protocol
            </button>
            <button onClick={() => setShowPhaseForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm">
              <Plus size={14} /> Add Phase
            </button>
            {grow.phases.length > 0 && (grow.templates || []).length > 0 && (
              <button onClick={handleGenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">
                <Wand2 size={14} /> Generate Timepoints
              </button>
            )}
          </div>

          {showPhaseForm && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-300">New Phase</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input placeholder="Phase name" value={phaseForm.name} onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
                <input type="number" placeholder="Start day" value={phaseForm.start_day} onChange={(e) => setPhaseForm({ ...phaseForm, start_day: parseInt(e.target.value) || 0 })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
                <input type="number" placeholder="End day" value={phaseForm.end_day} onChange={(e) => setPhaseForm({ ...phaseForm, end_day: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
                <div>
                  <input placeholder="Check times (e.g. 09:00,21:00)" value={phaseForm.check_times}
                    onChange={(e) => setPhaseForm({ ...phaseForm, check_times: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
                </div>
              </div>
              <textarea placeholder="Description" value={phaseForm.description} onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" rows={2} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowPhaseForm(false)} className="px-3 py-1.5 text-sm text-gray-400">Cancel</button>
                <button onClick={addPhase} disabled={!phaseForm.name} className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-40">Add Phase</button>
              </div>
            </div>
          )}

          {grow.phases.length === 0 ? (
            <div className="text-center py-12">
              <FlaskConical className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500">No protocol defined. Use "Default Protocol" for a standard aeroponic schedule, or add custom phases.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grow.phases.map((phase, i) => {
                const tpls = phaseTemplates(phase.id);
                const expanded = expandedPhase === phase.id;
                let checkTimes: string[] = [];
                try { checkTimes = JSON.parse(phase.check_times); } catch {}

                return (
                  <div key={phase.id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedPhase(expanded ? null : phase.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-500 text-xs font-medium">Phase {i + 1}</span>
                          <span className="text-sm font-medium text-gray-200">{phase.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>Day {phase.start_day}{phase.end_day ? `–${phase.end_day}` : '+'}</span>
                          <span>{checkTimes.length}x daily ({checkTimes.join(', ')})</span>
                          <span>{tpls.length} template{tpls.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); deletePhase(phase.id); }} className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                        {expanded ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-4 pb-4 border-t border-gray-800/50 pt-3 space-y-3">
                        {phase.description && <p className="text-xs text-gray-500">{phase.description}</p>}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 uppercase tracking-wider">Timepoint Templates</span>
                          <button onClick={() => { setShowTplForm(phase.id); setTplForm({ title: '', type: 'measurement', description: '', checks: [] }); }}
                            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                            <Plus size={10} /> Add Template
                          </button>
                        </div>

                        {showTplForm === phase.id && (
                          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <input placeholder="Title (e.g. Daily Check)" value={tplForm.title}
                                onChange={(e) => setTplForm({ ...tplForm, title: e.target.value })}
                                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200" />
                              <select value={tplForm.type} onChange={(e) => setTplForm({ ...tplForm, type: e.target.value })}
                                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200">
                                <option value="measurement">Measurement</option>
                                <option value="observation">Observation</option>
                                <option value="task">Task</option>
                                <option value="feeding">Feeding</option>
                                <option value="photo">Photo</option>
                              </select>
                            </div>
                            <input placeholder="Description" value={tplForm.description}
                              onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })}
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200" />

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] text-gray-500 uppercase">Required Checks</span>
                                <button onClick={addCheckField} className="text-[10px] text-emerald-400 hover:text-emerald-300">+ Add check</button>
                              </div>
                              {tplForm.checks.map((ck, ci) => (
                                <div key={ci} className="flex gap-1.5 mb-1.5">
                                  <input placeholder="Field name (e.g. pH)" value={ck.field_name}
                                    onChange={(e) => updateCheck(ci, { field_name: e.target.value })}
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200" />
                                  <select value={ck.field_type} onChange={(e) => updateCheck(ci, { field_type: e.target.value as any })}
                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200 w-24">
                                    <option value="number">Number</option>
                                    <option value="text">Text</option>
                                    <option value="boolean">Yes/No</option>
                                    <option value="photo">Photo</option>
                                  </select>
                                  <input placeholder="Unit" value={ck.unit}
                                    onChange={(e) => updateCheck(ci, { unit: e.target.value })}
                                    className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200" />
                                  <button onClick={() => removeCheck(ci)} className="text-gray-600 hover:text-red-400"><Trash2 size={10} /></button>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setShowTplForm(null)} className="text-xs text-gray-400">Cancel</button>
                              <button onClick={() => addTemplate(phase.id)} disabled={!tplForm.title}
                                className="px-3 py-1 bg-emerald-600 text-white rounded text-xs disabled:opacity-40">Add</button>
                            </div>
                          </div>
                        )}

                        {tpls.length === 0 ? (
                          <p className="text-xs text-gray-600 text-center py-4">No templates yet — add one to define what checks happen at each timepoint</p>
                        ) : (
                          <div className="space-y-2">
                            {tpls.map((tpl) => {
                              let checks: CheckField[] = [];
                              try { checks = JSON.parse(tpl.required_checks); } catch {}
                              const Icon = TYPE_ICONS[tpl.type] || Circle;
                              return (
                                <div key={tpl.id} className="flex items-start gap-3 bg-gray-800/30 rounded-lg p-3">
                                  <Icon size={14} className={TYPE_COLORS[tpl.type] + ' mt-0.5'} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-200">{tpl.title}</span>
                                      <button onClick={() => deleteTemplate(tpl.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={12} /></button>
                                    </div>
                                    {tpl.description && <p className="text-[11px] text-gray-500 mt-0.5">{tpl.description}</p>}
                                    {checks.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {checks.map((ck, ci) => (
                                          <span key={ci} className="px-1.5 py-0.5 rounded bg-gray-700/50 text-[10px] text-gray-400">
                                            {ck.field_name}{ck.unit ? ` (${ck.unit})` : ''} · {ck.field_type}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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
      )}

      {/* ===== TIMELINE TAB ===== */}
      {activeTab === 'timeline' && <TimelineTab
        timepoints={grow.timepoints}
        filter={tlFilter}
        setFilter={(f) => { setTlFilter(f); setTlVisible(PAGE_SIZE); }}
        visible={tlVisible}
        showMore={() => setTlVisible((v) => v + PAGE_SIZE)}
        onSelect={setSelectedTp}
        onComplete={(tp) => updateTpStatus(tp, 'completed')}
      />}

      {activeTab === 'media' && <MediaGallery growId={growId} />}

      {activeTab === 'ai' && <NotebookAI growId={growId} growName={grow.name} />}
    </div>
  );
}

/* ===== Notebook AI assistant ===== */

interface AiMsg { role: 'user' | 'assistant'; text: string; model?: string; duration_ms?: number; context?: any; }

function NotebookAI({ growId, growName }: { growId: string; growName: string }) {
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.ai.status().then((s: any) => setAiAvailable(s.configured && s.connected)).catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (prompt: string, mode: 'analyze' | 'generate' | 'chat' = 'chat') => {
    const text = prompt.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await api.ai.notebook(growId, text, mode);
      setMessages((prev) => [...prev, {
        role: 'assistant', text: res.response, model: res.model, duration_ms: res.duration_ms, context: res.context,
      }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${err.message}` }]);
    }
    setLoading(false);
  };

  if (aiAvailable === null) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 size={18} className="animate-spin mr-2" /> Checking AI availability...
      </div>
    );
  }

  if (!aiAvailable) {
    return (
      <div className="text-center py-20">
        <Sparkles size={32} className="mx-auto text-gray-700 mb-3" />
        <p className="text-gray-500">Ollama not connected</p>
        <p className="text-xs text-gray-600 mt-1">
          Set <code className="bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">OLLAMA_HOST</code> in docker-compose.yml to enable AI features.
        </p>
      </div>
    );
  }

  const quickActions = [
    { label: 'Analyze grow status', icon: TrendingUp, mode: 'analyze' as const, prompt: 'Analyze the current state of this grow. What trends do you see in the sensor data? Are there any concerns?' },
    { label: 'Summarize progress', icon: FileText, mode: 'analyze' as const, prompt: 'Summarize the progress of this grow so far. What has been completed and what is upcoming?' },
    { label: 'Suggest next steps', icon: Wand2, mode: 'generate' as const, prompt: 'Based on the current grow state, protocol, and data, what should I focus on next? Generate specific actionable recommendations.' },
    { label: 'Check for issues', icon: AlertTriangle, mode: 'analyze' as const, prompt: 'Review the sensor data and timepoint entries for any anomalies, out-of-range values, or potential problems that need attention.' },
  ];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-purple-400" />
        <span className="text-sm text-gray-400">AI assistant for <span className="text-gray-200">{growName}</span></span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 min-h-0 mb-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Sparkles size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">Ask questions about this grow or use a quick action below</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickActions.map((a) => (
                <button key={a.label} onClick={() => send(a.prompt, a.mode)}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-purple-500/30 hover:bg-gray-800/60 text-left transition-all group">
                  <a.icon size={16} className="text-gray-600 group-hover:text-purple-400 transition-colors shrink-0" />
                  <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`${m.role === 'user' ? 'flex justify-end' : ''}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
              m.role === 'user'
                ? 'bg-purple-600/20 border border-purple-500/20 text-gray-200'
                : 'bg-gray-900/60 border border-gray-800 text-gray-300'
            }`}>
              {m.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={11} className="text-purple-400" />
                  <span className="text-[10px] text-gray-600">AI Response</span>
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.text}</div>
              {m.model && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-800/50">
                  <span className="text-[10px] text-gray-600">{m.model}</span>
                  <span className="text-[10px] text-gray-600">{((m.duration_ms || 0) / 1000).toFixed(1)}s</span>
                  {m.context && (
                    <span className="text-[10px] text-gray-600">Day {m.context.day}{m.context.phase ? ` · ${m.context.phase}` : ''}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <Loader2 size={14} className="animate-spin" /> Thinking...
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 pt-3">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this grow..."
            className="flex-1 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-colors"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl transition-colors">
            <Send size={14} />
          </button>
        </form>
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => send('What is the overall health status of this grow right now?', 'analyze')}
            disabled={loading}
            className="px-2 py-1 text-[10px] rounded-lg bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">
            <MessageCircle size={9} className="inline mr-1" />Health check
          </button>
          <button onClick={() => send('What should I log at my next timepoint?', 'generate')}
            disabled={loading}
            className="px-2 py-1 text-[10px] rounded-lg bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">
            <MessageCircle size={9} className="inline mr-1" />Next timepoint
          </button>
          <button onClick={() => send('Generate a brief progress note for the lab notebook based on recent data.', 'generate')}
            disabled={loading}
            className="px-2 py-1 text-[10px] rounded-lg bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">
            <MessageCircle size={9} className="inline mr-1" />Progress note
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Extracted timeline as a separate component to avoid re-rendering the whole tree ===== */

interface TimelineTabProps {
  timepoints: Timepoint[];
  filter: 'all' | 'pending' | 'overdue' | 'completed';
  setFilter: (f: 'all' | 'pending' | 'overdue' | 'completed') => void;
  visible: number;
  showMore: () => void;
  onSelect: (id: string) => void;
  onComplete: (tp: Timepoint) => void;
}

const FILTER_OPTS: { key: 'all' | 'pending' | 'overdue' | 'completed'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];

function TimelineTab({ timepoints, filter, setFilter, visible, showMore, onSelect, onComplete }: TimelineTabProps) {
  const counts = useMemo(() => ({
    all: timepoints.length,
    pending: timepoints.filter((t) => t.status === 'pending').length,
    overdue: timepoints.filter((t) => t.status === 'overdue').length,
    completed: timepoints.filter((t) => t.status === 'completed').length,
  }), [timepoints]);

  const filtered = useMemo(() => {
    if (filter === 'all') return timepoints;
    return timepoints.filter((t) => t.status === filter);
  }, [timepoints, filter]);

  const page = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const hasMore = filtered.length > visible;

  if (timepoints.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-10 h-10 text-gray-700 mx-auto mb-2" />
        <p className="text-gray-500">No timepoints scheduled.</p>
        <p className="text-xs text-gray-600 mt-1">Define templates in the Protocol tab, then click "Generate Timepoints".</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
              filter === f.key ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-600 py-8 text-sm">No {filter} timepoints</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">Showing {page.length} of {filtered.length}</p>
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-800" />
            <div className="space-y-2">
              {page.map((tp) => (
                <TimelineItem key={tp.id} tp={tp} onSelect={onSelect} onComplete={onComplete} />
              ))}
            </div>
          </div>
          {hasMore && (
            <div className="text-center pt-2">
              <button onClick={showMore}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                Load more ({filtered.length - visible} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TimelineItem({ tp, onSelect, onComplete }: { tp: Timepoint; onSelect: (id: string) => void; onComplete: (tp: Timepoint) => void }) {
  const Icon = TYPE_ICONS[tp.type] || Circle;
  const isOverdue = tp.status === 'overdue';

  let checks: CheckField[] = [];
  try {
    const parsed = JSON.parse(tp.required_checks);
    if (Array.isArray(parsed)) checks = parsed;
  } catch {}

  return (
    <div className="relative flex items-start gap-3 pl-3">
      <div className={`relative z-10 flex items-center justify-center w-5 h-5 rounded-full ${STATUS_BG[tp.status]}`}>
        {tp.status === 'completed'
          ? <CheckCircle2 size={14} className="text-emerald-400" />
          : isOverdue
            ? <AlertTriangle size={12} className="text-red-400" />
            : <Icon size={12} className={TYPE_COLORS[tp.type]} />
        }
      </div>
      <button onClick={() => onSelect(tp.id)}
        className={`flex-1 border rounded-xl p-3 text-left transition-all ${
          isOverdue ? 'bg-red-950/20 border-red-900/50 hover:border-red-800' : 'bg-gray-900/60 border-gray-800 hover:border-gray-600'
        }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-200">{tp.title}</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase tracking-wider ${TYPE_COLORS[tp.type]}`}>{tp.type}</span>
            {tp.status !== 'completed' && (
              <button onClick={(e) => { e.stopPropagation(); onComplete(tp); }}
                className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">Complete</button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock size={10} />
          {new Date(tp.scheduled_at).toLocaleString()}
        </div>
        {checks.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {checks.map((ck, ci) => (
              <span key={ci} className="px-1.5 py-0.5 rounded bg-gray-800/80 text-[10px] text-gray-400">
                {ck.field_name}{ck.unit ? ` (${ck.unit})` : ''}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
