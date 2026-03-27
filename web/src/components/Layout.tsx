import { useState } from 'react';
import { Activity, Sprout, Settings, Menu, Leaf, History, Camera, Database, Zap, Power, CalendarClock, LogOut } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface Props {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'controls', label: 'Controls', icon: Power },
  { id: 'schedules', label: 'Schedules', icon: CalendarClock },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'grows', label: 'Lab Notebook', icon: Sprout },
  { id: 'history', label: 'History', icon: History },
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'exports', label: 'Data Export', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Layout({ children, currentPage, onNavigate }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen w-56 bg-gray-950 border-r border-gray-800
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600/20">
              <Leaf size={16} className="text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-gray-100 tracking-tight">plant.io</span>
          </div>
          <NotificationBell />
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${currentPage === item.id
                  ? 'bg-emerald-600/10 text-emerald-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                }
              `}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-800 space-y-2">
          <a
            href="/nodered/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Node-RED Editor
          </a>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              window.location.href = '/login.html';
            }}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800 lg:hidden">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-200">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 ml-3">
              <Leaf size={16} className="text-emerald-400" />
              <span className="text-sm font-semibold text-gray-100">plant.io</span>
            </div>
          </div>
          <NotificationBell />
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
