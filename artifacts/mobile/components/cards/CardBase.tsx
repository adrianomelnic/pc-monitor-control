import { Feather } from "@expo/vector-icons";
import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { Theme, tabularNumsVariant } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";

interface TempBadgeProps {
  value: number;
}

export function TempBadge({ value }: TempBadgeProps) {
  const { theme } = useTheme();
  const C = theme.colors;
  const color =
    value >= 85
      ? C.danger
      : value >= 70
      ? C.warning
      : value >= 50
      ? C.idle
      : C.success;
  const fontVariant = tabularNumsVariant(theme);
  return (
    <View
      style={{
        borderRadius: theme.innerRadius,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: color + "18",
        borderColor: color + "44",
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color, fontVariant }}>
        {Math.round(value)}°C
      </Text>
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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isLeft = theme.accentEdge === "left";
  const displayTitle =
    theme.titleCase === "upper" ? title.toUpperCase() : title;

  const accentNode = isLeft ? (
    <View
      style={{
        width: theme.accentThickness,
        flexShrink: 0,
        backgroundColor: accentColor,
      }}
    />
  ) : (
    <View
      style={{
        height: theme.accentThickness,
        backgroundColor: accentColor,
      }}
    />
  );

  return (
    <View style={[styles.card, style]}>
      {accentNode}
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
                  <Text style={styles.title} numberOfLines={1}>{displayTitle}</Text>
                  <Feather name="edit-2" size={10} color={accentColor} style={styles.titleEditIcon} />
                </View>
              </Pressable>
            ) : (
              <Text style={styles.title} numberOfLines={1}>{displayTitle}</Text>
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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const displayLabel = theme.titleCase === "upper" ? label.toUpperCase() : label;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{displayLabel}</Text>
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
  const { theme } = useTheme();
  const C = theme.colors;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = pct > 85 ? C.danger : pct > 65 ? C.warning : color;
  return (
    <View
      style={{
        height,
        backgroundColor: C.backgroundTertiary,
        borderRadius: 1,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <View
        style={{
          width: `${pct}%` as `${number}%`,
          backgroundColor: barColor,
          height,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

const createStyles = (t: Theme) => {
  const C = t.colors;
  const isLeft = t.accentEdge === "left";
  const fontVariant = tabularNumsVariant(t);
  return StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderRadius: t.cardRadius,
      borderWidth: 1,
      borderColor: C.cardBorder,
      flexDirection: isLeft ? "row" : "column",
      overflow: "hidden",
    },
    cardInner: {
      flex: isLeft ? 1 : 0,
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
      borderRadius: t.innerRadius,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    titleBlock: {
      flex: 1,
    },
    title: {
      fontSize: t.titleFontSize,
      fontFamily: "Inter_700Bold",
      color: C.text,
      letterSpacing: t.titleLetterSpacing,
    },
    titleInput: {
      borderBottomWidth: 1.5,
      paddingVertical: 0,
      paddingHorizontal: 0,
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
      letterSpacing: t.sectionLabelLetterSpacing,
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
      fontFamily: "Inter_600SemiBold",
      letterSpacing: t.sectionLabelLetterSpacing,
    },
    statValue: {
      fontSize: 12,
      color: C.text,
      fontFamily: "Inter_700Bold",
      fontVariant,
      letterSpacing: 0.2,
    },
  });
};
