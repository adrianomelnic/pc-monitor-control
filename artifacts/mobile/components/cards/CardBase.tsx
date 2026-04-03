import { Feather } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import { StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.light;

interface TempBadgeProps {
  value: number;
}

export function TempBadge({ value }: TempBadgeProps) {
  const color =
    value >= 85
      ? "#FF4444"
      : value >= 70
      ? "#FF8C00"
      : value >= 50
      ? "#FFB800"
      : "#00CC88";
  return (
    <View style={[styles.tempBadge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.tempText, { color }]}>{Math.round(value)}°C</Text>
    </View>
  );
}

/** Extra sensor row data for built-in cards (resolved from HWiNFO64 sensors) */
export interface ExtraSensorRow {
  label: string;
  value: string;
}

/** Config for built-in card sensor/field editing (passed alongside titleEdit) */
export interface BuiltinCardEdit {
  hiddenFields?: string[];
  extraSensorRows?: ExtraSensorRow[];
  editPanel?: React.ReactNode;
}

/** Passed from [id].tsx into each built-in card to enable inline title editing */
export interface CardTitleEditConfig {
  customTitle?: string;
  editable?: boolean;
  draft?: string;
  onChange?: (t: string) => void;
  onSubmit?: () => void;
  rightAction?: React.ReactNode;
  borderStyle?: ViewStyle;
}

interface CardBaseProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  accentColor: string;
  temperature?: number | null;
  /** Optional element shown in the header right slot (used when temperature is null) */
  rightAction?: React.ReactNode;
  /** When true, the title renders as a TextInput for inline editing */
  titleEditable?: boolean;
  titleDraft?: string;
  onTitleChange?: (t: string) => void;
  onTitleSubmit?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Extra HWiNFO64 sensor rows appended below main content */
  extraSensorRows?: ExtraSensorRow[];
  /** Edit panel node rendered at the very bottom of the card (in edit mode) */
  editPanel?: React.ReactNode;
}

export function CardBase({
  icon,
  title,
  subtitle,
  accentColor,
  temperature,
  rightAction,
  titleEditable,
  titleDraft,
  onTitleChange,
  onTitleSubmit,
  children,
  style,
  extraSensorRows,
  editPanel,
}: CardBaseProps) {
  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (titleEditable) {
      setTimeout(() => titleInputRef.current?.focus(), 80);
    }
  }, [titleEditable]);

  return (
    <View style={[styles.card, { borderTopColor: accentColor }, style]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: accentColor + "22" }]}>
          <Feather name={icon} size={16} color={accentColor} />
        </View>
        <View style={styles.titleBlock}>
          {titleEditable ? (
            <TextInput
              ref={titleInputRef}
              style={[styles.title, styles.titleInput, { borderBottomColor: accentColor }]}
              value={titleDraft}
              onChangeText={onTitleChange}
              onSubmitEditing={onTitleSubmit}
              onBlur={onTitleSubmit}
              autoCorrect={false}
              returnKeyType="done"
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          )}
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {temperature != null ? <TempBadge value={temperature} /> : (rightAction ?? null)}
      </View>
      <View style={styles.divider} />
      {children}
      {extraSensorRows && extraSensorRows.length > 0 && (
        <View style={styles.extraRows}>
          <View style={styles.extraDivider} />
          {extraSensorRows.map((r, i) => (
            <StatRow key={i} label={r.label} value={r.value} />
          ))}
        </View>
      )}
      {editPanel ?? null}
    </View>
  );
}

export function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export function MiniBar({
  value,
  max = 100,
  color,
  height = 5,
}: {
  value: number;
  max?: number;
  color: string;
  height?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = pct > 85 ? "#FF4444" : pct > 65 ? "#FFB800" : color;
  return (
    <View style={[styles.barTrack, { height }]}>
      <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barColor, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderTopWidth: 2,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.2,
  },
  titleInput: {
    borderBottomWidth: 1.5,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  subtitle: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 1,
  },
  tempBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tempText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: C.cardBorder,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 12,
    color: C.text,
    fontWeight: "700",
  },
  barTrack: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 3,
    overflow: "hidden",
    width: "100%",
  },
  barFill: {
    borderRadius: 3,
  },
  extraRows: {
    gap: 4,
  },
  extraDivider: {
    height: 1,
    backgroundColor: Colors.light.cardBorder,
    marginBottom: 4,
  },
});
