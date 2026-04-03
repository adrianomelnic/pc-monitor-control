import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

// ─── Inline label editor ──────────────────────────────────────────────────────

interface EditableLabelProps {
  originalLabel: string;
  displayLabel: string;
  isEditing: boolean;
  accentColor: string;
  style?: object;
  onPress: () => void;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  onBlur: () => void;
}

function EditableLabel({
  originalLabel,
  displayLabel,
  isEditing,
  accentColor,
  style,
  onPress,
  onChangeText,
  onSubmit,
  onBlur,
}: EditableLabelProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) {
      // Small delay so the layout settles before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <TextInput
        ref={inputRef}
        style={[styles.inlineInput, style, { borderBottomColor: accentColor }]}
        defaultValue={displayLabel}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onBlur={onBlur}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        selectTextOnFocus
      />
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.editableLabelWrap}>
      <Text style={[styles.editableLabelText, style]} numberOfLines={2}>
        {displayLabel}
      </Text>
      <Feather name="edit-2" size={10} color={accentColor} style={{ marginLeft: 4, opacity: 0.7 }} />
    </Pressable>
  );
}

// ─── Editable stat row ────────────────────────────────────────────────────────

interface EditableStatRowProps {
  originalLabel: string;
  displayLabel: string;
  value: string;
  color?: string;
  accentColor: string;
  isEditing: boolean;
  onPress: () => void;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  onBlur: () => void;
}

function EditableStatRow({
  originalLabel,
  displayLabel,
  value,
  color,
  accentColor,
  isEditing,
  onPress,
  onChangeText,
  onSubmit,
  onBlur,
}: EditableStatRowProps) {
  return (
    <View style={styles.statRow}>
      <EditableLabel
        originalLabel={originalLabel}
        displayLabel={displayLabel}
        isEditing={isEditing}
        accentColor={accentColor}
        style={styles.statLabelText}
        onPress={onPress}
        onChangeText={onChangeText}
        onSubmit={onSubmit}
        onBlur={onBlur}
      />
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  title: string;
  icon: string;
  sensorLabels: string[];
  accentColor: string;
  sensors?: SensorReading[];
  sensorAliases?: Record<string, string>;
  onEdit?: () => void;
  onUpdateAlias?: (originalLabel: string, newAlias: string) => void;
}

export function SensorCard({
  title,
  icon,
  sensorLabels,
  accentColor,
  sensors,
  sensorAliases,
  onEdit,
  onUpdateAlias,
}: Props) {
  // ── Inline edit mode state ────────────────────────────────────────────────
  const [inlineEdit, setInlineEdit] = useState(false);
  const [editingOriginal, setEditingOriginal] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [localAliases, setLocalAliases] = useState<Record<string, string>>(sensorAliases ?? {});

  // Sync when aliases change externally (e.g. after save)
  useEffect(() => {
    setLocalAliases(sensorAliases ?? {});
  }, [sensorAliases]);

  const getDisplayLabel = (original: string) => localAliases[original] ?? original;

  const handleLongPress = () => {
    if (!sensors || sensors.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInlineEdit(true);
  };

  const startLabelEdit = (originalLabel: string) => {
    commitCurrent(); // save any pending edit first
    setEditingOriginal(originalLabel);
    setEditText(localAliases[originalLabel] ?? originalLabel);
  };

  const commitCurrent = () => {
    if (editingOriginal === null) return;
    const newAlias = editText.trim();
    const newAliases = { ...localAliases };
    if (newAlias && newAlias !== editingOriginal) {
      newAliases[editingOriginal] = newAlias;
    } else {
      delete newAliases[editingOriginal];
    }
    setLocalAliases(newAliases);
    onUpdateAlias?.(editingOriginal, newAlias);
    setEditingOriginal(null);
  };

  const exitInlineEdit = () => {
    commitCurrent();
    setInlineEdit(false);
    setEditingOriginal(null);
  };

  // ── Sensor resolution ──────────────────────────────────────────────────────
  const sensorMap = new Map<string, SensorReading>();
  if (sensors) {
    for (const s of sensors) sensorMap.set(s.label, s);
  }

  const resolved = sensorLabels
    .map((lbl) => ({ original: lbl, sensor: sensorMap.get(lbl) }))
    .filter((r) => r.sensor !== undefined) as { original: string; sensor: SensorReading }[];

  const missing = sensorLabels.filter((lbl) => !sensorMap.has(lbl));

  // ── Layout decision ────────────────────────────────────────────────────────
  const useSplitLayout = resolved.length >= 2 && resolved.length <= 8;
  const featured = useSplitLayout ? pickFeatured(resolved.map((r) => r.sensor)) : null;
  const rest = featured ? resolved.filter((r) => r.sensor !== featured) : resolved;

  const bigColor = featured ? valueColor(featured, accentColor) : accentColor;
  const bigNum   = featured ? formatBigNum(featured) : null;
  const featuredOriginal = featured ? resolved.find((r) => r.sensor === featured)?.original ?? "" : "";

  const headerTemp = featured?.type === "temperature" ? featured.value : null;
  const featureIsUsage = featured?.type === "usage";

  // ── Right action slot ──────────────────────────────────────────────────────
  const rightActionEl = inlineEdit ? (
    <Pressable
      onPress={exitInlineEdit}
      style={[styles.doneBtn, { backgroundColor: accentColor + "22", borderColor: accentColor + "66" }]}
      hitSlop={8}
    >
      <Feather name="check" size={11} color={accentColor} />
      <Text style={[styles.doneBtnText, { color: accentColor }]}>Done</Text>
    </Pressable>
  ) : onEdit && !headerTemp ? (
    <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={10}>
      <Feather name="edit-2" size={13} color={C.textMuted} />
    </Pressable>
  ) : undefined;

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={500}
      style={inlineEdit ? { borderRadius: 16, borderWidth: 1.5, borderColor: accentColor + "55" } : undefined}
    >
      <CardBase
        icon={(icon as keyof typeof Feather.glyphMap) || "layers"}
        title={title}
        subtitle={
          inlineEdit
            ? "Tap a label to rename it"
            : `${sensorLabels.length} sensor${sensorLabels.length !== 1 ? "s" : ""}`
        }
        accentColor={accentColor}
        temperature={!inlineEdit ? headerTemp : null}
        rightAction={rightActionEl}
        style={inlineEdit ? { borderRadius: 14, borderTopWidth: 2 } : undefined}
      >
        {/* Edit card row — for when temp badge takes the right slot */}
        {onEdit && headerTemp != null && !inlineEdit && (
          <Pressable onPress={onEdit} style={styles.editRow} hitSlop={6}>
            <Feather name="edit-2" size={12} color={C.textMuted} />
            <Text style={styles.editRowText}>Edit card</Text>
          </Pressable>
        )}

        {resolved.length === 0 && sensorLabels.length === 0 ? (
          <Text style={styles.empty}>
            No sensors selected.{onEdit ? " Tap edit to add some." : ""}
          </Text>
        ) : resolved.length === 0 ? (
          <Text style={styles.empty}>
            Sensor data unavailable — make sure HWiNFO64 is running.
          </Text>
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
                {inlineEdit ? (
                  <EditableLabel
                    originalLabel={featuredOriginal}
                    displayLabel={getDisplayLabel(featuredOriginal)}
                    isEditing={editingOriginal === featuredOriginal}
                    accentColor={accentColor}
                    style={styles.bigLabelText}
                    onPress={() => startLabelEdit(featuredOriginal)}
                    onChangeText={setEditText}
                    onSubmit={commitCurrent}
                    onBlur={commitCurrent}
                  />
                ) : (
                  <Text style={styles.bigLabelText} numberOfLines={2}>
                    {getDisplayLabel(featuredOriginal)}
                  </Text>
                )}
              </View>

              {/* Stat rows */}
              <View style={styles.detailGrid}>
                {rest.slice(0, 6).map((r, i) =>
                  inlineEdit ? (
                    <EditableStatRow
                      key={i}
                      originalLabel={r.original}
                      displayLabel={getDisplayLabel(r.original)}
                      value={formatValue(r.sensor)}
                      color={valueColor(r.sensor, accentColor)}
                      accentColor={accentColor}
                      isEditing={editingOriginal === r.original}
                      onPress={() => startLabelEdit(r.original)}
                      onChangeText={setEditText}
                      onSubmit={commitCurrent}
                      onBlur={commitCurrent}
                    />
                  ) : (
                    <StatRow
                      key={i}
                      label={getDisplayLabel(r.original)}
                      value={formatValue(r.sensor)}
                      color={valueColor(r.sensor, accentColor)}
                    />
                  )
                )}
              </View>
            </View>

            {featureIsUsage && (
              <View style={styles.barSection}>
                <MiniBar value={featured.value} color={accentColor} height={5} />
              </View>
            )}

            {rest.length > 6 && (
              <View style={styles.overflowRows}>
                {rest.slice(6).map((r, i) =>
                  inlineEdit ? (
                    <EditableStatRow
                      key={i}
                      originalLabel={r.original}
                      displayLabel={getDisplayLabel(r.original)}
                      value={formatValue(r.sensor)}
                      color={valueColor(r.sensor, accentColor)}
                      accentColor={accentColor}
                      isEditing={editingOriginal === r.original}
                      onPress={() => startLabelEdit(r.original)}
                      onChangeText={setEditText}
                      onSubmit={commitCurrent}
                      onBlur={commitCurrent}
                    />
                  ) : (
                    <StatRow
                      key={i}
                      label={getDisplayLabel(r.original)}
                      value={formatValue(r.sensor)}
                      color={valueColor(r.sensor, accentColor)}
                    />
                  )
                )}
              </View>
            )}
          </>
        ) : resolved.length === 1 ? (
          /* ── SINGLE SENSOR ── */
          <View style={styles.singleStat}>
            <Text style={[styles.singleNum, { color: bigColor }]}>
              {formatBigNum(resolved[0].sensor).num}
              <Text style={styles.singleUnit}>{formatBigNum(resolved[0].sensor).unit}</Text>
            </Text>
            {inlineEdit ? (
              <EditableLabel
                originalLabel={resolved[0].original}
                displayLabel={getDisplayLabel(resolved[0].original)}
                isEditing={editingOriginal === resolved[0].original}
                accentColor={accentColor}
                style={styles.bigLabelText}
                onPress={() => startLabelEdit(resolved[0].original)}
                onChangeText={setEditText}
                onSubmit={commitCurrent}
                onBlur={commitCurrent}
              />
            ) : (
              <Text style={styles.bigLabelText}>{getDisplayLabel(resolved[0].original)}</Text>
            )}
            {resolved[0].sensor.type === "usage" && (
              <View style={{ marginTop: 8, width: "100%" }}>
                <MiniBar value={resolved[0].sensor.value} color={accentColor} height={5} />
              </View>
            )}
          </View>
        ) : (
          /* ── PURE STAT ROWS ── */
          <View style={styles.pureRows}>
            {resolved.map((r, i) =>
              inlineEdit ? (
                <EditableStatRow
                  key={i}
                  originalLabel={r.original}
                  displayLabel={getDisplayLabel(r.original)}
                  value={formatValue(r.sensor)}
                  color={valueColor(r.sensor, accentColor)}
                  accentColor={accentColor}
                  isEditing={editingOriginal === r.original}
                  onPress={() => startLabelEdit(r.original)}
                  onChangeText={setEditText}
                  onSubmit={commitCurrent}
                  onBlur={commitCurrent}
                />
              ) : (
                <StatRow
                  key={i}
                  label={getDisplayLabel(r.original)}
                  value={formatValue(r.sensor)}
                  color={valueColor(r.sensor, accentColor)}
                />
              )
            )}
          </View>
        )}

        {/* Missing sensors notice */}
        {missing.length > 0 && (
          <Text style={styles.missingNote}>
            {missing.length} sensor{missing.length > 1 ? "s" : ""} not in current HWiNFO64 data
          </Text>
        )}
      </CardBase>
    </Pressable>
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
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: "700",
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
  bigLabelText: {
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
  // Editable label
  editableLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    flexGrow: 0,
  },
  editableLabelText: {
    // inherits style from parent
  },
  inlineInput: {
    flex: 1,
    borderBottomWidth: 1.5,
    fontSize: 12,
    color: C.text,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginRight: 4,
    minWidth: 60,
  },
  // Stat rows
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  statLabelText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
    flexShrink: 1,
  },
  statValue: {
    fontSize: 12,
    color: C.text,
    fontWeight: "700",
    flexShrink: 0,
  },
  // Misc
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
