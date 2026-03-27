import { useState, useEffect } from 'react';
import { useSensorStore } from '../stores/sensorStore';
import { api } from '../hooks/useApi';
import { Settings, Server, Database, Radio, HardDrive, Sparkles, Loader2 } from 'lucide-react';

interface AiStatus {
  configured: boolean;
  connected?: boolean;
  host?: string;
  default_model?: string;
  text_model?: string;
  models?: Array<{ name: string; size_gb: number }>;
  error?: string;
  message?: string;
}

export function SettingsPage() {
  const { sensors, connected } = useSensorStore();
  const sensorList = Array.from(sensors.values());
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    api.ai.status()
      .then((s: AiStatus) => setAiStatus(s))
      .catch(() => setAiStatus({ configured: false, message: 'Failed to fetch status' }))
      .finally(() => setAiLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-gray-100">Settings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={16} className="text-emerald-500" />
            <h3 className="text-sm font-medium text-gray-200">MQTT Connection</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={connected ? 'text-emerald-400' : 'text-red-400'}>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">WebSocket URL</span>
              <span className="text-gray-300 font-mono text-xs">ws://{window.location.hostname}:9001</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-emerald-500" />
            <h3 className="text-sm font-medium text-gray-200">Services</h3>
          </div>
          <div className="space-y-2 text-sm">
            <a href={`http://${window.location.hostname}:1880`} target="_blank" rel="noopener noreferrer"
              className="flex justify-between hover:text-emerald-400 transition-colors">
              <span className="text-gray-500">Node-RED</span>
              <span className="text-gray-300">:1880</span>
            </a>
            <div className="flex justify-between">
              <span className="text-gray-500">API</span>
              <span className="text-gray-300">:3001</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">MQTT Broker</span>
              <span className="text-gray-300">:1883</span>
            </div>
            <a href={`http://${window.location.hostname}:9090`} target="_blank" rel="noopener noreferrer"
              className="flex justify-between hover:text-emerald-400 transition-colors">
              <span className="text-gray-500">MinIO Console</span>
              <span className="text-gray-300">:9090</span>
            </a>
            <div className="flex justify-between">
              <span className="text-gray-500">Capture Service</span>
              <span className="text-gray-300">pio-capture</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={16} className="text-emerald-500" />
            <h3 className="text-sm font-medium text-gray-200">Storage</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Object Store</span>
              <span className="text-gray-300">MinIO (S3)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bucket</span>
              <span className="text-gray-300 font-mono text-xs">plantio-media</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Database</span>
              <span className="text-gray-300 font-mono text-xs">SQLite (WAL)</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-purple-400" />
            <h3 className="text-sm font-medium text-gray-200">AI / Ollama</h3>
          </div>
          <div className="space-y-2 text-sm">
            {aiLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Checking...
              </div>
            ) : !aiStatus?.configured ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="text-gray-600">Not configured</span>
                </div>
                <p className="text-[11px] text-gray-600 mt-2">
                  Set <code className="bg-gray-800 px-1 rounded">OLLAMA_HOST</code> in docker-compose.yml
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={aiStatus.connected ? 'text-emerald-400' : 'text-red-400'}>
                    {aiStatus.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Host</span>
                  <span className="text-gray-300 font-mono text-xs">{aiStatus.host}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vision Model</span>
                  <span className="text-gray-300 font-mono text-xs">{aiStatus.default_model}</span>
                </div>
                {aiStatus.text_model && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Text Model</span>
                    <span className="text-gray-300 font-mono text-xs">{aiStatus.text_model}</span>
                  </div>
                )}
                {aiStatus.error && (
                  <p className="text-[11px] text-red-400 mt-1">{aiStatus.error}</p>
                )}
                {aiStatus.models && aiStatus.models.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <span className="text-gray-500 text-xs">Available models:</span>
                    <div className="space-y-1 mt-1">
                      {aiStatus.models.map((m) => (
                        <div key={m.name} className="flex justify-between text-xs">
                          <span className="text-gray-400 font-mono">{m.name}</span>
                          <span className="text-gray-600">{m.size_gb} GB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-emerald-500" />
            <h3 className="text-sm font-medium text-gray-200">Discovered Devices</h3>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">{sensorList.length} sensors/actuators registered</span>
          </div>
        </div>
      </div>

      {sensorList.length > 0 && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">ID</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Topic</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {sensorList.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-2 text-gray-300 font-mono text-xs">{s.id}</td>
                  <td className="px-4 py-2 text-gray-200">{s.name}</td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                      s.type === 'sensor' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{s.type}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{s.topic}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{s.last_seen ? new Date(s.last_seen).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
