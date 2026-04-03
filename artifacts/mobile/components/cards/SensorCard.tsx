import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SensorReading } from "@/context/PcsContext";
import Colors from "@/constants/colors";
import { CardBase, MiniBar, StatRow, TempBadge } from "./CardBase";

const C = Colors.light;

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatValue(s: SensorReading): string {
  switch (s.type) {
    case "temperature": return `${s.value.toFixed(1)} °C`;
    case "fan":         return `${Math.round(s.value)} RPM`;
    case "clock":       return s.value >= 1000
                          ? `${(s.value / 1000).toFixed(2)} GHz`
                          : `${Math.round(s.value)} MHz`;
    case "voltage":     return `${s.value.toFixed(3)} V`;
    case "power":       return `${s.value.toFixed(1)} W`;
    case "current":     return `${s.value.toFixed(2)} A`;
    case "usage":       return `${s.value.toFixed(1)} %`;
    default:            return s.unit ? `${s.value} ${s.unit}` : String(s.value);
  }
}

function formatBigNum(s: SensorReading): { num: string; unit: string } {
  switch (s.type) {
    case "temperature": return { num: s.value.toFixed(1), unit: "°C" };
    case "fan":         return { num: Math.round(s.value).toString(), unit: "RPM" };
    case "usage":       return { num: Math.round(s.value).toString(), unit: "%" };
    case "clock":       return s.value >= 1000
                          ? { num: (s.value / 1000).toFixed(2), unit: "GHz" }
                          : { num: Math.round(s.value).toString(), unit: "MHz" };
    case "power":       return { num: s.value.toFixed(1), unit: "W" };
    case "voltage":     return { num: s.value.toFixed(3), unit: "V" };
    case "current":     return { num: s.value.toFixed(2), unit: "A" };
    default:            return { num: s.value.toFixed(1), unit: s.unit };
  }
}

function valueColor(s: SensorReading, accent: string): string {
  if (s.type === "temperature") {
    if (s.value > 85) return "#FF4444";
    if (s.value > 70) return "#FFB800";
  }
  if (s.type === "fan") {
    if (s.value > 3000) return "#FF4444";
    if (s.value > 2000) return "#FFB800";
  }
  return accent;
}

// ─── Featured sensor selection ────────────────────────────────────────────────

const FEATURE_PRIORITY = ["usage", "temperature", "power", "fan", "clock", "voltage", "current", "other"];

function pickFeatured(sensors: SensorReading[]): SensorReading | null {
  for (const type of FEATURE_PRIORITY) {
    const found = sensors.find((s) => s.type === type);
    if (found) return found;
  }
  return sensors[0] ?? null;
}

// ─── Edit button ──────────────────────────────────────────────────────────────

function EditButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.editBtn} hitSlop={10}>
      <Feather name="edit-2" size={13} color={C.textMuted} />
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  title: string;
  icon: string;
  sensorLabels: string[];
  accentColor: string;
  sensors?: SensorReading[];
  onEdit?: () => void;
}

export function SensorCard({ title, icon, sensorLabels, accentColor, sensors, onEdit }: Props) {
  // Build a lookup from label → reading
  const sensorMap = new Map<string, SensorReading>();
  if (sensors) {
    for (const s of sensors) sensorMap.set(s.label, s);
  }

  const resolved = sensorLabels
    .map((lbl) => ({ label: lbl, sensor: sensorMap.get(lbl) }))
    .filter((r) => r.sensor !== undefined) as { label: string; sensor: SensorReading }[];

  const missing = sensorLabels.filter((lbl) => !sensorMap.has(lbl));

  // ── Layout decision ────────────────────────────────────────────────────────
  // Use split layout (big number + stat rows) when we have 2+ sensors.
  // Use centered layout for a single sensor.
  // Use pure stat rows when all values are the same type (e.g. all fans) or >6 sensors.
  const useSplitLayout = resolved.length >= 2 && resolved.length <= 8;
  const featured = useSplitLayout ? pickFeatured(resolved.map((r) => r.sensor)) : null;
  const rest = featured
    ? resolved.filter((r) => r.sensor !== featured)
    : resolved;

  const bigColor = featured ? valueColor(featured, accentColor) : accentColor;
  const bigNum   = featured ? formatBigNum(featured) : null;

  // Show TempBadge in header if featured is a temperature sensor
  const headerTemp =
    featured?.type === "temperature" ? featured.value : null;

  const featureIsUsage =
    featured?.type === "usage" || featured?.type === "fan";

  return (
    <CardBase
      icon={(icon as keyof typeof Feather.glyphMap) || "layers"}
      title={title}
      subtitle={`${sensorLabels.length} sensor${sensorLabels.length !== 1 ? "s" : ""}`}
      accentColor={accentColor}
      temperature={headerTemp}
      rightAction={onEdit && !headerTemp ? <EditButton onPress={onEdit} /> : undefined}
    >
      {/* Edit button row — shown when there's a temp badge taking the right slot */}
      {onEdit && headerTemp != null && (
        <Pressable onPress={onEdit} style={styles.editRow} hitSlop={6}>
          <Feather name="edit-2" size={12} color={C.textMuted} />
          <Text style={styles.editRowText}>Edit card</Text>
        </Pressable>
      )}

      {resolved.length === 0 && sensorLabels.length === 0 ? (
        <Text style={styles.empty}>No sensors selected.{onEdit ? " Tap edit to add some." : ""}</Text>
      ) : resolved.length === 0 ? (
        <Text style={styles.empty}>Sensor data unavailable — make sure HWiNFO64 is running.</Text>
      ) : useSplitLayout && featured ? (
        /* ── SPLIT LAYOUT ── */
        <>
          <View style={styles.mainRow}>
            {/* Featured big number */}
            <View style={styles.bigStat}>
              <Text style={[styles.bigNum, { color: bigColor }]}>
                {bigNum!.num}
                <Text style={styles.bigUnit}>{bigNum!.unit}</Text>
              </Text>
              <Text style={styles.bigLabel} numberOfLines={2}>{featured.label}</Text>
            </View>

            {/* Rest as stat rows */}
            <View style={styles.detailGrid}>
              {rest.slice(0, 6).map((r, i) => (
                <StatRow
                  key={i}
                  label={r.sensor.label}
                  value={formatValue(r.sensor)}
                  color={valueColor(r.sensor, accentColor)}
                />
              ))}
            </View>
          </View>

          {/* Progress bar for usage/fan featured */}
          {featureIsUsage && featured.type === "usage" && (
            <View style={styles.barSection}>
              <MiniBar value={featured.value} color={accentColor} height={5} />
            </View>
          )}

          {/* Overflow rows beyond 6 */}
          {rest.length > 6 && (
            <View style={styles.overflowRows}>
              {rest.slice(6).map((r, i) => (
                <StatRow
                  key={i}
                  label={r.sensor.label}
                  value={formatValue(r.sensor)}
                  color={valueColor(r.sensor, accentColor)}
                />
              ))}
            </View>
          )}
        </>
      ) : resolved.length === 1 ? (
        /* ── SINGLE SENSOR — centered big number ── */
        <View style={styles.singleStat}>
          <Text style={[styles.singleNum, { color: bigColor }]}>
            {bigNum?.num ?? formatValue(resolved[0].sensor)}
            {bigNum && <Text style={styles.singleUnit}>{bigNum.unit}</Text>}
          </Text>
          <Text style={styles.bigLabel}>{resolved[0].sensor.label}</Text>
          {resolved[0].sensor.type === "usage" && (
            <View style={{ marginTop: 8, width: "100%" }}>
              <MiniBar value={resolved[0].sensor.value} color={accentColor} height={5} />
            </View>
          )}
        </View>
      ) : (
        /* ── PURE STAT ROWS (many sensors) ── */
        <View style={styles.pureRows}>
          {resolved.map((r, i) => (
            <StatRow
              key={i}
              label={r.sensor.label}
              value={formatValue(r.sensor)}
              color={valueColor(r.sensor, accentColor)}
            />
          ))}
        </View>
      )}

      {/* Missing sensors notice */}
      {missing.length > 0 && (
        <Text style={styles.missingNote}>
          {missing.length} sensor{missing.length > 1 ? "s" : ""} not in current HWiNFO64 data
        </Text>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.backgroundSecondary,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-end",
    marginTop: -4,
  },
  editRowText: {
    fontSize: 11,
    color: C.textMuted,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  bigStat: {
    alignItems: "center",
    minWidth: 68,
  },
  bigNum: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 38,
  },
  bigUnit: {
    fontSize: 16,
    fontWeight: "500",
  },
  bigLabel: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 3,
    textAlign: "center",
    lineHeight: 14,
  },
  detailGrid: {
    flex: 1,
    gap: 5,
    justifyContent: "center",
  },
  barSection: {
    marginTop: 2,
  },
  overflowRows: {
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    paddingTop: 8,
    marginTop: 4,
  },
  singleStat: {
    alignItems: "center",
    paddingVertical: 8,
  },
  singleNum: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 52,
  },
  singleUnit: {
    fontSize: 22,
    fontWeight: "500",
  },
  pureRows: {
    gap: 5,
  },
  empty: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    paddingVertical: 12,
    lineHeight: 20,
  },
  missingNote: {
    fontSize: 11,
    color: C.textMuted,
    fontStyle: "italic",
    textAlign: "right",
  },
});
