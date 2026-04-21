import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  StyleSheet, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/hooks/useApi';
import { colors, spacing } from '../../src/theme';

type ViewMode = 'grows' | 'detail' | 'timepoints';

export default function NotebookTab() {
  const [grows, setGrows] = useState<any[]>([]);
  const [selectedGrow, setSelectedGrow] = useState<any>(null);
  const [timepoints, setTimepoints] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<ViewMode>('grows');
  const [showTimepointModal, setShowTimepointModal] = useState(false);
  const [selectedTp, setSelectedTp] = useState<any>(null);
  const [notes, setNotes] = useState('');

  const loadGrows = useCallback(async () => {
    try {
      const list = await api.grows.list();
      setGrows(list);
    } catch {}
  }, []);

  const loadGrowDetail = useCallback(async (id: string) => {
    try {
      const detail = await api.grows.get(id);
      setSelectedGrow(detail);
      setTimepoints(detail.timepoints || []);
      setView('detail');
    } catch {}
  }, []);

  useEffect(() => { loadGrows(); }, [loadGrows]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (view === 'detail' && selectedGrow) {
      await loadGrowDetail(selectedGrow.id);
    } else {
      await loadGrows();
    }
    setRefreshing(false);
  };

  const completeTimepoint = async () => {
    if (!selectedTp) return;
    try {
      await api.timepoints.update(selectedTp.id, { status: 'completed' });
      if (notes.trim()) {
        await api.timepoints.addData(selectedTp.id, {
          entries: [{ field_name: 'notes', field_type: 'text', value_text: notes.trim() }],
        });
      }
      setShowTimepointModal(false);
      setNotes('');
      if (selectedGrow) await loadGrowDetail(selectedGrow.id);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.emerald;
      case 'completed': return colors.blue;
      case 'overdue': return colors.red;
      case 'pending': return colors.yellow;
      default: return colors.textMuted;
    }
  };

  const tpIcon = (type: string) => {
    switch (type) {
      case 'measurement': return 'flask-outline';
      case 'feeding': return 'water-outline';
      case 'photo': return 'camera-outline';
      case 'harvest': return 'leaf-outline';
      case 'task': return 'checkbox-outline';
      default: return 'eye-outline';
    }
  };

  if (view === 'detail' && selectedGrow) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        <TouchableOpacity style={styles.backRow} onPress={() => setView('grows')}>
          <Ionicons name="arrow-back" size={20} color={colors.emerald} />
          <Text style={styles.backText}>Grows</Text>
        </TouchableOpacity>

        <View style={styles.growHeader}>
          <Text style={styles.growTitle}>{selectedGrow.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(selectedGrow.status) + '22' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor(selectedGrow.status) }]}>
              {selectedGrow.status}
            </Text>
          </View>
        </View>
        {selectedGrow.strain && <Text style={styles.growMeta}>Strain: {selectedGrow.strain}</Text>}
        <Text style={styles.growMeta}>Started: {new Date(selectedGrow.start_date).toLocaleDateString()}</Text>

        {(selectedGrow.phases || []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Phases</Text>
            {selectedGrow.phases.map((p: any) => (
              <View key={p.id} style={styles.phaseCard}>
                <Text style={styles.phaseName}>{p.name}</Text>
                <Text style={styles.phaseMeta}>Days {p.start_day}–{p.end_day || '...'}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>
          Timepoints ({timepoints.filter((t: any) => t.status === 'completed').length}/{timepoints.length})
        </Text>
        {timepoints.map((tp: any) => (
          <TouchableOpacity
            key={tp.id}
            style={styles.tpCard}
            onPress={() => {
              if (tp.status === 'pending' || tp.status === 'overdue') {
                setSelectedTp(tp);
                setShowTimepointModal(true);
              }
            }}
          >
            <Ionicons name={tpIcon(tp.type) as any} size={18} color={statusColor(tp.status)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tpTitle}>{tp.title}</Text>
              <Text style={styles.tpTime}>{new Date(tp.scheduled_at).toLocaleString()}</Text>
            </View>
            <View style={[styles.tpStatus, { backgroundColor: statusColor(tp.status) + '22' }]}>
              <Text style={[styles.tpStatusText, { color: statusColor(tp.status) }]}>{tp.status}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Modal visible={showTimepointModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Complete: {selectedTp?.title}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTimepointModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={completeTimepoint}>
                  <Text style={styles.modalConfirmText}>Complete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
    >
      <Text style={styles.sectionTitle}>Grows</Text>
      {grows.map((g) => (
        <TouchableOpacity key={g.id} style={styles.growCard} onPress={() => loadGrowDetail(g.id)}>
          <View style={styles.growCardRow}>
            <Ionicons name="leaf-outline" size={20} color={colors.emerald} />
            <View style={{ flex: 1 }}>
              <Text style={styles.growCardTitle}>{g.name}</Text>
              <Text style={styles.growCardSub}>
                {g.strain || g.grow_medium} · {g.timepoint_count || 0} timepoints
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(g.status) + '22' }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor(g.status) }]}>{g.status}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {grows.length === 0 && (
        <Text style={styles.emptyText}>No grows yet. Create one from the web dashboard.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  backText: { color: colors.emerald, fontSize: 14 },
  growHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  growTitle: { color: colors.text, fontSize: 22, fontWeight: '700', flex: 1 },
  growMeta: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm },
  phaseCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md,
    marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border,
  },
  phaseName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  phaseMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  tpCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md,
    marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border,
  },
  tpTitle: { color: colors.text, fontSize: 14, fontWeight: '500' },
  tpTime: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  tpStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tpStatusText: { fontSize: 11, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  growCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  growCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  growCardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  growCardSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.xl },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: spacing.md },
  modalInput: {
    backgroundColor: colors.bg, borderRadius: 10, padding: spacing.md,
    color: colors.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: colors.border,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.surfaceLight,
  },
  modalCancelText: { color: colors.textSecondary, fontWeight: '500' },
  modalConfirm: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.emerald,
  },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
});
