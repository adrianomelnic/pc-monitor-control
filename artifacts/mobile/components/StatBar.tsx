import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  color?: string;
  showPercentage?: boolean;
}

const C = Colors.light;

export function StatBar({
  label,
  value,
  max = 100,
  unit = "",
  color = C.tint,
  showPercentage = false,
}: StatBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor =
    pct > 85 ? C.danger : pct > 65 ? C.warning : color;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: barColor }]}>
          {showPercentage
            ? `${Math.round(pct)}%`
            : `${value.toFixed(value >= 100 ? 0 : 1)}${unit}`}
          {max !== 100 && !showPercentage
            ? ` / ${max.toFixed(max >= 100 ? 0 : 1)}${unit}`
            : ""}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${pct}%` as any, backgroundColor: barColor }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
  },
  value: {
    fontSize: 13,
    fontWeight: "700",
  },
  track: {
    height: 6,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
