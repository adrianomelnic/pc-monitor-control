import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { FanInfo, SensorReading } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig } from "./CardBase";

const C = Colors.light;
export const THERMALS_ACCENT = "#F97316";

const IMPORTANT_PATTERNS = [/cpu/i, /gpu/i, /ram/i, /memory/i, /vram/i, /dram/i];
export function isImportantTemp(label: string): boolean {
  return IMPORTANT_PATTERNS.some(p => p.test(label));
}

export const SENSOR_ICON_OPTIONS: string[] = [
  // Fans & airflow
  "wind", "rotate-cw", "refresh-cw", "sliders",
  // Water cooling
  "droplet", "navigation", "repeat", "radio",
  // CPU / GPU / components
  "cpu", "monitor", "layers", "grid",
  // Temperature & heat
  "thermometer", "sun", "zap", "activity",
  // Power & system
  "power", "battery", "server", "hard-drive",
  // Case & general
  "package", "box", "settings", "disc",
];

export function defaultSensorIcon(key: string): string {
  const label = key.slice(2).toLowerCase();
  if (key.startsWith("t:")) {
    if (/cpu|processor/i.test(label)) return "cpu";
    if (/gpu|vga|graphics|video/i.test(label)) return "monitor";
    if (/water|liquid|coolant|loop|reservoir/i.test(label)) return "droplet";
    if (/rad|radiator/i.test(label)) return "radio";
    if (/vrm|mosfet|power/i.test(label)) return "zap";
    if (/chipset|m\.2|nvme/i.test(label)) return "hard-drive";
    if (/system|mb|motherboard/i.test(label)) return "layers";
    return "thermometer";
  }
  // fans
  if (/pump/i.test(label)) return "repeat";
  if (/water|liquid|loop|coolant/i.test(label)) return "droplet";
  if (/cpu/i.test(label)) return "cpu";
  if (/rad|radiator/i.test(label)) return "radio";
  if (/gpu|graphics/i.test(label)) return "monitor";
  if (/chassis|case|system/i.test(label)) return "package";
  return "wind";
}

function tempColor(c: number): string {
  if (c >= 85) return "#FF4444";
  if (c >= 70) return "#FF8C00";
  if (c >= 50) return "#FBBF24";
  return "#34D399";
}

function rpmColor(rpm: number): string {
  if (rpm >= 2000) return "#FF4444";
  if (rpm >= 1000) return "#FBBF24";
  return "#34D399";
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

interface Props {
  temps: SensorReading[];
  fans: FanInfo[];
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function ThermalsCard({ temps, fans, titleEdit, cardEdit }: Props) {
  const aliases = cardEdit?.fieldAliases ?? {};
  const sensorIcons = cardEdit?.sensorIcons ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;
  const getIcon = (key: string) =>
    ((sensorIcons[key] ?? defaultSensorIcon(key)) as keyof typeof Feather.glyphMap);

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

  const defaultOrder = [...tempMap.keys(), ...fanMap.keys()];

  const hidden: Set<string> = (() => {
    if (cardEdit?.hiddenFields !== undefined) return new Set(cardEdit.hiddenFields);
    // Default: hide all temperature sensors; show all fans
    const d = new Set<string>();
    for (const k of tempMap.keys()) d.add(k);
    return d;
  })();

  const order = cardEdit?.fieldOrder ?? defaultOrder;
  const visibleOrder = order.filter(k => !hidden.has(k) && (tempMap.has(k) || fanMap.has(k)));

  const visibleTempKeys = visibleOrder.filter(k => tempMap.has(k));
  const maxTemp =
    visibleTempKeys.length > 0
      ? Math.max(...visibleTempKeys.map(k => tempMap.get(k)!.value))
      : null;

  const rows = chunk(visibleOrder, 3);

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
      {visibleOrder.length === 0 && (
        <Text style={styles.empty}>No sensors visible — long press to edit</Text>
      )}

      <View style={styles.grid}>
        {rows.map((rowKeys, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {rowKeys.map(key => {
              const isTemp = tempMap.has(key);
              const sensor = isTemp ? tempMap.get(key)! : null;
              const fan = !isTemp ? fanMap.get(key)! : null;

              const label = isTemp
                ? getLabel(key, sensor!.label)
                : getLabel(key, fan!.label);

              const valueText = isTemp
                ? `${Math.round(sensor!.value)}°C`
                : fan!.rpm >= 1000
                  ? `${(fan!.rpm / 1000).toFixed(1)}k`
                  : `${fan!.rpm}`;

              const color = isTemp ? tempColor(sensor!.value) : rpmColor(fan!.rpm);
              const icon = getIcon(key);

              return (
                <View key={key} style={styles.tile}>
                  <Feather name={icon} size={22} color={C.textMuted} style={styles.tileIcon} />
                  <Text style={styles.tileLabel} numberOfLines={1}>
                    {label.toUpperCase()}
                  </Text>
                  <Text style={[styles.tileValue, { color }]}>{valueText}</Text>
                  {!isTemp && <Text style={[styles.tileUnit, { color }]}>RPM</Text>}
                </View>
              );
            })}
            {rowKeys.length < 3 &&
              Array(3 - rowKeys.length)
                .fill(null)
                .map((_, i) => <View key={`ph-${i}`} style={styles.tilePlaceholder} />)}
          </View>
        ))}
      </View>
    </CardBase>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 6,
    minWidth: 0,
  },
  tilePlaceholder: {
    flex: 1,
  },
  tileIcon: {
    marginBottom: 6,
    opacity: 0.55,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.1,
    marginBottom: 4,
    textAlign: "center",
  },
  tileValue: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
  },
  tileUnit: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 1,
    opacity: 0.75,
  },
  empty: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    paddingVertical: 6,
  },
});
