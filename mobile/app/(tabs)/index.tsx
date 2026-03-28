import { useEffect, useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Text } from 'react-native';
import { useSensorStore } from '../../src/stores/sensorStore';
import { api } from '../../src/hooks/useApi';
import SensorGauge from '../../src/components/SensorGauge';
import ActuatorTile from '../../src/components/ActuatorTile';
import { colors, spacing } from '../../src/theme';
import type { Sensor } from '../../src/types';

export default function DashboardTab() {
  const { sensors, liveValues, setSensors, connected } = useSensorStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadSensors = useCallback(async () => {
    try {
      const list = await api.sensors.list();
      setSensors(list);
    } catch {}
  }, [setSensors]);

  useEffect(() => {
    loadSensors();
    const interval = setInterval(loadSensors, 30000);
    return () => clearInterval(interval);
  }, [loadSensors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSensors();
    setRefreshing(false);
  };

  const handleToggle = async (id: string, state: boolean) => {
    try {
      await api.sensors.command(id, state);
    } catch {}
  };

  const sensorList = Array.from(sensors.values()).filter((s) => s.type === 'sensor');
  const actuatorList = Array.from(sensors.values()).filter((s) => s.type === 'actuator');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
      }
    >
      <View style={styles.statusRow}>
        <View style={[styles.dot, connected && styles.dotConnected]} />
        <Text style={styles.statusText}>
          {connected ? 'MQTT Connected' : 'Disconnected'}
        </Text>
      </View>

      {sensorList.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sensors</Text>
          <View style={styles.gaugeGrid}>
            {sensorList.map((s) => {
              const live = liveValues.get(s.id);
              return (
                <SensorGauge
                  key={s.id}
                  sensor={s}
                  value={live?.value ?? s.last_value}
                  timestamp={live?.timestamp}
                />
              );
            })}
          </View>
        </>
      )}

      {actuatorList.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Actuators</Text>
          <View style={styles.actuatorList}>
            {actuatorList.map((s) => {
              const live = liveValues.get(s.id);
              return (
                <ActuatorTile
                  key={s.id}
                  sensor={s}
                  value={live?.value ?? s.last_value_text}
                  onToggle={handleToggle}
                />
              );
            })}
          </View>
        </>
      )}

      {sensors.size === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No sensors discovered yet</Text>
          <Text style={styles.emptyHint}>Pull to refresh or check MQTT connection</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  dotConnected: { backgroundColor: colors.emerald },
  statusText: { color: colors.textSecondary, fontSize: 12 },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actuatorList: { gap: spacing.sm },
  empty: { alignItems: 'center', marginTop: spacing.xl * 3 },
  emptyText: { color: colors.textSecondary, fontSize: 16 },
  emptyHint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
});
