import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme, tabularNumsVariant } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  color?: string;
  showPercentage?: boolean;
}

export function StatBar({
  label,
  value,
  max = 100,
  unit = "",
  color,
  showPercentage = false,
}: StatBarProps) {
  const { theme } = useTheme();
  const C = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const accent = color ?? C.tint;
  const barColor = pct > 85 ? C.danger : pct > 65 ? C.warning : accent;

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
          style={[styles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: barColor }]}
        />
      </View>
    </View>
  );
}

const createStyles = (t: Theme) => {
  const C = t.colors;
  return StyleSheet.create({
    container: { gap: 6 },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: { fontSize: 13, color: C.textSecondary, fontWeight: "500" },
    value: {
      fontSize: 13,
      fontWeight: "700",
      fontVariant: tabularNumsVariant(t),
    },
    track: {
      height: 4,
      backgroundColor: C.backgroundTertiary,
      borderRadius: 2,
      overflow: "hidden",
    },
    fill: { height: 4, borderRadius: 2 },
  });
};
