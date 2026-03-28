import { useAuthStore } from './useAuth';
import { getServerUrl } from '../config';

let cachedBaseUrl: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (!cachedBaseUrl) {
    cachedBaseUrl = await getServerUrl();
  }
  return `${cachedBaseUrl}/api`;
}

export function resetBaseUrlCache() {
  cachedBaseUrl = null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = await getBaseUrl();
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${base}${path}`, {
    headers,
    ...options,
    ...(options?.headers ? { headers: { ...headers, ...(options.headers as Record<string, string>) } } : {}),
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function uploadFiles(uri: string, meta?: Record<string, string>): Promise<any> {
  const base = await getBaseUrl();
  const token = useAuthStore.getState().token;
  const form = new FormData();

  const filename = uri.split('/').pop() || 'photo.jpg';
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : ext === 'mp4' ? 'video/mp4' : 'image/jpeg';

  form.append('files', { uri, name: filename, type: mimeType } as any);
  if (meta) Object.entries(meta).forEach(([k, v]) => form.append(k, v));

  const res = await fetch(`${base}/media/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
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
    upload: (uri: string, meta?: Record<string, string>) => uploadFiles(uri, meta),
    delete: (id: string) => request<void>(`/media/${id}`, { method: 'DELETE' }),
    fileUrl: async (id: string) => `${await getBaseUrl()}/media/${id}/file`,
    presignedUrl: (id: string) => request<{ url: string }>(`/media/${id}/url`),
  },
  cameras: {
    list: () => request<any[]>('/cameras'),
    create: (data: any) => request<any>('/cameras', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/cameras/${id}`, { method: 'DELETE' }),
  },
  analytics: {
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
  push: {
    register: (token: string, platform: string) =>
      request<any>('/push/register', { method: 'POST', body: JSON.stringify({ token, platform }) }),
    unregister: (token: string) =>
      request<any>('/push/unregister', { method: 'DELETE', body: JSON.stringify({ token }) }),
  },
  health: () => request<any>('/health'),
};
