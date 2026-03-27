import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { Camera, CaptureSchedule, Grow, Media } from '../types';
import { Camera as CameraIcon, Plus, Trash2, Clock, Power, PowerOff, Image, ChevronRight } from 'lucide-react';

export function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [grows, setGrows] = useState<Grow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editCamera, setEditCamera] = useState<Camera | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [schedules, setSchedules] = useState<CaptureSchedule[]>([]);
  const [recentCaptures, setRecentCaptures] = useState<Media[]>([]);
  const [scheduleForm, setScheduleForm] = useState(false);

  const [form, setForm] = useState({
    name: '', type: 'ip' as Camera['type'], url: '', device_index: 0,
    resolution_w: 1920, resolution_h: 1080,
  });
  const [schedFormData, setSchedFormData] = useState({
    grow_id: '', interval_seconds: 3600, enabled: 1,
  });

  const load = useCallback(async () => {
    try {
      const [c, g] = await Promise.all([api.cameras.list(), api.grows.list()]);
      setCameras(c);
      setGrows(g);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCameraDetail = useCallback(async (camera: Camera) => {
    setSelectedCamera(camera);
    const [s, m] = await Promise.all([
      api.cameras.schedules(camera.id),
      api.media.list({ camera_id: camera.id, limit: '20' }),
    ]);
    setSchedules(s);
    setRecentCaptures(m);
  }, []);

  const handleSave = async () => {
    try {
      if (editCamera) {
        await api.cameras.update(editCamera.id, { ...form, enabled: editCamera.enabled });
      } else {
        await api.cameras.create(form);
      }
      setShowForm(false);
      setEditCamera(null);
      setForm({ name: '', type: 'ip', url: '', device_index: 0, resolution_w: 1920, resolution_h: 1080 });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this camera and all its schedules?')) return;
    await api.cameras.delete(id);
    if (selectedCamera?.id === id) setSelectedCamera(null);
    load();
  };

  const handleAddSchedule = async () => {
    if (!selectedCamera) return;
    await api.cameras.createSchedule(selectedCamera.id, {
      grow_id: schedFormData.grow_id || undefined,
      interval_seconds: schedFormData.interval_seconds,
      enabled: schedFormData.enabled,
    });
    setScheduleForm(false);
    setSchedFormData({ grow_id: '', interval_seconds: 3600, enabled: 1 });
    loadCameraDetail(selectedCamera);
  };

  const handleToggleSchedule = async (sched: CaptureSchedule) => {
    await api.cameras.updateSchedule(sched.id, {
      interval_seconds: sched.interval_seconds,
      enabled: sched.enabled ? 0 : 1,
      grow_id: sched.grow_id,
    });
    if (selectedCamera) loadCameraDetail(selectedCamera);
  };

  const handleDeleteSchedule = async (id: string) => {
    await api.cameras.deleteSchedule(id);
    if (selectedCamera) loadCameraDetail(selectedCamera);
  };

  const formatInterval = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
    return `${(s / 86400).toFixed(1)}d`;
  };

  const openEdit = (camera: Camera) => {
    setEditCamera(camera);
    setForm({
      name: camera.name, type: camera.type, url: camera.url || '',
      device_index: camera.device_index ?? 0,
      resolution_w: camera.resolution_w, resolution_h: camera.resolution_h,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CameraIcon className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-gray-100">Cameras</h2>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditCamera(null); setForm({ name: '', type: 'ip', url: '', device_index: 0, resolution_w: 1920, resolution_h: 1080 }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors"
        >
          <Plus size={14} /> Add Camera
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">{editCamera ? 'Edit Camera' : 'New Camera'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" placeholder="Grow Chamber Cam" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Camera['type'] })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                <option value="ip">IP Camera (HTTP snapshot)</option>
                <option value="rtsp">RTSP Stream</option>
                <option value="mjpeg">MJPEG Stream</option>
                <option value="usb">USB Webcam (v4l2)</option>
              </select>
            </div>
            {form.type !== 'usb' ? (
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 block mb-1">URL</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono"
                  placeholder="rtsp://192.168.1.100:554/stream1" />
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Device Index</label>
                <input type="number" value={form.device_index} onChange={(e) => setForm({ ...form, device_index: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Resolution</label>
              <div className="flex gap-2">
                <input type="number" value={form.resolution_w} onChange={(e) => setForm({ ...form, resolution_w: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" placeholder="1920" />
                <span className="self-center text-gray-500">x</span>
                <input type="number" value={form.resolution_h} onChange={(e) => setForm({ ...form, resolution_h: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" placeholder="1080" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditCamera(null); }}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={!form.name}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors disabled:opacity-40">
              {editCamera ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Camera list */}
        <div className="space-y-2">
          {cameras.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">No cameras configured</div>
          ) : cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => loadCameraDetail(cam)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selectedCamera?.id === cam.id
                  ? 'bg-emerald-950/30 border-emerald-800'
                  : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CameraIcon size={14} className={cam.enabled ? 'text-emerald-400' : 'text-gray-600'} />
                  <span className="text-sm text-gray-200">{cam.name}</span>
                </div>
                <ChevronRight size={14} className="text-gray-600" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                  cam.type === 'usb' ? 'bg-blue-500/20 text-blue-400' :
                  cam.type === 'rtsp' ? 'bg-purple-500/20 text-purple-400' :
                  cam.type === 'mjpeg' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-cyan-500/20 text-cyan-400'
                }`}>{cam.type}</span>
                <span className="text-[10px] text-gray-600">{cam.resolution_w}x{cam.resolution_h}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Camera detail panel */}
        {selectedCamera && (
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-200">{selectedCamera.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(selectedCamera)} className="text-xs text-gray-400 hover:text-gray-200">Edit</button>
                  <button onClick={() => handleDelete(selectedCamera.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Type: <span className="text-gray-400">{selectedCamera.type}</span></div>
                {selectedCamera.url && <div>URL: <span className="text-gray-400 font-mono">{selectedCamera.url}</span></div>}
                {selectedCamera.type === 'usb' && <div>Device: <span className="text-gray-400">/dev/video{selectedCamera.device_index}</span></div>}
              </div>
            </div>

            {/* Schedules */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-emerald-500" />
                  <h3 className="text-sm font-medium text-gray-200">Capture Schedules</h3>
                </div>
                <button onClick={() => setScheduleForm(true)} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                  <Plus size={12} /> Add
                </button>
              </div>

              {scheduleForm && (
                <div className="border border-gray-700 rounded-lg p-3 mb-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Interval (seconds)</label>
                      <input type="number" value={schedFormData.interval_seconds}
                        onChange={(e) => setSchedFormData({ ...schedFormData, interval_seconds: parseInt(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Link to Grow</label>
                      <select value={schedFormData.grow_id}
                        onChange={(e) => setSchedFormData({ ...schedFormData, grow_id: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">
                        <option value="">None</option>
                        {grows.filter((g) => g.status === 'active').map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setScheduleForm(false)} className="text-xs text-gray-400">Cancel</button>
                    <button onClick={handleAddSchedule} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs">Create</button>
                  </div>
                </div>
              )}

              {schedules.length === 0 ? (
                <p className="text-xs text-gray-600">No schedules configured</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <div>
                        <span className="text-sm text-gray-300">Every {formatInterval(s.interval_seconds)}</span>
                        {s.grow_id && <span className="text-xs text-gray-500 ml-2">(linked to grow)</span>}
                        {s.last_capture_at && (
                          <div className="text-[10px] text-gray-600">Last: {new Date(s.last_capture_at).toLocaleString()}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleSchedule(s)} className={s.enabled ? 'text-emerald-400' : 'text-gray-600'}>
                          {s.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                        </button>
                        <button onClick={() => handleDeleteSchedule(s.id)} className="text-gray-600 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent captures */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Image size={14} className="text-emerald-500" />
                <h3 className="text-sm font-medium text-gray-200">Recent Captures</h3>
              </div>
              {recentCaptures.length === 0 ? (
                <p className="text-xs text-gray-600">No captures yet</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {recentCaptures.map((m) => (
                    <div key={m.id} className="aspect-square bg-gray-800 rounded-lg overflow-hidden relative group">
                      <img src={api.media.fileUrl(m.id)} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] text-gray-300">{new Date(m.captured_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
