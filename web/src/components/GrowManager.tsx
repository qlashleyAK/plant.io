import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { Grow, GrowDetail } from '../types';
import { GrowDetail as GrowDetailView } from './GrowDetail';
import { Plus, Sprout, Calendar, ChevronRight, Trash2, Pencil, Check, X } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-blue-500/20 text-blue-400',
  active: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-gray-500/20 text-gray-400',
  archived: 'bg-gray-800 text-gray-600',
};

export function GrowManager() {
  const [grows, setGrows] = useState<Grow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', strain: '', description: '', start_date: new Date().toISOString().slice(0, 10) });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const loadGrows = useCallback(() => {
    api.grows.list().then(setGrows).catch(console.error);
  }, []);

  useEffect(() => { loadGrows(); }, [loadGrows]);

  const handleCreate = async () => {
    await api.grows.create({ ...form, status: 'active' });
    setShowForm(false);
    setForm({ name: '', strain: '', description: '', start_date: new Date().toISOString().slice(0, 10) });
    loadGrows();
  };

  const handleDelete = async (e: React.MouseEvent, grow: Grow) => {
    e.stopPropagation();
    if (!confirm(`Delete "${grow.name}" and all its data? This cannot be undone.`)) return;
    await api.grows.delete(grow.id);
    loadGrows();
  };

  const startRename = (e: React.MouseEvent, grow: Grow) => {
    e.stopPropagation();
    setEditingId(grow.id);
    setEditName(grow.name);
  };

  const confirmRename = async (e: React.MouseEvent, grow: Grow) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    await api.grows.update(grow.id, { ...grow, name: editName.trim() });
    setEditingId(null);
    loadGrows();
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  if (selectedId) {
    return (
      <GrowDetailView
        growId={selectedId}
        onBack={() => { setSelectedId(null); loadGrows(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprout className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-gray-100">Grows</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
        >
          <Plus size={14} /> New Grow
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Grow name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
            />
            <input
              placeholder="Strain / Variety"
              value={form.strain}
              onChange={(e) => setForm({ ...form, strain: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
            />
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-emerald-600 focus:outline-none"
            />
            <textarea
              placeholder="Description / Notes"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-600 focus:outline-none md:col-span-2"
              rows={2}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
            <button onClick={handleCreate} disabled={!form.name} className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">Create</button>
          </div>
        </div>
      )}

      {grows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sprout className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-500">No grows yet. Start a new one to begin tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grows.map((grow) => (
            <div
              key={grow.id}
              onClick={() => editingId !== grow.id && setSelectedId(grow.id)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-gray-600 transition-all text-left group cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {editingId === grow.id ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename(e as any, grow);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="bg-gray-800 border border-emerald-600 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none w-48"
                      />
                      <button onClick={(e) => confirmRename(e, grow)} className="p-0.5 text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
                      <button onClick={cancelRename} className="p-0.5 text-gray-500 hover:text-gray-300"><X size={14} /></button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-100">{grow.name}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${STATUS_COLORS[grow.status]}`}>
                    {grow.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {grow.strain && <span>{grow.strain}</span>}
                  <span className="flex items-center gap-1"><Calendar size={10} />{new Date(grow.start_date).toLocaleDateString()}</span>
                  {grow.timepoint_count !== undefined && (
                    <span>{grow.completed_timepoints}/{grow.timepoint_count} timepoints</span>
                  )}
                  {grow.phase_count !== undefined && grow.phase_count > 0 && (
                    <span>{grow.phase_count} phases</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => startRename(e, grow)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors" title="Rename">
                  <Pencil size={13} />
                </button>
                <button onClick={(e) => handleDelete(e, grow)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
              <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-300 transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
