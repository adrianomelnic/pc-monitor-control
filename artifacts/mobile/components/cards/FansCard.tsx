import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme, tabularNumsVariant } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { FanInfo } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, StatRow } from "./CardBase";

function rpmBar(rpm: number, max = 3000) {
  return Math.min(100, (rpm / max) * 100);
}

interface Props {
  fans: FanInfo[];
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function FansCard({ fans, titleEdit, cardEdit }: Props) {
  const { theme } = useTheme();
  const C = theme.colors;
  const ACCENT = theme.cardAccents.fans;
  const styles = useMemo(() => createStyles(theme, ACCENT), [theme, ACCENT]);

  const rpmColor = (rpm: number) => {
    if (rpm > 2500) return C.danger;
    if (rpm > 1500) return C.warning;
    return C.success;
  };

  const hidden = new Set(cardEdit?.hiddenFields ?? []);
  const order = cardEdit?.fieldOrder ?? fans.map(f => f.label);
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;
  const fanMap = new Map(fans.map(f => [f.label, f]));
  const visibleKeys = order.filter(k => !hidden.has(k));
  const visibleFanCount = visibleKeys.filter(k => fanMap.has(k)).length;

  function renderItem(key: string): React.ReactNode {
    const fan = fanMap.get(key);
    if (fan) {
      const color = rpmColor(fan.rpm);
      const pct = rpmBar(fan.rpm);
      return (
        <View key={key} style={styles.fanRow}>
          <View style={styles.fanLeft}>
            <View style={[styles.fanDot, { backgroundColor: color }]} />
            <Text style={styles.fanLabel} numberOfLines={1}>{fan.label}</Text>
          </View>
          <View style={styles.fanRight}>
            <View style={styles.fanBarTrack}>
              <View style={[styles.fanBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.fanRpm, { color }]}>{fan.rpm} RPM</Text>
          </View>
        </View>
      );
    }
    const val = extraMap[key];
    return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
  }

  return (
    <CardBase
      icon="wind"
      title={titleEdit?.customTitle ?? "Fans"}
      subtitle={fans.length > 0 ? `${visibleFanCount} fan${visibleFanCount !== 1 ? "s" : ""} detected` : undefined}
      accentColor={ACCENT}
      titleEditable={titleEdit?.editable}
      titleDraft={titleEdit?.draft}
      onTitleChange={titleEdit?.onChange}
      onTitleSubmit={titleEdit?.onSubmit}
      onTitlePress={titleEdit?.onTitlePress}
      extraTemps={cardEdit?.extraTemps}
      rightAction={titleEdit?.rightAction}
      style={titleEdit?.borderStyle}
      editPanel={cardEdit?.editPanel}
    >
      {fans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyRow}>
            <Feather name="info" size={13} color={C.warning} />
            <Text style={styles.emptyTitle}>No fan sensors detected</Text>
          </View>
          <Text style={styles.emptyText}>
            The agent could not enumerate any fans on this PC. Many laptops and pre-built desktops don&apos;t expose fan sensors that user software can read.
          </Text>
          {visibleKeys.filter(k => !fanMap.has(k)).map(key => {
            const val = extraMap[key];
            return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
          })}
        </View>
      ) : (
        <View style={styles.fanList}>
          {visibleKeys.map(key => renderItem(key))}
        </View>
      )}
    </CardBase>
  );
}

const createStyles = (t: Theme, accent: string) => {
  const C = t.colors;
  const fontVariant = tabularNumsVariant(t);
  return StyleSheet.create({
    fanList: { gap: 10 },
    fanRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    fanLeft: { flexDirection: "row", alignItems: "center", gap: 6, width: 110, flexShrink: 0 },
    fanDot: { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
    fanLabel: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_600SemiBold", flex: 1, letterSpacing: 0.2 },
    fanRight: { flex: 1, gap: 3 },
    fanBarTrack: { height: 3, backgroundColor: C.backgroundTertiary, borderRadius: 1, overflow: "hidden" },
    fanBarFill: { height: 3, borderRadius: 1 },
    fanRpm: { fontSize: 11, fontFamily: "Inter_700Bold", fontVariant, letterSpacing: 0.2 },
    emptyWrap: { gap: 8 },
    emptyRow: { flexDirection: "row", gap: 7, alignItems: "center" },
    emptyTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.warning },
    emptyText: { fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  });
};
