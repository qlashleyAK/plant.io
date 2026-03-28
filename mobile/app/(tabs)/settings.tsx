import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  TextInput, StyleSheet, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../../src/hooks/useApi';
import { useAuthStore } from '../../src/hooks/useAuth';
import { useSensorStore } from '../../src/stores/sensorStore';
import { getServerUrl, setServerUrl } from '../../src/config';
import { resetBaseUrlCache } from '../../src/hooks/useApi';
import { colors, spacing } from '../../src/theme';

export default function SettingsTab() {
  const { logout } = useAuthStore();
  const { sensors, connected } = useSensorStore();
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [exports, setExports] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [serverUrl, setServerUrlState] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = await getServerUrl();
      setServerUrlState(url);
      const [h, e, c] = await Promise.all([
        api.health().catch(() => null),
        api.exports.list().catch(() => []),
        api.cameras.list().catch(() => []),
      ]);
      setHealth(h);
      setExports(e);
      setCameras(c);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const saveUrl = async () => {
    if (!serverUrl.trim()) return;
    await setServerUrl(serverUrl.trim());
    resetBaseUrlCache();
    setEditingUrl(false);
    Alert.alert('Saved', 'Server URL updated. Restart the app to reconnect MQTT.');
  };

  const createExport = async (type: string) => {
    try {
      await api.exports.create({ type });
      Alert.alert('Export Started', 'Check back in a moment for the download.');
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const sensorCount = Array.from(sensors.values()).filter(s => s.type === 'sensor').length;
  const actuatorCount = Array.from(sensors.values()).filter(s => s.type === 'actuator').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
    >
      <Text style={styles.sectionTitle}>System Status</Text>
      <View style={styles.card}>
        <StatusRow label="API" value={health ? 'Online' : 'Offline'} ok={!!health} />
        <StatusRow label="MQTT" value={connected ? 'Connected' : 'Disconnected'} ok={connected} />
        <StatusRow label="Sensors" value={`${sensorCount} sensors, ${actuatorCount} actuators`} ok={sensorCount > 0} />
      </View>

      <Text style={styles.sectionTitle}>Connection</Text>
      <View style={styles.card}>
        {editingUrl ? (
          <View>
            <TextInput
              style={styles.urlInput}
              value={serverUrl}
              onChangeText={setServerUrlState}
              placeholder="https://your-server.example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.urlActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingUrl(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveUrl}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.urlRow} onPress={() => setEditingUrl(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.urlLabel}>Server URL</Text>
              <Text style={styles.urlValue}>{serverUrl}</Text>
            </View>
            <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Cameras ({cameras.length})</Text>
      <View style={styles.card}>
        {cameras.map((c: any) => (
          <View key={c.id} style={styles.camRow}>
            <Ionicons name="videocam-outline" size={18} color={c.enabled ? colors.emerald : colors.textMuted} />
            <Text style={styles.camName}>{c.name}</Text>
            <Text style={styles.camType}>{c.type}</Text>
          </View>
        ))}
        {cameras.length === 0 && <Text style={styles.emptyText}>No cameras configured</Text>}
      </View>

      <Text style={styles.sectionTitle}>Data Exports</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => createExport('telemetry_csv')}>
          <Ionicons name="download-outline" size={18} color={colors.blue} />
          <Text style={styles.exportBtnText}>Export Telemetry CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={() => createExport('full_dataset')}>
          <Ionicons name="download-outline" size={18} color={colors.blue} />
          <Text style={styles.exportBtnText}>Export Full Dataset</Text>
        </TouchableOpacity>
        {exports.filter((e: any) => e.status === 'completed').slice(0, 3).map((e: any) => (
          <View key={e.id} style={styles.exportRow}>
            <Text style={styles.exportName}>{e.type}</Text>
            <Text style={styles.exportMeta}>{e.row_count} rows · {new Date(e.completed_at).toLocaleDateString()}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.red} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>plant.io Mobile v1.0.0</Text>
    </ScrollView>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={srStyles.row}>
      <View style={[srStyles.dot, ok && srStyles.dotOk]} />
      <Text style={srStyles.label}>{label}</Text>
      <Text style={srStyles.value}>{value}</Text>
    </View>
  );
}

const srStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  dotOk: { backgroundColor: colors.emerald },
  label: { color: colors.textSecondary, fontSize: 13, width: 70 },
  value: { color: colors.text, fontSize: 13, flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 3 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  urlRow: { flexDirection: 'row', alignItems: 'center' },
  urlLabel: { color: colors.textSecondary, fontSize: 12 },
  urlValue: { color: colors.text, fontSize: 14, marginTop: 2 },
  urlInput: {
    backgroundColor: colors.bg, borderRadius: 8, padding: spacing.sm,
    color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border,
  },
  urlActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceLight },
  cancelBtnText: { color: colors.textSecondary },
  saveBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.emerald },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  camRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  camName: { color: colors.text, fontSize: 14, flex: 1 },
  camType: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  exportBtnText: { color: colors.blue, fontSize: 14 },
  exportRow: { paddingVertical: 6 },
  exportName: { color: colors.textSecondary, fontSize: 13 },
  exportMeta: { color: colors.textMuted, fontSize: 11 },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: '#4a1717',
  },
  logoutText: { color: colors.red, fontSize: 15, fontWeight: '500' },
  version: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
});
