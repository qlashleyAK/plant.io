import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { useSensorStore } from '../stores/sensorStore';
import { getServerUrl, getMqttWsPath } from '../config';

export function useMqtt() {
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const { updateLiveValue, setConnected, registerDiscovery } = useSensorStore();

  useEffect(() => {
    let client: mqtt.MqttClient | null = null;
    let cancelled = false;

    (async () => {
      const serverUrl = await getServerUrl();
      const mqttUrl = getMqttWsPath(serverUrl);
      if (cancelled) return;

      client = mqtt.connect(mqttUrl, {
        clientId: `pio-mobile-${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        reconnectPeriod: 5000,
      });

      clientRef.current = client;

      client.on('connect', () => {
        setConnected(true);
        client!.subscribe('airoponic/telemetry/#');
        client!.subscribe('pio/discovery/#');
        client!.subscribe('pio/status/#');
        client!.subscribe('pio/notifications');
      });

      client.on('message', (topic, payload) => {
        const message = payload.toString();

        if (topic.startsWith('pio/discovery/')) {
          try {
            registerDiscovery(JSON.parse(message));
          } catch {}
        } else if (topic.startsWith('airoponic/telemetry/')) {
          updateLiveValue(topic, message);
        }
      });

      client.on('close', () => setConnected(false));
      client.on('error', () => {});
    })();

    return () => {
      cancelled = true;
      if (client) {
        client.end(true);
      }
      clientRef.current = null;
    };
  }, [updateLiveValue, setConnected, registerDiscovery]);

  return clientRef;
}
