import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { TimepointData, CheckField } from '../types';
import { ArrowLeft, Plus, Save, Trash2, Sparkles, Eye, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  timepointId: string;
  onBack: () => void;
}

interface EntryForm {
  field_name: string;
  field_type: string;
  value_text: string;
  value_number: string;
  unit: string;
}

function checkToEntry(ck: CheckField): EntryForm {
  return {
    field_name: ck.field_name,
    field_type: ck.field_type,
    value_text: '',
    value_number: '',
    unit: ck.unit || '',
  };
}

const EMPTY_ENTRY: EntryForm = { field_name: '', field_type: 'text', value_text: '', value_number: '', unit: '' };

export function TimepointEntry({ timepointId, onBack }: Props) {
  const [tp, setTp] = useState<any>(null);
  const [entries, setEntries] = useState<EntryForm[]>([]);
  const [existingData, setExistingData] = useState<TimepointData[]>([]);
  const [saving, setSaving] = useState(false);
  const [runningReview, setRunningReview] = useState(false);

  const load = useCallback(async () => {
    const data = await api.timepoints.get(timepointId);
    setTp(data);
    setExistingData(data.data || []);

    let checks: CheckField[] = [];
    try {
      const parsed = JSON.parse(data.required_checks || '[]');
      if (Array.isArray(parsed)) checks = parsed;
    } catch {}

    const existingFields = new Set((data.data || []).map((d: TimepointData) => d.field_name));

    const prefilled = checks
      .filter((ck) => !existingFields.has(ck.field_name))
      .map(checkToEntry);

    setEntries(prefilled.length > 0 ? prefilled : [{ ...EMPTY_ENTRY }]);
  }, [timepointId]);

  useEffect(() => { load(); }, [load]);

  const addRow = () => setEntries([...entries, { ...EMPTY_ENTRY }]);
  const removeRow = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, value: string) => {
    const updated = [...entries];
    (updated[i] as any)[field] = value;
    setEntries(updated);
  };

  const handleSave = async () => {
    const valid = entries.filter((e) => e.field_name.trim());
    if (valid.length === 0) return;

    setSaving(true);
    try {
      const payload = valid.map((e) => ({
        field_name: e.field_name,
        field_type: e.field_type,
        value_text: e.field_type !== 'number' ? e.value_text : null,
        value_number: e.field_type === 'number' ? parseFloat(e.value_number) || null : null,
        unit: e.unit || null,
      }));
      await api.timepoints.addData(timepointId, payload);
      await api.timepoints.update(timepointId, { ...tp, status: 'completed' });
      load();
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await api.media.upload(e.target.files, { timepoint_id: timepointId, grow_id: tp?.grow_id });
    load();
  };

  if (!tp) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  let requiredChecks: CheckField[] = [];
  try {
    const parsed = JSON.parse(tp.required_checks || '[]');
    if (Array.isArray(parsed)) requiredChecks = parsed;
  } catch {}
  const hasAllChecks = requiredChecks.length > 0 && requiredChecks.every((ck) => existingData.some((d) => d.field_name === ck.field_name));

  const aiData = existingData.filter((d) => d.field_name.startsWith('AI '));
  const regularData = existingData.filter((d) => !d.field_name.startsWith('AI '));
  const aiReview = aiData.find((d) => d.field_name === 'AI Review');
  const aiVisual = aiData.find((d) => d.field_name === 'AI Visual Assessment');
  const aiGaps = aiData.find((d) => d.field_name === 'AI Data Gaps');
  const hasAiConfig = tp.ai_config && (() => { try { return JSON.parse(tp.ai_config).enabled; } catch { return false; } })();

  const runAiReview = async () => {
    setRunningReview(true);
    try {
      await api.ai.review(timepointId);
      await load();
    } catch (err: any) {
      console.error('AI review failed:', err);
    }
    setRunningReview(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-100">{tp.title}</h2>
          <p className="text-xs text-gray-500">
            {tp.type} · Scheduled {new Date(tp.scheduled_at).toLocaleString()}
            {tp.description && ` · ${tp.description}`}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
          tp.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400'
            : tp.status === 'overdue' ? 'bg-red-500/20 text-red-400'
            : 'bg-gray-500/20 text-gray-400'
        }`}>{tp.status}</span>
      </div>

      {/* Required Checks Checklist */}
      {requiredChecks.length > 0 && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Required Checks</h3>
          <div className="space-y-1.5">
            {requiredChecks.map((ck, i) => {
              const filled = existingData.find((d) => d.field_name === ck.field_name);
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${filled ? 'bg-emerald-600 border-emerald-500' : 'border-gray-600'}`}>
                    {filled && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className={filled ? 'text-gray-400' : 'text-gray-200'}>{ck.field_name}</span>
                  {ck.unit && <span className="text-gray-600 text-xs">({ck.unit})</span>}
                  {filled && (
                    <span className="text-emerald-400 font-mono text-xs ml-auto">
                      {filled.value_number !== null ? filled.value_number : filled.value_text}
                      {filled.unit ? ` ${filled.unit}` : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {hasAllChecks && <p className="text-xs text-emerald-500 mt-2">All required checks complete</p>}
        </div>
      )}

      {/* AI Review Results */}
      {aiData.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" />
              <h3 className="text-sm font-medium text-purple-300">AI Review</h3>
            </div>
            <button onClick={runAiReview} disabled={runningReview}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-purple-400 hover:text-purple-300 rounded-lg hover:bg-purple-500/10 transition-colors disabled:opacity-40">
              {runningReview ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Re-run
            </button>
          </div>

          {aiGaps && (
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-medium text-yellow-400 mb-1">Data Gaps Detected</h4>
                  <p className="text-xs text-yellow-300/70 whitespace-pre-wrap">{aiGaps.value_text}</p>
                </div>
              </div>
            </div>
          )}

          {aiVisual && (
            <div className="bg-gray-900/60 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={13} className="text-purple-400" />
                <span className="text-xs font-medium text-purple-300">Visual Plant Health Assessment</span>
              </div>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{aiVisual.value_text}</div>
              <p className="text-[10px] text-gray-600 mt-2">{new Date(aiVisual.created_at).toLocaleString()}</p>
            </div>
          )}

          {aiReview && (
            <div className="bg-gray-900/60 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} className="text-purple-400" />
                <span className="text-xs font-medium text-purple-300">Comprehensive Review & Recommendations</span>
              </div>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{aiReview.value_text}</div>
              <p className="text-[10px] text-gray-600 mt-2">{new Date(aiReview.created_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Run AI Review button (when configured but not yet run) */}
      {!aiReview && hasAiConfig && (
        <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4 text-center">
          <Sparkles size={20} className="mx-auto text-purple-500/50 mb-2" />
          <p className="text-sm text-gray-400 mb-3">AI review is configured for this timepoint</p>
          <button onClick={runAiReview} disabled={runningReview}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition-colors disabled:opacity-40">
            {runningReview ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {runningReview ? 'Running AI review...' : 'Run AI Review Now'}
          </button>
        </div>
      )}

      {/* Existing Data */}
      {regularData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Recorded Data</h3>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Field</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Value</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Unit</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {regularData.map((d) => (
                  <tr key={d.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-2 text-gray-300">{d.field_name}</td>
                    <td className="px-4 py-2 text-gray-100 font-mono">{d.value_number !== null ? d.value_number : d.value_text}</td>
                    <td className="px-4 py-2 text-gray-500">{d.unit || '-'}</td>
                    <td className="px-4 py-2 text-gray-500">{new Date(d.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media uploads */}
      {tp.media?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Attached Media</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {tp.media.map((m: any) => (
              <div key={m.id} className="relative aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
                {m.mime_type.startsWith('image/') ? (
                  <img src={api.media.fileUrl(m.id)} alt={m.original_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-500">{m.original_name}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New data entry */}
      {tp.status !== 'completed' && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            {requiredChecks.length > 0 ? 'Fill in Required Checks' : 'Add Data'}
          </h3>
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input placeholder="Field name" value={entry.field_name} onChange={(e) => updateRow(i, 'field_name', e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-600 focus:outline-none" />
                <select value={entry.field_type} onChange={(e) => updateRow(i, 'field_type', e.target.value)}
                  className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-100 focus:border-emerald-600 focus:outline-none">
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes/No</option>
                </select>
                {entry.field_type === 'number' ? (<>
                  <input type="number" step="any" placeholder="Value" value={entry.value_number}
                    onChange={(e) => updateRow(i, 'value_number', e.target.value)}
                    className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-600 focus:outline-none" />
                  <input placeholder="Unit" value={entry.unit} onChange={(e) => updateRow(i, 'unit', e.target.value)}
                    className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-600 focus:outline-none" />
                </>) : (
                  <input placeholder="Value" value={entry.value_text} onChange={(e) => updateRow(i, 'value_text', e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-600 focus:outline-none" />
                )}
                {entries.length > 1 && (
                  <button onClick={() => removeRow(i)} className="p-2 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-emerald-400 transition-colors">
              <Plus size={14} /> Add field
            </button>
            <label className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
              Attach photo/video
            </label>
            <div className="flex-1" />
            <button onClick={handleSave} disabled={saving || !entries.some((e) => e.field_name.trim())}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors">
              <Save size={14} /> {saving ? 'Saving...' : 'Save & Complete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
