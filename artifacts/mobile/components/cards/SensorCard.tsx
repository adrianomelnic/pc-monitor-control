import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SensorReading } from "@/context/PcsContext";
import Colors from "@/constants/colors";
import { CardBase, MiniBar, StatRow } from "./CardBase";

const C = Colors.light;

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatValue(s: SensorReading): string {
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

const FEATURE_PRIORITY = ["usage", "temperature", "power", "fan", "clock", "voltage", "current", "other"];

function pickFeatured(sensors: SensorReading[]): SensorReading | null {
  for (const type of FEATURE_PRIORITY) {
    const found = sensors.find((s) => s.type === type);
    if (found) return found;
  }
  return sensors[0] ?? null;
}

export const TYPE_BADGE: Record<string, string> = {
  temperature: "°C",
  fan: "RPM",
  voltage: "V",
  power: "W",
  current: "A",
  usage: "%",
  clock: "MHz",
};

export function groupSensors(sensors: SensorReading[]): { comp: string; items: SensorReading[] }[] {
  const map = new Map<string, SensorReading[]>();
  for (const s of sensors) {
    const comp = s.component || "Other";
    if (!map.has(comp)) map.set(comp, []);
    map.get(comp)!.push(s);
  }
  return Array.from(map.entries()).map(([comp, items]) => ({ comp, items }));
}

// ─── Compact sensor picker ────────────────────────────────────────────────────

interface CompactPickerProps {
  visible: boolean;
  title: string;
  accentColor: string;
  sensors: SensorReading[];
  excludeLabels: string[];
  onSelect: (label: string) => void;
  onClose: () => void;
}

export function CompactSensorPicker({
  visible,
  title,
  accentColor,
  sensors,
  excludeLabels,
  onSelect,
  onClose,
}: CompactPickerProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSearch("");
      const allGroups = groupSensors(
        sensors.filter((s) => !excludeLabels.includes(s.label))
      );
      setCollapsed(new Set(allGroups.map((g) => g.comp)));
    }
  }, [visible]);

  const available = sensors.filter((s) => !excludeLabels.includes(s.label));
  const filtered = search.trim()
    ? available.filter(
        (s) =>
          s.label.toLowerCase().includes(search.toLowerCase()) ||
          (s.component ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : available;

  const groups = groupSensors(filtered);

  const toggleCollapse = (comp: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(comp) ? next.delete(comp) : next.add(comp);
      return next;
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[pickerStyles.root, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={pickerStyles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={pickerStyles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={pickerStyles.heading}>{title}</Text>
          <View style={{ width: 56 }} />
        </View>

        {/* Search */}
        <View style={pickerStyles.searchWrap}>
          <Feather name="search" size={14} color={C.textMuted} />
          <TextInput
            style={pickerStyles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search sensors..."
            placeholderTextColor={C.textMuted}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Sensor list */}
        <ScrollView
          style={pickerStyles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {groups.length === 0 ? (
            <Text style={pickerStyles.empty}>No sensors found</Text>
          ) : (
            groups.map(({ comp, items }) => {
              const isCollapsed = collapsed.has(comp);
              return (
                <View key={comp} style={pickerStyles.group}>
                  <Pressable onPress={() => toggleCollapse(comp)} style={pickerStyles.groupHeader}>
                    <Text style={pickerStyles.groupName} numberOfLines={1}>{comp}</Text>
                    <Text style={pickerStyles.groupCount}>{items.length}</Text>
                    <Feather name={isCollapsed ? "chevron-right" : "chevron-down"} size={13} color={C.textMuted} />
                  </Pressable>

                  {!isCollapsed && items.map((s, i) => (
                    <Pressable
                      key={i}
                      style={pickerStyles.sensorRow}
                      onPress={() => {
                        onSelect(s.label);
                        onClose();
                      }}
                    >
                      <View style={[pickerStyles.typeBadge, { backgroundColor: accentColor + "22" }]}>
                        <Text style={[pickerStyles.typeBadgeText, { color: accentColor }]}>
                          {TYPE_BADGE[s.type] ?? s.unit}
                        </Text>
                      </View>
                      <Text style={pickerStyles.sensorLabel} numberOfLines={1}>{s.label}</Text>
                      <Text style={pickerStyles.sensorValue}>{formatValue(s)}</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  cancel: {
    fontSize: 14,
    color: C.tint,
    fontWeight: "500",
    width: 56,
  },
  heading: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 12,
  },
  empty: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    marginTop: 40,
  },
  group: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
    backgroundColor: C.card,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: C.backgroundSecondary,
  },
  groupName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: C.text,
  },
  groupCount: {
    fontSize: 11,
    color: C.textMuted,
  },
  sensorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 32,
    alignItems: "center",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  sensorLabel: {
    flex: 1,
    fontSize: 12,
    color: C.text,
  },
  sensorValue: {
    fontSize: 12,
    color: C.textMuted,
  },
});

// ─── Editable label ───────────────────────────────────────────────────────────

interface EditableLabelProps {
  originalLabel: string;
  displayLabel: string;
  isEditing: boolean;
  accentColor: string;
  textStyle?: object;
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
  textStyle,
  onPress,
  onChangeText,
  onSubmit,
  onBlur,
}: EditableLabelProps) {
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    if (isEditing) setTimeout(() => ref.current?.focus(), 50);
  }, [isEditing]);

  if (isEditing) {
    return (
      <TextInput
        ref={ref}
        style={[elStyles.input, textStyle, { borderBottomColor: accentColor }]}
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
    <Pressable onPress={onPress} style={elStyles.wrap} hitSlop={4}>
      <Text style={[elStyles.text, textStyle]} numberOfLines={2}>
        {displayLabel}
      </Text>
      <Feather name="edit-2" size={9} color={accentColor} style={{ marginLeft: 3, opacity: 0.6 }} />
    </Pressable>
  );
}

const elStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  text: { flexShrink: 1 },
  input: {
    borderBottomWidth: 1.5,
    fontSize: 12,
    color: C.text,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 50,
    flex: 1,
  },
});

// ─── Inline edit stat row (label editable + swap + remove) ────────────────────

interface InlineStatRowProps {
  originalLabel: string;
  displayLabel: string;
  value: string;
  color?: string;
  accentColor: string;
  isEditingLabel: boolean;
  onPressLabel: () => void;
  onLabelChange: (t: string) => void;
  onLabelSubmit: () => void;
  onLabelBlur: () => void;
  onSwap: () => void;
  onRemove: () => void;
}

function InlineStatRow({
  originalLabel,
  displayLabel,
  value,
  color,
  accentColor,
  isEditingLabel,
  onPressLabel,
  onLabelChange,
  onLabelSubmit,
  onLabelBlur,
  onSwap,
  onRemove,
}: InlineStatRowProps) {
  return (
    <View style={irStyles.row}>
      <EditableLabel
        originalLabel={originalLabel}
        displayLabel={displayLabel}
        isEditing={isEditingLabel}
        accentColor={accentColor}
        textStyle={irStyles.label}
        onPress={onPressLabel}
        onChangeText={onLabelChange}
        onSubmit={onLabelSubmit}
        onBlur={onLabelBlur}
      />
      <Text style={[irStyles.value, color ? { color } : null]}>{value}</Text>
      <Pressable onPress={onSwap} hitSlop={6} style={irStyles.actionBtn}>
        <Feather name="repeat" size={12} color={C.textMuted} />
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={6} style={irStyles.actionBtn}>
        <Feather name="x" size={12} color="#FF6B6B" />
      </Pressable>
    </View>
  );
}

const irStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  value: {
    fontSize: 12,
    color: C.text,
    fontWeight: "700",
    flexShrink: 0,
  },
  actionBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});

// ─── Main SensorCard component ────────────────────────────────────────────────

interface Props {
  title: string;
  icon: string;
  sensorLabels: string[];
  accentColor: string;
  sensors?: SensorReading[];
  sensorAliases?: Record<string, string>;
  onEdit?: () => void;
  onUpdateTitle?: (newTitle: string) => void;
  onUpdateAlias?: (originalLabel: string, newAlias: string) => void;
  onSwapSensor?: (oldLabel: string, newLabel: string) => void;
  onAddSensor?: (newLabel: string) => void;
  onRemoveSensor?: (label: string) => void;
}

export function SensorCard({
  title,
  icon,
  sensorLabels,
  accentColor,
  sensors,
  sensorAliases,
  onEdit,
  onUpdateTitle,
  onUpdateAlias,
  onSwapSensor,
  onAddSensor,
  onRemoveSensor,
}: Props) {
  // ── Inline edit state ──────────────────────────────────────────────────────
  const [inlineEdit, setInlineEdit] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  // Label renaming
  const [editingOriginal, setEditingOriginal] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [localAliases, setLocalAliases] = useState<Record<string, string>>(sensorAliases ?? {});

  // Compact sensor picker for swap/add
  const [pickerMode, setPickerMode] = useState<"swap" | "add" | null>(null);
  const [swappingOriginal, setSwappingOriginal] = useState<string | null>(null);

  // Sync aliases from props
  useEffect(() => {
    setLocalAliases(sensorAliases ?? {});
  }, [sensorAliases]);

  // Sync title draft from props
  useEffect(() => {
    if (!inlineEdit) setTitleDraft(title);
  }, [title, inlineEdit]);

  const getDisplayLabel = (original: string) => localAliases[original] ?? original;

  // Long-press enters inline edit mode
  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTitleDraft(title);
    setInlineEdit(true);
  };

  // Commit any pending label rename
  const commitLabel = () => {
    if (editingOriginal === null) return;
    const newAlias = editText.trim();
    const next = { ...localAliases };
    if (newAlias && newAlias !== editingOriginal) {
      next[editingOriginal] = newAlias;
    } else {
      delete next[editingOriginal];
    }
    setLocalAliases(next);
    onUpdateAlias?.(editingOriginal, newAlias);
    setEditingOriginal(null);
  };

  const startLabelEdit = (original: string) => {
    commitLabel();
    setEditingOriginal(original);
    setEditText(localAliases[original] ?? original);
  };

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== title) onUpdateTitle?.(t);
  };

  const exitInlineEdit = () => {
    commitLabel();
    commitTitle();
    setInlineEdit(false);
    setEditingOriginal(null);
  };

  // ── Sensor resolution ──────────────────────────────────────────────────────
  const sensorMap = new Map<string, SensorReading>();
  if (sensors) for (const s of sensors) sensorMap.set(s.label, s);

  const resolved = sensorLabels
    .map((lbl) => ({ original: lbl, sensor: sensorMap.get(lbl) }))
    .filter((r) => r.sensor !== undefined) as { original: string; sensor: SensorReading }[];

  const missing = sensorLabels.filter((lbl) => !sensorMap.has(lbl));

  // ── Layout decision ────────────────────────────────────────────────────────
  const useSplitLayout = resolved.length >= 2 && resolved.length <= 8;
  const featured = useSplitLayout ? pickFeatured(resolved.map((r) => r.sensor)) : null;
  const featuredItem = featured ? resolved.find((r) => r.sensor === featured) ?? null : null;
  const rest = featuredItem ? resolved.filter((r) => r !== featuredItem) : resolved;

  const bigColor = featured ? valueColor(featured, accentColor) : accentColor;
  const bigNum = featured ? formatBigNum(featured) : null;
  const headerTemp = !inlineEdit && featured?.type === "temperature" ? featured.value : null;

  // Exclude labels for the picker
  const excludeForPicker =
    pickerMode === "add"
      ? sensorLabels
      : pickerMode === "swap" && swappingOriginal
      ? sensorLabels.filter((l) => l !== swappingOriginal)
      : [];

  // ── Right action ──────────────────────────────────────────────────────────
  const rightAction = inlineEdit ? (
    <Pressable
      onPress={exitInlineEdit}
      style={[styles.doneBtn, { backgroundColor: accentColor + "22", borderColor: accentColor + "55" }]}
      hitSlop={8}
    >
      <Feather name="check" size={11} color={accentColor} />
      <Text style={[styles.doneBtnText, { color: accentColor }]}>Done</Text>
    </Pressable>
  ) : undefined;

  // ── Sensor rows renderer ───────────────────────────────────────────────────
  const renderSensorRow = (r: { original: string; sensor: SensorReading }, i: number) => {
    if (inlineEdit) {
      return (
        <InlineStatRow
          key={i}
          originalLabel={r.original}
          displayLabel={getDisplayLabel(r.original)}
          value={formatValue(r.sensor)}
          color={valueColor(r.sensor, accentColor)}
          accentColor={accentColor}
          isEditingLabel={editingOriginal === r.original}
          onPressLabel={() => startLabelEdit(r.original)}
          onLabelChange={setEditText}
          onLabelSubmit={commitLabel}
          onLabelBlur={commitLabel}
          onSwap={() => {
            commitLabel();
            setSwappingOriginal(r.original);
            setPickerMode("swap");
          }}
          onRemove={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRemoveSensor?.(r.original);
          }}
        />
      );
    }
    return (
      <StatRow
        key={i}
        label={getDisplayLabel(r.original)}
        value={formatValue(r.sensor)}
        color={valueColor(r.sensor, accentColor)}
      />
    );
  };

  const renderBigLabel = (original: string) => {
    if (inlineEdit) {
      return (
        <View style={styles.bigLabelEditWrap}>
          <EditableLabel
            originalLabel={original}
            displayLabel={getDisplayLabel(original)}
            isEditing={editingOriginal === original}
            accentColor={accentColor}
            textStyle={styles.bigLabelText}
            onPress={() => startLabelEdit(original)}
            onChangeText={setEditText}
            onSubmit={commitLabel}
            onBlur={commitLabel}
          />
          <View style={styles.bigLabelActions}>
            <Pressable
              onPress={() => {
                commitLabel();
                setSwappingOriginal(original);
                setPickerMode("swap");
              }}
              hitSlop={6}
              style={styles.smallActionBtn}
            >
              <Feather name="repeat" size={11} color={C.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => onRemoveSensor?.(original)}
              hitSlop={6}
              style={styles.smallActionBtn}
            >
              <Feather name="x" size={11} color="#FF6B6B" />
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <Text style={styles.bigLabelText} numberOfLines={2}>
        {getDisplayLabel(original)}
      </Text>
    );
  };

  return (
    <>
      <Pressable onLongPress={handleLongPress} delayLongPress={500}>
        <CardBase
          icon={(icon as keyof typeof Feather.glyphMap) || "layers"}
          title={title}
          subtitle={inlineEdit ? "Hold label to rename · ⇄ swap · × remove" : `${sensorLabels.length} sensor${sensorLabels.length !== 1 ? "s" : ""}`}
          accentColor={accentColor}
          temperature={headerTemp}
          rightAction={rightAction}
          titleEditable={inlineEdit}
          titleDraft={titleDraft}
          onTitleChange={setTitleDraft}
          onTitleSubmit={commitTitle}
          style={inlineEdit ? { borderColor: accentColor + "66", borderWidth: 1.5 } : undefined}
        >
          {resolved.length === 0 && sensorLabels.length === 0 ? (
            <Text style={styles.empty}>
              No sensors selected.
              {onEdit ? " Long-press to edit." : ""}
            </Text>
          ) : resolved.length === 0 ? (
            <Text style={styles.empty}>
              Sensor data unavailable — make sure HWiNFO64 is running.
            </Text>
          ) : useSplitLayout && featured && featuredItem ? (
            /* ── SPLIT LAYOUT ── */
            <>
              <View style={styles.mainRow}>
                {/* Featured big number */}
                <View style={styles.bigStat}>
                  <Text style={[styles.bigNum, { color: bigColor }]}>
                    {bigNum!.num}
                    <Text style={styles.bigUnit}>{bigNum!.unit}</Text>
                  </Text>
                  {renderBigLabel(featuredItem.original)}
                </View>

                {/* Stat rows */}
                <View style={styles.detailGrid}>
                  {rest.slice(0, 6).map((r, i) => renderSensorRow(r, i))}
                </View>
              </View>

              {featured.type === "usage" && (
                <View style={styles.barSection}>
                  <MiniBar value={featured.value} color={accentColor} height={5} />
                </View>
              )}

              {rest.length > 6 && (
                <View style={styles.overflowRows}>
                  {rest.slice(6).map((r, i) => renderSensorRow(r, i + 6))}
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
              {renderBigLabel(resolved[0].original)}
              {resolved[0].sensor.type === "usage" && (
                <View style={{ marginTop: 8, width: "100%" }}>
                  <MiniBar value={resolved[0].sensor.value} color={accentColor} height={5} />
                </View>
              )}
            </View>
          ) : (
            /* ── PURE STAT ROWS ── */
            <View style={styles.pureRows}>
              {resolved.map((r, i) => renderSensorRow(r, i))}
            </View>
          )}

          {/* Missing sensors notice */}
          {missing.length > 0 && !inlineEdit && (
            <Text style={styles.missingNote}>
              {missing.length} sensor{missing.length > 1 ? "s" : ""} not in current data
            </Text>
          )}

          {/* Add sensor + Full edit (inline edit mode only) */}
          {inlineEdit && (
            <View style={styles.editActions}>
              <Pressable
                style={[styles.editActionBtn, { borderColor: accentColor + "55" }]}
                onPress={() => {
                  commitLabel();
                  setSwappingOriginal(null);
                  setPickerMode("add");
                }}
              >
                <Feather name="plus" size={13} color={accentColor} />
                <Text style={[styles.editActionText, { color: accentColor }]}>Add sensor</Text>
              </Pressable>

              {onEdit && (
                <Pressable
                  style={styles.editActionBtn}
                  onPress={() => {
                    exitInlineEdit();
                    onEdit();
                  }}
                >
                  <Feather name="sliders" size={13} color={C.textMuted} />
                  <Text style={styles.editActionText}>Full edit</Text>
                </Pressable>
              )}
            </View>
          )}
        </CardBase>
      </Pressable>

      {/* Compact sensor picker modal */}
      <CompactSensorPicker
        visible={pickerMode !== null}
        title={pickerMode === "add" ? "Add Sensor" : "Replace Sensor"}
        accentColor={accentColor}
        sensors={sensors ?? []}
        excludeLabels={excludeForPicker}
        onSelect={(label) => {
          if (pickerMode === "add") {
            onAddSensor?.(label);
          } else if (pickerMode === "swap" && swappingOriginal) {
            onSwapSensor?.(swappingOriginal, label);
          }
          setPickerMode(null);
          setSwappingOriginal(null);
        }}
        onClose={() => {
          setPickerMode(null);
          setSwappingOriginal(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  bigLabelEditWrap: {
    alignItems: "center",
    marginTop: 4,
  },
  bigLabelActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  smallActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.backgroundSecondary,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  detailGrid: {
    flex: 1,
    gap: 6,
    justifyContent: "center",
  },
  barSection: {
    marginTop: 2,
  },
  overflowRows: {
    gap: 6,
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
    gap: 6,
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    paddingTop: 10,
  },
  editActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
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
