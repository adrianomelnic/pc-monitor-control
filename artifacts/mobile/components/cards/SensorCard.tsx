import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SensorReading } from "@/context/PcsContext";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Props {
  title: string;
  sensorLabels: string[];
  accentColor: string;
  sensors?: SensorReading[];
}

function formatValue(s: SensorReading): string {
  const v = s.value;
  if (s.type === "temperature") return `${v.toFixed(1)} ${s.unit}`;
  if (s.type === "fan") return `${Math.round(v)} ${s.unit}`;
  if (s.type === "clock") return v >= 1000 ? `${(v / 1000).toFixed(2)} GHz` : `${Math.round(v)} ${s.unit}`;
  if (s.type === "voltage") return `${v.toFixed(3)} ${s.unit}`;
  if (s.type === "power") return `${v.toFixed(1)} ${s.unit}`;
  if (s.type === "current") return `${v.toFixed(2)} ${s.unit}`;
  if (s.type === "usage") return `${v.toFixed(1)} ${s.unit}`;
  return s.unit ? `${v} ${s.unit}` : String(v);
}

function valueColor(s: SensorReading): string {
  if (s.type === "temperature") {
    if (s.value > 85) return C.danger;
    if (s.value > 70) return C.warning;
  }
  if (s.type === "usage") {
    if (s.value > 90) return C.danger;
    if (s.value > 75) return C.warning;
  }
  return C.text;
}

const TYPE_ICONS: Record<string, string> = {
  temperature: "thermometer",
  fan: "wind",
  voltage: "zap",
  power: "activity",
  current: "zap",
  clock: "cpu",
  usage: "percent",
  other: "hash",
};

export function SensorCard({ title, sensorLabels, accentColor, sensors }: Props) {
  const sensorMap = new Map<string, SensorReading>();
  if (sensors) {
    for (const s of sensors) {
      sensorMap.set(s.label, s);
    }
  }

  const rows = sensorLabels
    .map((lbl) => ({ label: lbl, sensor: sensorMap.get(lbl) }));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>No sensors selected. Edit to add sensors.</Text>
      ) : (
        <View style={styles.rows}>
          {rows.map(({ label, sensor }) => {
            const icon = sensor ? TYPE_ICONS[sensor.type] ?? "hash" : "help-circle";
            return (
              <View key={label} style={styles.row}>
                <Feather
                  name={icon as any}
                  size={13}
                  color={accentColor}
                  style={{ marginTop: 1 }}
                />
                <Text style={styles.label} numberOfLines={1}>{label}</Text>
                <Text style={[styles.value, { color: sensor ? valueColor(sensor) : C.textMuted }]}>
                  {sensor ? formatValue(sensor) : "—"}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  accentBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.3,
    flex: 1,
  },
  rows: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: C.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  empty: {
    fontSize: 13,
    color: C.textMuted,
    padding: 16,
    textAlign: "center",
  },
});
