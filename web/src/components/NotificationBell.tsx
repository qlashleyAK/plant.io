import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../hooks/useApi';
import type { Notification } from '../types';
import { Bell, X, Check, CheckCheck, AlertTriangle, Info, AlertCircle, Clock } from 'lucide-react';

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const pollCount = useCallback(async () => {
    try {
      const { count: c } = await api.notifications.count();
      setCount(c);
    } catch {}
  }, []);

  useEffect(() => {
    pollCount();
    const interval = setInterval(pollCount, 10_000);
    return () => clearInterval(interval);
  }, [pollCount]);

  const loadNotifications = useCallback(async () => {
    try {
      const list = await api.notifications.list({ limit: '30' });
      setNotifications(list);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead();
    setCount(0);
    loadNotifications();
  };

  const handleDismissAll = async () => {
    await api.notifications.dismissAll();
    setCount(0);
    setNotifications([]);
  };

  const handleDismiss = async (id: string) => {
    await api.notifications.dismiss(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    pollCount();
  };

  const severityIcon = (sev: string) => {
    switch (sev) {
      case 'critical': return <AlertCircle size={12} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={12} className="text-yellow-400" />;
      default: return <Info size={12} className="text-blue-400" />;
    }
  };

  const typeIcon = (type: string) => {
    if (type === 'timepoint') return <Clock size={12} className="text-purple-400" />;
    return null;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-2 right-2 sm:absolute sm:left-0 sm:right-auto top-auto mt-2 w-auto sm:w-96 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-medium text-gray-200">Notifications</span>
            <div className="flex gap-2">
              {notifications.some((n) => !n.read) && (
                <button onClick={handleMarkAllRead} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  <CheckCheck size={10} /> Read all
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={handleDismissAll} className="text-xs text-gray-500 hover:text-gray-300">
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-600">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                  !n.read ? 'bg-gray-800/20' : ''
                }`}>
                  <div className="mt-0.5 flex-shrink-0">
                    {typeIcon(n.type) || severityIcon(n.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs font-medium ${!n.read ? 'text-gray-200' : 'text-gray-400'}`}>
                        {n.title}
                      </span>
                      <button onClick={() => handleDismiss(n.id)} className="text-gray-700 hover:text-gray-400 flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-1 py-0.5 rounded text-[9px] uppercase ${
                        n.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        n.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>{n.severity}</span>
                      <span className="text-[10px] text-gray-600">{formatRelative(n.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
