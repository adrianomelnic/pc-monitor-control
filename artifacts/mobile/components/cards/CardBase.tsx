import { Feather } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
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
      : C.success;
  return (
    <View style={[styles.tempBadge, { backgroundColor: color + "18", borderColor: color + "44" }]}>
      <Text style={[styles.tempText, { color }]}>{Math.round(value)}°C</Text>
    </View>
  );
}

export interface ExtraSensorRow {
  label: string;
  value: string;
}

export interface BuiltinCardEdit {
  hiddenFields?: string[];
  fieldOrder?: string[];
  extraSensorMap?: Record<string, string>;
  extraTemps?: { label: string; value: number }[];
  fieldAliases?: Record<string, string>;
  sensorIcons?: Record<string, string>;
  editPanel?: React.ReactNode;
}

export interface CardTitleEditConfig {
  customTitle?: string;
  editable?: boolean;
  draft?: string;
  onChange?: (t: string) => void;
  onSubmit?: () => void;
  onTitlePress?: () => void;
  rightAction?: React.ReactNode;
  borderStyle?: ViewStyle;
}

interface CardBaseProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  accentColor: string;
  temperature?: number | null;
  extraTemps?: { label: string; value: number }[];
  rightAction?: React.ReactNode;
  titleEditable?: boolean;
  titleDraft?: string;
  onTitleChange?: (t: string) => void;
  onTitleSubmit?: () => void;
  onTitlePress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  editPanel?: React.ReactNode;
}

export function CardBase({
  icon,
  title,
  subtitle,
  accentColor,
  temperature,
  extraTemps,
  rightAction,
  titleEditable,
  titleDraft,
  onTitleChange,
  onTitleSubmit,
  onTitlePress,
  children,
  style,
  editPanel,
}: CardBaseProps) {
  const titleInputRef = useRef<TextInput>(null);

  return (
    <View style={[styles.card, style]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.cardInner}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: accentColor + "18" }]}>
            <Feather name={icon} size={15} color={accentColor} />
          </View>
          <View style={styles.titleBlock}>
            {titleEditable ? (
              <TextInput
                ref={titleInputRef}
                style={[styles.title, styles.titleInput, { borderBottomColor: accentColor }]}
                value={titleDraft}
                onChangeText={onTitleChange}
                onSubmitEditing={onTitleSubmit}
                autoCorrect={false}
                returnKeyType="done"
                selectTextOnFocus
              />
            ) : onTitlePress ? (
              <Pressable onPress={onTitlePress} hitSlop={6}>
                <View style={styles.titlePressable}>
                  <Text style={styles.title} numberOfLines={1}>{title}</Text>
                  <Feather name="edit-2" size={10} color={accentColor} style={styles.titleEditIcon} />
                </View>
              </Pressable>
            ) : (
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            )}
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            {temperature != null && <TempBadge value={temperature} />}
            {extraTemps?.map((t, i) => <TempBadge key={i} value={t.value} />)}
            {rightAction}
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: accentColor + "22" }]} />
        {children}
        {editPanel ?? null}
      </View>
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
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
    flexDirection: "row",
    overflow: "hidden",
  },
  accentBar: {
    width: 3,
    flexShrink: 0,
  },
  cardInner: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 4,
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
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  titleInput: {
    borderBottomWidth: 1.5,
    paddingVertical: 0,
    paddingHorizontal: 0,
    textTransform: "none",
  },
  titlePressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  titleEditIcon: {
    opacity: 0.7,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subtitle: {
    fontSize: 10,
    color: C.textMuted,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  tempBadge: {
    borderRadius: 2,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tempText: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  divider: {
    height: 1,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 12,
    color: C.text,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.2,
  },
  barTrack: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 1,
    overflow: "hidden",
    width: "100%",
  },
  barFill: {
    borderRadius: 1,
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
