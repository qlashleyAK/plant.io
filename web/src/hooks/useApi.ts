const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  sensors: {
    list: () => request<any[]>('/sensors'),
    get: (id: string) => request<any>(`/sensors/${id}`),
    command: (id: string, state: boolean) =>
      request<any>(`/actuators/${id}/command`, { method: 'POST', body: JSON.stringify({ state }) }),
    telemetry: (id: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/sensors/${id}/telemetry${qs}`);
    },
  },
  grows: {
    list: () => request<any[]>('/grows'),
    get: (id: string) => request<any>(`/grows/${id}`),
    create: (data: any) => request<any>('/grows', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/grows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/grows/${id}`, { method: 'DELETE' }),
    addPhase: (growId: string, data: any) => request<any>(`/grows/${growId}/phases`, { method: 'POST', body: JSON.stringify(data) }),
    updatePhase: (growId: string, phaseId: string, data: any) =>
      request<any>(`/grows/${growId}/phases/${phaseId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePhase: (growId: string, phaseId: string) =>
      request<void>(`/grows/${growId}/phases/${phaseId}`, { method: 'DELETE' }),
    addTemplate: (growId: string, phaseId: string, data: any) =>
      request<any>(`/grows/${growId}/phases/${phaseId}/templates`, { method: 'POST', body: JSON.stringify(data) }),
    updateTemplate: (growId: string, templateId: string, data: any) =>
      request<any>(`/grows/${growId}/templates/${templateId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTemplate: (growId: string, templateId: string) =>
      request<void>(`/grows/${growId}/templates/${templateId}`, { method: 'DELETE' }),
    generateTimepoints: (growId: string, opts?: any) =>
      request<any>(`/grows/${growId}/generate-timepoints`, { method: 'POST', body: JSON.stringify(opts || {}) }),
    defaultProtocol: (growId: string) =>
      request<any>(`/grows/${growId}/default-protocol`, { method: 'POST' }),
  },
  timepoints: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/timepoints${qs}`);
    },
    get: (id: string) => request<any>(`/timepoints/${id}`),
    create: (data: any) => request<any>('/timepoints', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/timepoints/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/timepoints/${id}`, { method: 'DELETE' }),
    addData: (id: string, data: any) => request<any[]>(`/timepoints/${id}/data`, { method: 'POST', body: JSON.stringify(data) }),
  },
  media: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/media${qs}`);
    },
    upload: async (files: FileList, meta?: Record<string, string>) => {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append('files', f));
      if (meta) Object.entries(meta).forEach(([k, v]) => form.append(k, v));
      const res = await fetch(`${API_BASE}/media/upload`, { method: 'POST', body: form });
      return res.json();
    },
    delete: (id: string) => request<void>(`/media/${id}`, { method: 'DELETE' }),
    fileUrl: (id: string) => `${API_BASE}/media/${id}/file`,
    presignedUrl: (id: string) => request<{ url: string }>(`/media/${id}/url`),
  },
  cameras: {
    list: () => request<any[]>('/cameras'),
    create: (data: any) => request<any>('/cameras', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/cameras/${id}`, { method: 'DELETE' }),
    schedules: (cameraId: string) => request<any[]>(`/cameras/${cameraId}/schedules`),
    createSchedule: (cameraId: string, data: any) =>
      request<any>(`/cameras/${cameraId}/schedules`, { method: 'POST', body: JSON.stringify(data) }),
    updateSchedule: (scheduleId: string, data: any) =>
      request<any>(`/cameras/schedules/${scheduleId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSchedule: (scheduleId: string) => request<void>(`/cameras/schedules/${scheduleId}`, { method: 'DELETE' }),
  },
  analytics: {
    grow: (growId: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/analytics/grow/${growId}${qs}`);
    },
    history: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/analytics/history${qs}`);
    },
  },
  exports: {
    list: () => request<any[]>('/exports'),
    create: (data: any) => request<any>('/exports', { method: 'POST', body: JSON.stringify(data) }),
    downloadUrl: (id: string) => request<{ url: string }>(`/exports/${id}/download`),
  },
  automations: {
    list: () => request<any[]>('/automations'),
    get: (id: string) => request<any>(`/automations/${id}`),
    create: (data: any) => request<any>('/automations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/automations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/automations/${id}`, { method: 'DELETE' }),
  },
  schedules: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/schedules${qs}`);
    },
    get: (id: string) => request<any>(`/schedules/${id}`),
    create: (data: any) => request<any>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/schedules/${id}`, { method: 'DELETE' }),
    toggle: (id: string) => request<any>(`/schedules/${id}/toggle`, { method: 'POST' }),
  },
  ai: {
    status: () => request<any>('/ai/status'),
    analyze: (mediaId: string, prompt: string, model?: string) =>
      request<any>('/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({ mediaId, prompt, ...(model ? { model } : {}) }),
      }),
    notebook: (growId: string, prompt: string, mode: 'analyze' | 'generate' | 'chat' = 'chat', model?: string) =>
      request<any>('/ai/notebook', {
        method: 'POST',
        body: JSON.stringify({ growId, prompt, mode, ...(model ? { model } : {}) }),
      }),
  },
  notifications: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/notifications${qs}`);
    },
    count: () => request<{ count: number }>('/notifications/count'),
    markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request<any>('/notifications/read-all', { method: 'PUT' }),
    dismiss: (id: string) => request<any>(`/notifications/${id}/dismiss`, { method: 'PUT' }),
    dismissAll: () => request<any>('/notifications/dismiss-all', { method: 'PUT' }),
  },
};
