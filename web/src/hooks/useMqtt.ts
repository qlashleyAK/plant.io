import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { useSensorStore } from '../stores/sensorStore';

function getMqttUrl() {
  if (import.meta.env.VITE_MQTT_WS_URL) return import.meta.env.VITE_MQTT_WS_URL;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/mqtt`;
}
const MQTT_WS_URL = getMqttUrl();

export function useMqtt() {
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const { updateLiveValue, setConnected, registerDiscovery } = useSensorStore();

  useEffect(() => {
    const client = mqtt.connect(MQTT_WS_URL, {
      clientId: `pio-web-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 3000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      console.log('[MQTT] WebSocket connected');
      setConnected(true);
      client.subscribe('airoponic/telemetry/#');
      client.subscribe('pio/discovery/#');
      client.subscribe('pio/status/#');
      client.subscribe('pio/notifications');
    });

    client.on('message', (topic, payload) => {
      const message = payload.toString();

      if (topic.startsWith('pio/discovery/')) {
        try {
          registerDiscovery(JSON.parse(message));
        } catch { /* skip malformed */ }
      } else if (topic.startsWith('airoponic/telemetry/')) {
        updateLiveValue(topic, message);
      }
    });

    client.on('close', () => setConnected(false));
    client.on('error', (err) => console.error('[MQTT] Error:', err));

    return () => {
      client.end(true);
      clientRef.current = null;
    };
  }, [updateLiveValue, setConnected, registerDiscovery]);

  return clientRef;
}
