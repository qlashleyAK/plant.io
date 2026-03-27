import { useState, useEffect } from 'react';
import { api } from '../hooks/useApi';
import type { ExportJob, Grow } from '../types';
import { Database, Download, Loader, CheckCircle, XCircle, FileSpreadsheet, FileText, Image } from 'lucide-react';

const TYPE_CONFIG: Record<string, { label: string; icon: typeof FileSpreadsheet; desc: string }> = {
  telemetry_csv: { label: 'Telemetry CSV', icon: FileSpreadsheet, desc: 'Sensor readings with timestamps, suitable for time-series analysis' },
  full_dataset: { label: 'Full Dataset', icon: FileText, desc: 'Combined telemetry + timepoint data for comprehensive analysis' },
  media_manifest: { label: 'Media Manifest', icon: Image, desc: 'Image/video inventory with S3 keys for ML pipeline consumption' },
};

export function ExportsPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [grows, setGrows] = useState<Grow[]>([]);
  const [exportType, setExportType] = useState('telemetry_csv');
  const [growId, setGrowId] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.exports.list().then(setJobs).catch(console.error);
    api.grows.list().then(setGrows).catch(console.error);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const job = await api.exports.create({ type: exportType, grow_id: growId || undefined });
      setJobs((prev) => [job, ...prev]);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setExporting(false);
  };

  const handleDownload = async (jobId: string) => {
    try {
      const { url } = await api.exports.downloadUrl(jobId);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-emerald-400" />;
      case 'failed': return <XCircle size={14} className="text-red-400" />;
      case 'running': return <Loader size={14} className="text-yellow-400 animate-spin" />;
      default: return <Loader size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="w-5 h-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-gray-100">Data Export</h2>
      </div>

      {/* Export creation */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-300">Create Export</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(TYPE_CONFIG).map(([key, { label, icon: Icon, desc }]) => (
            <button
              key={key}
              onClick={() => setExportType(key)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                exportType === key
                  ? 'bg-emerald-950/30 border-emerald-800'
                  : 'bg-gray-800/50 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} className={exportType === key ? 'text-emerald-400' : 'text-gray-500'} />
                <span className="text-sm text-gray-200">{label}</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Scope to Grow (optional)</label>
            <select value={growId} onChange={(e) => setGrowId(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 min-w-[200px]">
              <option value="">All data</option>
              {grows.map((g) => (
                <option key={g.id} value={g.id}>{g.name} ({g.status})</option>
              ))}
            </select>
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors disabled:opacity-40">
            {exporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting...' : 'Generate Export'}
          </button>
        </div>
      </div>

      {/* Export history */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-300">Export History</h3>
        </div>
        {jobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-600">No exports yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Type</th>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Rows</th>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Created</th>
                <th className="text-right px-4 py-2 text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-2 text-gray-300">{TYPE_CONFIG[job.type]?.label || job.type}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(job.status)}
                      <span className="text-gray-400">{job.status}</span>
                    </div>
                    {job.error && <div className="text-[10px] text-red-400 mt-0.5">{job.error}</div>}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{job.row_count?.toLocaleString() || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    {job.status === 'completed' && job.s3_key && (
                      <button onClick={() => handleDownload(job.id)} className="text-emerald-400 hover:text-emerald-300">
                        <Download size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
