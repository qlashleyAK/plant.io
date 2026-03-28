import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { Sensor, GaugeConfig } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  sensor: Sensor;
  value?: number | string | null;
  timestamp?: number;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function SensorGauge({ sensor, value, timestamp }: Props) {
  const gauge = sensor.gauge_config;
  const numValue = typeof value === 'number' ? value : null;
  const isStale = !timestamp || Date.now() - timestamp > 120000;

  const size = 110;
  const cx = size / 2;
  const cy = size / 2;
  const r = 42;
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;

  let fillAngle = startAngle;
  if (gauge && numValue != null) {
    const pct = Math.max(0, Math.min(1, (numValue - gauge.min) / (gauge.max - gauge.min)));
    fillAngle = startAngle + pct * totalAngle;
  }

  const segmentColor = getSegmentColor(gauge, numValue);

  const displayValue = numValue != null
    ? numValue < 10 ? numValue.toFixed(1) : Math.round(numValue).toString()
    : typeof value === 'string' ? value : '--';

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Path
          d={describeArc(cx, cy, r, startAngle, endAngle)}
          stroke={colors.surfaceLight}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
        />
        {numValue != null && gauge && (
          <Path
            d={describeArc(cx, cy, r, startAngle, fillAngle)}
            stroke={segmentColor}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
        )}
        <Circle
          cx={cx - 28}
          cy={cy + 28}
          r={3}
          fill={isStale ? colors.textMuted : colors.emerald}
          opacity={isStale ? 0.5 : 1}
        />
      </Svg>
      <View style={styles.valueContainer}>
        <Text style={styles.value} numberOfLines={1}>{displayValue}</Text>
        <Text style={styles.unit}>{sensor.unit}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>{sensor.name}</Text>
    </View>
  );
}

function getSegmentColor(gauge: GaugeConfig | null, value: number | null): string {
  if (!gauge || value == null) return colors.emerald;
  const segments = [...gauge.segments].sort((a, b) => b.from - a.from);
  for (const seg of segments) {
    if (value >= seg.from) return seg.color;
  }
  return segments[segments.length - 1]?.color || colors.emerald;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valueContainer: {
    position: 'absolute',
    top: 44,
    alignItems: 'center',
    width: '100%',
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  name: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});
