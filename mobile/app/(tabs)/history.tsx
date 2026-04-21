import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/hooks/useApi';
import { useSensorStore } from '../../src/stores/sensorStore';
import { colors, spacing } from '../../src/theme';

const RANGES = [
  { key: '1h', label: '1H', hours: 1, resolution: 'minute' },
  { key: '6h', label: '6H', hours: 6, resolution: 'minute' },
  { key: '24h', label: '24H', hours: 24, resolution: 'hour' },
  { key: '7d', label: '7D', hours: 168, resolution: 'hour' },
  { key: '30d', label: '30D', hours: 720, resolution: 'day' },
] as const;

export default function HistoryTab() {
  const { sensors } = useSensorStore();
  const [range, setRange] = useState<typeof RANGES[number]>(RANGES[2]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const sensorList = Array.from(sensors.values()).filter((s) => s.type === 'sensor');

  useEffect(() => {
    if (sensorList.length > 0 && !selectedSensor) {
      setSelectedSensor(sensorList[0].id);
    }
  }, [sensorList.length]);

  const loadData = useCallback(async () => {
    if (!selectedSensor) return;
    setLoading(true);
    try {
      const from = new Date(Date.now() - range.hours * 3600000).toISOString();
      const to = new Date().toISOString();
      const result = await api.analytics.history({
        sensors: selectedSensor,
        from,
        to,
        resolution: range.resolution,
      });
      setData(result.telemetry || []);
    } catch {}
    setLoading(false);
  }, [selectedSensor, range]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const sensor = selectedSensor ? sensors.get(selectedSensor) : null;

  const minVal = data.length > 0 ? Math.min(...data.map((d: any) => d.value ?? Infinity)) : 0;
  const maxVal = data.length > 0 ? Math.max(...data.map((d: any) => d.value ?? -Infinity)) : 100;
  const valRange = maxVal - minVal || 1;
  const chartWidth = Dimensions.get('window').width - spacing.md * 2 - 2;
  const chartHeight = 180;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sensorPicker}>
        {sensorList.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.sensorChip, selectedSensor === s.id && styles.sensorChipActive]}
            onPress={() => setSelectedSensor(s.id)}
          >
            <Text style={[styles.sensorChipText, selectedSensor === s.id && styles.sensorChipTextActive]}>
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangeBtn, range.key === r.key && styles.rangeBtnActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeBtnText, range.key === r.key && styles.rangeBtnTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.chartCard, { height: chartHeight + spacing.lg }]}>
        {loading && (
          <View style={styles.chartLoading}>
            <Text style={styles.chartLoadingText}>Loading...</Text>
          </View>
        )}
        {!loading && data.length === 0 && (
          <View style={styles.chartLoading}>
            <Text style={styles.chartLoadingText}>No data for this range</Text>
          </View>
        )}
        {!loading && data.length > 0 && (
          <View style={{ height: chartHeight, width: chartWidth }}>
            <View style={styles.chartYAxis}>
              <Text style={styles.chartLabel}>{maxVal.toFixed(1)}</Text>
              <Text style={styles.chartLabel}>{((maxVal + minVal) / 2).toFixed(1)}</Text>
              <Text style={styles.chartLabel}>{minVal.toFixed(1)}</Text>
            </View>
            <View style={styles.chartArea}>
              {data.map((point: any, i: number) => {
                const x = (i / Math.max(data.length - 1, 1)) * 100;
                const y = ((maxVal - (point.value ?? minVal)) / valRange) * 100;
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: `${y}%`,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.emerald,
                      marginLeft: -2,
                      marginTop: -2,
                    }}
                  />
                );
              })}
            </View>
          </View>
        )}
      </View>

      {sensor && data.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Min</Text>
            <Text style={styles.statValue}>{minVal.toFixed(1)} {sensor.unit}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg</Text>
            <Text style={styles.statValue}>
              {(data.reduce((s: number, d: any) => s + (d.value || 0), 0) / data.length).toFixed(1)} {sensor.unit}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Max</Text>
            <Text style={styles.statValue}>{maxVal.toFixed(1)} {sensor.unit}</Text>
          </View>
        </View>
      )}

      <Text style={styles.dataPoints}>{data.length} data points</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  sensorPicker: { marginBottom: spacing.md },
  sensorChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.surface, marginRight: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  sensorChipActive: { backgroundColor: colors.emeraldDark, borderColor: colors.emerald },
  sensorChipText: { color: colors.textSecondary, fontSize: 13 },
  sensorChipTextActive: { color: colors.text },
  rangeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  rangeBtn: {
    flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  rangeBtnActive: { backgroundColor: colors.emeraldDark, borderColor: colors.emerald },
  rangeBtnText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  rangeBtnTextActive: { color: colors.text },
  chartCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  chartLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chartLoadingText: { color: colors.textMuted, fontSize: 13 },
  chartYAxis: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    justifyContent: 'space-between', width: 40, zIndex: 1,
  },
  chartLabel: { color: colors.textMuted, fontSize: 9 },
  chartArea: { flex: 1, marginLeft: 44, position: 'relative' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 2 },
  dataPoints: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
});
