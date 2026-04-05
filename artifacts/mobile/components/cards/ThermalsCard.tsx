import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { FanInfo, SensorReading } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig } from "./CardBase";
import { CUSTOM_ICON_GROUPS, CustomIconName, renderCustomIcon } from "../icons/CustomIcons";

const C = Colors.light;
export const THERMALS_ACCENT = "#F97316";

const IMPORTANT_PATTERNS = [/cpu/i, /gpu/i, /ram/i, /memory/i, /vram/i, /dram/i];
export function isImportantTemp(label: string): boolean {
  return IMPORTANT_PATTERNS.some(p => p.test(label));
}

// Icons prefixed with "mci:" use MaterialCommunityIcons; others use Feather
export const SENSOR_ICON_OPTIONS: string[] = [
  // ── PC Case / Chassis ──
  "mci:desktop-tower", "mci:desktop-classic", "mci:server", "mci:server-outline",
  "mci:nas",

  // ── Motherboard ──
  "mci:motherboard", "mci:motherboard-outline",

  // ── CPU / Processor ──
  "mci:chip", "mci:cpu-64-bit", "mci:cpu-32-bit", "mci:integrated-circuit-chip",

  // ── GPU / Graphics / Expansion Cards ──
  "mci:expansion-card", "mci:pci-card", "mci:pci-card-outline",

  // ── RAM / Memory ──
  "mci:memory",

  // ── Storage — HDD / SSD / M.2 ──
  "mci:harddisk", "mci:solid-state-drive", "mci:solid-state-drive-outline", "mci:disc",

  // ── Storage — Removable ──
  "mci:sd-card", "mci:usb-flash-drive", "mci:usb-flash-drive-outline",

  // ── Power Supply ──
  "mci:power-plug", "mci:power-plug-outline",
  "mci:power-socket", "mci:power-socket-eu",
  "mci:lightning-bolt", "mci:lightning-bolt-outline",
  "mci:battery-charging", "mci:battery-charging-100",
  "mci:transmission-tower",

  // ── Case Fans ──
  "mci:fan", "mci:fan-speed-1", "mci:fan-speed-2", "mci:fan-speed-3",
  "mci:fan-alert", "mci:fan-auto", "mci:fan-plus", "mci:fan-minus",

  // ── Air Cooling (CPU cooler / heatsink) ──
  "mci:heating-coil",

  // ── Liquid Cooling — Pump / Reservoir ──
  "mci:water-pump", "mci:water-pump-off",

  // ── Liquid Cooling — Coolant / Tubes ──
  "mci:water", "mci:water-outline",
  "mci:pipe", "mci:pipe-disconnected",
  "mci:snowflake", "mci:coolant-temperature",

  // ── VRM / Electronics ──
  "mci:resistor",

  // ── Temperature / Thermals ──
  "mci:thermometer", "mci:thermometer-high", "mci:thermometer-low",
  "mci:thermometer-alert", "mci:thermometer-lines",

  // ── Speed / Gauge (RPM, pressure) ──
  "mci:gauge", "mci:gauge-full", "mci:gauge-low",
  "mci:speedometer", "mci:speedometer-medium", "mci:speedometer-slow",

  // ── Networking / Connectivity ──
  "mci:ethernet", "mci:wifi",
  "mci:router-wireless", "mci:router-network",
  "mci:network", "mci:lan", "mci:lan-connect",
  "mci:access-point", "mci:access-point-network",

  // ── Bluetooth ──
  "mci:bluetooth", "mci:bluetooth-audio",

  // ── USB / IO Ports ──
  "mci:usb", "mci:usb-port", "mci:usb-c-port",

  // ── Display / Monitor ──
  "mci:monitor", "mci:monitor-multiple", "mci:television", "mci:projector",

  // ── Keyboard ──
  "mci:keyboard", "mci:keyboard-outline",

  // ── Mouse ──
  "mci:mouse", "mci:mouse-outline",

  // ── Headphones / Headset ──
  "mci:headphones", "mci:headset",

  // ── Microphone ──
  "mci:microphone", "mci:microphone-outline", "mci:microphone-variant",

  // ── Speaker / Audio ──
  "mci:speaker", "mci:speaker-multiple", "mci:surround-sound",
  "mci:speaker-wireless", "mci:volume-high",

  // ── Webcam ──
  "mci:webcam", "mci:webcam-outline",

  // ── Printer / Scanner ──
  "mci:printer", "mci:printer-outline", "mci:scanner",

  // ── Gaming / Controllers ──
  "mci:gamepad-variant", "mci:gamepad-variant-outline",
  "mci:controller-classic", "mci:controller-classic-outline",
  "mci:joystick",

  // ── Custom PC hardware icons (from SVG sprite) ──
  ...CUSTOM_ICON_GROUPS.flatMap(g => g.icons),
];

export function defaultSensorIcon(key: string): string {
  const label = key.slice(2).toLowerCase();
  if (key.startsWith("t:")) {
    if (/cpu|processor/i.test(label)) return "mci:chip";
    if (/gpu|vga|graphics|video/i.test(label)) return "mci:expansion-card";
    if (/water|liquid|coolant|loop|reservoir/i.test(label)) return "mci:water";
    if (/rad|radiator/i.test(label)) return "mci:heating-coil";
    if (/vrm|mosfet/i.test(label)) return "mci:resistor";
    if (/chipset/i.test(label)) return "mci:integrated-circuit-chip";
    if (/memory|ram|dram|vram/i.test(label)) return "mci:memory";
    if (/nvme|m\.2|ssd|hdd/i.test(label)) return "mci:harddisk";
    if (/system|mb|motherboard/i.test(label)) return "mci:motherboard";
    return "mci:thermometer";
  }
  // fans / pumps
  if (/pump/i.test(label)) return "mci:water-pump";
  if (/water|liquid|loop|coolant/i.test(label)) return "mci:water";
  if (/cpu/i.test(label)) return "mci:fan";
  if (/gpu|graphics/i.test(label)) return "mci:fan";
  if (/chassis|case|system/i.test(label)) return "mci:fan-speed-1";
  return "mci:fan";
}

export function renderSensorIcon(name: string, size: number, color: string): React.ReactElement {
  if (name.startsWith("si:")) {
    return renderCustomIcon(name as CustomIconName, size, color) ?? <Feather name="layers" size={size} color={color} />;
  }
  if (name.startsWith("mci:")) {
    return <MaterialCommunityIcons name={name.slice(4) as any} size={size} color={color} />;
  }
  return <Feather name={name as any} size={size} color={color} />;
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
  const getIcon = (key: string) => sensorIcons[key] ?? defaultSensorIcon(key);

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
                : `${fan!.rpm}`;

              const color = isTemp ? tempColor(sensor!.value) : rpmColor(fan!.rpm);
              const icon = getIcon(key);

              return (
                <View key={key} style={styles.tile}>
                  <View style={styles.tileIcon}>{renderSensorIcon(icon, 22, C.textMuted)}</View>
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
