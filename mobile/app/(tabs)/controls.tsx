import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Switch, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/hooks/useApi';
import { useSensorStore } from '../../src/stores/sensorStore';
import { colors, spacing } from '../../src/theme';

export default function ControlsTab() {
  const { sensors, liveValues } = useSensorStore();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<'actuators' | 'schedules' | 'automations'>('actuators');

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api.schedules.list(), api.automations.list()]);
      setSchedules(s);
      setAutomations(a);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const actuators = Array.from(sensors.values()).filter((s) => s.type === 'actuator');

  const toggleActuator = async (id: string, state: boolean) => {
    try {
      await api.sensors.command(id, state);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const toggleSchedule = async (id: string) => {
    try {
      await api.schedules.toggle(id);
      load();
    } catch {}
  };

  const tabs = [
    { key: 'actuators' as const, label: 'Actuators' },
    { key: 'schedules' as const, label: 'Schedules' },
    { key: 'automations' as const, label: 'Rules' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
    >
      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, section === t.key && styles.tabActive]}
            onPress={() => setSection(t.key)}
          >
            <Text style={[styles.tabText, section === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {section === 'actuators' && actuators.map((a) => {
        const live = liveValues.get(a.id);
        const isOn = live?.value === 'ON' || live?.value === 1;
        return (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardRow}>
              <Ionicons name={isOn ? 'power' : 'power-outline'} size={20} color={isOn ? colors.emerald : colors.textMuted} />
              <Text style={styles.cardTitle}>{a.name}</Text>
              <Switch
                value={isOn}
                onValueChange={(v) => toggleActuator(a.id, v)}
                trackColor={{ false: colors.surfaceLight, true: colors.emeraldDark }}
                thumbColor={isOn ? colors.emerald : colors.textMuted}
              />
            </View>
          </View>
        );
      })}

      {section === 'schedules' && schedules.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="timer-outline" size={20} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{s.name}</Text>
              <Text style={styles.cardSub}>
                {s.mode === 'duty_cycle'
                  ? `${s.on_seconds}s on / ${s.interval_seconds}s cycle`
                  : 'Continuous'}
              </Text>
            </View>
            <Switch
              value={!!s.enabled}
              onValueChange={() => toggleSchedule(s.id)}
              trackColor={{ false: colors.surfaceLight, true: colors.emeraldDark }}
              thumbColor={s.enabled ? colors.emerald : colors.textMuted}
            />
          </View>
        </View>
      ))}

      {section === 'automations' && automations.map((a) => (
        <View key={a.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="flash-outline" size={20} color={colors.yellow} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{a.name}</Text>
              <Text style={styles.cardSub}>
                {a.sensor_name} {a.operator} {a.threshold}{a.sensor_unit ? ` ${a.sensor_unit}` : ''}
              </Text>
              {a.trigger_count > 0 && (
                <Text style={styles.cardMeta}>Triggered {a.trigger_count}x</Text>
              )}
            </View>
            <View style={[styles.badge, a.enabled ? styles.badgeOn : styles.badgeOff]}>
              <Text style={styles.badgeText}>{a.enabled ? 'ON' : 'OFF'}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  tabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.emeraldDark, borderColor: colors.emerald },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '500' },
  cardSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  cardMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeOn: { backgroundColor: colors.emeraldDark },
  badgeOff: { backgroundColor: colors.surfaceLight },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '600' },
});
