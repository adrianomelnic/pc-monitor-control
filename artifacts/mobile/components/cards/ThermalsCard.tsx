import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { FanInfo, SensorReading } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, TempBadge } from "./CardBase";

const C = Colors.light;
export const THERMALS_ACCENT = "#F97316";

function rpmColor(rpm: number) {
  if (rpm > 2500) return "#FF4444";
  if (rpm > 1500) return "#FFB800";
  return "#00CC88";
}

function rpmBar(rpm: number, max = 3000) {
  return Math.min(100, (rpm / max) * 100);
}

interface Props {
  temps: SensorReading[];
  fans: FanInfo[];
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function ThermalsCard({ temps, fans, titleEdit, cardEdit }: Props) {
  const hidden = new Set(cardEdit?.hiddenFields ?? []);
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;

  const tempMap = new Map<string, SensorReading>();
  for (const t of temps) {
    const key = "t:" + t.label;
    if (!tempMap.has(key)) tempMap.set(key, t);
  }
  const fanMap = new Map<string, FanInfo>();
  for (const f of fans) {
    const key = "f:" + f.label;
    if (!fanMap.has(key)) fanMap.set(key, f);
  }

  const defaultOrder = [
    ...Array.from(tempMap.keys()),
    ...Array.from(fanMap.keys()),
  ];
  const order = cardEdit?.fieldOrder ?? defaultOrder;
  const visibleOrder = order.filter(k => !hidden.has(k));

  const visibleTempKeys = visibleOrder.filter(k => k.startsWith("t:") && tempMap.has(k));
  const visibleFanKeys = visibleOrder.filter(k => k.startsWith("f:") && fanMap.has(k));

  const allVisibleTempValues = visibleTempKeys.map(k => tempMap.get(k)!.value);
  const maxTemp = allVisibleTempValues.length > 0 ? Math.max(...allVisibleTempValues) : null;

  return (
    <CardBase
      icon="thermometer"
      title={titleEdit?.customTitle ?? "Thermals & Fans"}
      accentColor={THERMALS_ACCENT}
      temperature={maxTemp}
      titleEditable={titleEdit?.editable}
      titleDraft={titleEdit?.draft}
      onTitleChange={titleEdit?.onChange}
      onTitleSubmit={titleEdit?.onSubmit}
      onTitlePress={titleEdit?.onTitlePress}
      rightAction={titleEdit?.rightAction}
      style={titleEdit?.borderStyle}
      editPanel={cardEdit?.editPanel}
    >
      {visibleTempKeys.length === 0 && visibleFanKeys.length === 0 && (
        <Text style={styles.empty}>No sensors visible — long press to edit</Text>
      )}

      {visibleTempKeys.length > 0 && (
        <View style={styles.section}>
          {visibleTempKeys.map(key => {
            const sensor = tempMap.get(key)!;
            return (
              <View key={key} style={styles.tempRow}>
                <Text style={styles.tempLabel} numberOfLines={1}>
                  {getLabel(key, sensor.label)}
                </Text>
                <TempBadge value={sensor.value} />
              </View>
            );
          })}
        </View>
      )}

      {visibleFanKeys.length > 0 && (
        <View style={[styles.section, visibleTempKeys.length > 0 && styles.sectionGap]}>
          {visibleTempKeys.length > 0 && (
            <Text style={styles.sectionHeader}>FANS</Text>
          )}
          {visibleFanKeys.map(key => {
            const fan = fanMap.get(key)!;
            const color = rpmColor(fan.rpm);
            const pct = rpmBar(fan.rpm);
            return (
              <View key={key} style={styles.fanRow}>
                <View style={styles.fanLeft}>
                  <Feather name="wind" size={12} color={color} />
                  <Text style={styles.fanLabel} numberOfLines={1}>
                    {getLabel(key, fan.label)}
                  </Text>
                </View>
                <View style={styles.fanRight}>
                  <View style={styles.fanBarTrack}>
                    <View style={[styles.fanBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.fanRpm, { color }]}>{fan.rpm.toLocaleString()} RPM</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 7,
  },
  sectionGap: {
    marginTop: 10,
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  tempRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tempLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  fanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fanLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 110,
    flexShrink: 0,
  },
  fanLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  fanRight: {
    flex: 1,
    gap: 4,
  },
  fanBarTrack: {
    height: 5,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 3,
    overflow: "hidden",
  },
  fanBarFill: {
    height: 5,
    borderRadius: 3,
  },
  fanRpm: {
    fontSize: 11,
    fontWeight: "700",
  },
  empty: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    paddingVertical: 6,
  },
});
