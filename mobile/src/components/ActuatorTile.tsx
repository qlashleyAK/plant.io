import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Sensor } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  sensor: Sensor;
  value?: number | string | null;
  onToggle: (id: string, newState: boolean) => void;
}

export default function ActuatorTile({ sensor, value, onToggle }: Props) {
  const isOn = value === 'ON' || value === 1 || value === '1';

  return (
    <TouchableOpacity
      style={[styles.container, isOn && styles.containerOn]}
      onPress={() => onToggle(sensor.id, !isOn)}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isOn ? 'power' : 'power-outline'}
        size={22}
        color={isOn ? colors.emerald : colors.textMuted}
      />
      <Text style={[styles.name, isOn && styles.nameOn]} numberOfLines={1}>
        {sensor.name}
      </Text>
      <Text style={[styles.status, isOn && styles.statusOn]}>
        {isOn ? 'ON' : 'OFF'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  containerOn: {
    borderColor: colors.emeraldDark,
    backgroundColor: '#0a1f15',
  },
  name: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  nameOn: {
    color: colors.text,
  },
  status: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statusOn: {
    color: colors.emerald,
  },
});
