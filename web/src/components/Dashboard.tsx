import { useEffect, useState } from 'react';
import { useSensorStore } from '../stores/sensorStore';
import { SensorGauge } from './SensorGauge';
import { ActuatorTile } from './ActuatorTile';
import { TimeSeriesChart } from './TimeSeriesChart';
import { api } from '../hooks/useApi';
import type { Sensor } from '../types';
import { Activity, Wifi, WifiOff } from 'lucide-react';

export function Dashboard() {
  const { sensors, setSensors, connected } = useSensorStore();
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [chartSensors, setChartSensors] = useState<Sensor[]>([]);

  useEffect(() => {
    api.sensors.list().then(setSensors).catch(console.error);
    const interval = setInterval(() => {
      api.sensors.list().then(setSensors).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [setSensors]);

  const sensorList = Array.from(sensors.values()).filter((s) => s.type === 'sensor');
  const actuatorList = Array.from(sensors.values()).filter((s) => s.type === 'actuator');

  const handleGaugeClick = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    if (!chartSensors.find((s) => s.id === sensor.id)) {
      setChartSensors((prev) => [...prev.slice(-3), sensor]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-gray-100">Live Telemetry</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
          connected ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'
        }`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'MQTT Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Sensor Gauges */}
      {sensorList.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Sensors</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sensorList.map((sensor) => (
              <SensorGauge
                key={sensor.id}
                sensor={sensor}
                onClick={() => handleGaugeClick(sensor)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Actuator Tiles */}
      {actuatorList.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Actuators</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {actuatorList.map((sensor) => (
              <ActuatorTile key={sensor.id} sensor={sensor} onClick={() => handleGaugeClick(sensor)} />
            ))}
          </div>
        </section>
      )}

      {/* Charts */}
      {chartSensors.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Charts</h3>
            <button
              onClick={() => setChartSensors([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chartSensors.map((sensor) => (
              <TimeSeriesChart key={sensor.id} sensor={sensor} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {sensorList.length === 0 && actuatorList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-gray-700" />
          </div>
          <h3 className="text-lg font-medium text-gray-400 mb-2">Waiting for sensors</h3>
          <p className="text-sm text-gray-600 max-w-md">
            No sensors discovered yet. Make sure Node-RED is running and publishing
            discovery messages to <code className="text-emerald-600">pio/discovery/#</code>
          </p>
        </div>
      )}
    </div>
  );
}
