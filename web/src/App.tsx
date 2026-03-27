import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AutomationsPage } from './components/AutomationsPage';
import { ControlsPage } from './components/ControlsPage';
import { SchedulesPage } from './components/SchedulesPage';
import { GrowManager } from './components/GrowManager';
import { HistoryPage } from './components/HistoryPage';
import { CamerasPage } from './components/CamerasPage';
import { ExportsPage } from './components/ExportsPage';
import { SettingsPage } from './components/SettingsPage';
import { useMqtt } from './hooks/useMqtt';

export default function App() {
  const [page, setPage] = useState('dashboard');
  useMqtt();

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'controls' && <ControlsPage />}
      {page === 'schedules' && <SchedulesPage />}
      {page === 'automations' && <AutomationsPage />}
      {page === 'grows' && <GrowManager />}
      {page === 'history' && <HistoryPage />}
      {page === 'cameras' && <CamerasPage />}
      {page === 'exports' && <ExportsPage />}
      {page === 'settings' && <SettingsPage />}
    </Layout>
  );
}
