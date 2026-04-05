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
import { CustomCardLayout } from "@/context/DashboardContext";
import Colors from "@/constants/colors";
import { CardBase, MiniBar, StatRow } from "./CardBase";
import { DraggableFieldList } from "@/components/DraggableFieldList";
import { SENSOR_ICON_OPTIONS, renderSensorIcon } from "./ThermalsCard";

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

function sensorTypeIcon(type: string): keyof typeof Feather.glyphMap {
  switch (type) {
    case "temperature": return "thermometer";
    case "fan":         return "wind";
    case "clock":       return "zap";
    case "voltage":     return "battery";
    case "power":       return "zap";
    case "current":     return "activity";
    case "usage":       return "percent";
    default:            return "sliders";
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
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
  onSelect: (sensor: SensorReading) => void;
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
                        onSelect(s);
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



// ─── Main SensorCard component ────────────────────────────────────────────────

interface Props {
  title: string;
  icon: string;
  sensorLabels: string[];
  accentColor: string;
  sensors?: SensorReading[];
  sensorAliases?: Record<string, string>;
  layout?: CustomCardLayout;
  hiddenSensors?: string[];
  sensorIcons?: Record<string, string>;
  onEdit?: () => void;
  onUpdateTitle?: (newTitle: string) => void;
  onUpdateAlias?: (originalLabel: string, newAlias: string) => void;
  onReorder?: (newLabels: string[]) => void;
  onSwapSensor?: (oldLabel: string, newLabel: string) => void;
  onAddSensor?: (newLabel: string) => void;
  onRemoveSensor?: (label: string) => void;
  onToggleHidden?: (label: string) => void;
  onUpdateSensorIcon?: (label: string, icon: string) => void;
}

export function SensorCard({
  title,
  icon,
  sensorLabels,
  accentColor,
  sensors,
  sensorAliases,
  layout = "auto",
  hiddenSensors,
  sensorIcons,
  onEdit,
  onUpdateTitle,
  onUpdateAlias,
  onReorder,
  onSwapSensor,
  onAddSensor,
  onRemoveSensor,
  onToggleHidden,
  onUpdateSensorIcon,
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

  // Icon picker (per-sensor)
  const [iconPickerKey, setIconPickerKey] = useState<string | null>(null);

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

  const hiddenSet = new Set(hiddenSensors ?? []);
  const resolvedVisible = resolved.filter((r) => !hiddenSet.has(r.original));

  const missing = sensorLabels.filter((lbl) => !sensorMap.has(lbl));

  // ── Sensor icon helper ─────────────────────────────────────────────────────
  const getSensorIcon = (key: string, type?: string): string =>
    sensorIcons?.[key] ?? (type ? sensorTypeIcon(type) : "sliders");

  // ── Layout decision ────────────────────────────────────────────────────────
  const effectiveLayout = layout === "auto"
    ? (resolvedVisible.length >= 2 && resolvedVisible.length <= 8 ? "split" : "list")
    : layout;
  const useSplitLayout = effectiveLayout === "split";
  const featured = useSplitLayout ? pickFeatured(resolvedVisible.map((r) => r.sensor)) : null;
  const featuredItem = featured ? resolvedVisible.find((r) => r.sensor === featured) ?? null : null;
  const rest = featuredItem ? resolvedVisible.filter((r) => r !== featuredItem) : resolvedVisible;

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

  // ── View-mode sensor row ───────────────────────────────────────────────────
  const renderSensorRow = (r: { original: string; sensor: SensorReading }, i: number) => (
    <StatRow
      key={i}
      label={getDisplayLabel(r.original)}
      value={formatValue(r.sensor)}
      color={valueColor(r.sensor, accentColor)}
    />
  );

  // ── Edit-mode draggable row ────────────────────────────────────────────────
  const renderEditRow = (key: string, drag: () => void, isActive: boolean) => {
    const sensorReading = sensorMap.get(key);
    const isEditingThisLabel = editingOriginal === key;
    const notFound = !sensorReading;
    const isHidden = hiddenSet.has(key);
    const isPickerOpen = iconPickerKey === key;
    const currentIcon = getSensorIcon(key, sensorReading?.type);

    return (
      <View key={key}>
        <View style={[dragStyles.editPanelRow, isActive && { opacity: 0.85 }]}>
          {/* ≡ drag handle */}
          <Pressable
            onLongPress={drag}
            delayLongPress={150}
            hitSlop={6}
            style={dragStyles.editPanelDragHandle}
          >
            <Feather name="menu" size={15} color={isActive ? accentColor : C.textMuted + "99"} />
          </Pressable>

          {/* Eye toggle */}
          <Pressable onPress={() => onToggleHidden?.(key)} hitSlop={4}>
            <View style={[dragStyles.editPanelToggle, {
              borderColor: isHidden ? C.textMuted : accentColor,
              backgroundColor: isHidden ? "transparent" : accentColor + "22",
            }]}>
              <Feather name={isHidden ? "eye-off" : "eye"} size={11} color={isHidden ? C.textMuted : accentColor} />
            </View>
          </Pressable>

          {/* Icon picker button */}
          <Pressable
            onPress={() => { commitLabel(); setIconPickerKey(isPickerOpen ? null : key); }}
            hitSlop={4}
            style={[dragStyles.editPanelIconBtn, isPickerOpen && { backgroundColor: accentColor + "22", borderColor: accentColor + "55" }]}
          >
            {renderSensorIcon(currentIcon, 13, isPickerOpen ? accentColor : C.textMuted)}
          </Pressable>

          {/* Label */}
          {isEditingThisLabel ? (
            <TextInput
              style={[dragStyles.editPanelRowText, dragStyles.editPanelLabelInput, { borderBottomColor: accentColor }]}
              value={editText}
              onChangeText={setEditText}
              onSubmitEditing={commitLabel}
              onBlur={commitLabel}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              selectTextOnFocus
            />
          ) : (
            <Pressable
              style={dragStyles.editPanelLabelPress}
              onPress={() => { setIconPickerKey(null); startLabelEdit(key); }}
              hitSlop={4}
            >
              <Text
                style={[dragStyles.editPanelRowText, (isHidden || notFound) && { color: C.textMuted }]}
                numberOfLines={1}
              >
                {getDisplayLabel(key)}
              </Text>
            </Pressable>
          )}

          {/* Replace */}
          <Pressable
            onPress={() => { commitLabel(); setIconPickerKey(null); setSwappingOriginal(key); setPickerMode("swap"); }}
            hitSlop={8}
            style={dragStyles.editPanelActionBtn}
          >
            <Feather name="refresh-cw" size={13} color={accentColor} style={{ opacity: 0.7 }} />
          </Pressable>

          {/* Remove */}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRemoveSensor?.(key); }}
            hitSlop={8}
            style={dragStyles.editPanelActionBtn}
          >
            <Feather name="x" size={14} color={C.danger} />
          </Pressable>
        </View>

        {/* Icon picker (opens below row) */}
        {isPickerOpen && (
          <ScrollView
            style={[dragStyles.iconPickerScroll, { borderColor: accentColor + "33" }]}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={dragStyles.iconPickerRow}>
              {SENSOR_ICON_OPTIONS.map((iconName) => {
                const isSelected = currentIcon === iconName;
                return (
                  <Pressable
                    key={iconName}
                    onPress={() => { onUpdateSensorIcon?.(key, iconName); setIconPickerKey(null); }}
                    hitSlop={4}
                    style={[
                      dragStyles.iconPickerBtn,
                      isSelected && { backgroundColor: accentColor + "22", borderColor: accentColor + "66" },
                    ]}
                  >
                    {renderSensorIcon(iconName, 22, isSelected ? accentColor : C.textMuted)}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  const renderBigLabel = (original: string) => (
    <Text style={styles.bigLabelText} numberOfLines={2}>
      {getDisplayLabel(original)}
    </Text>
  );

  return (
    <>
      <Pressable onLongPress={handleLongPress} delayLongPress={500}>
        <CardBase
          icon={(icon as keyof typeof Feather.glyphMap) || "layers"}
          title={title}
          subtitle={inlineEdit ? "≡ drag · 👁 hide · icon · tap label · ⇄ swap · × remove" : `${sensorLabels.length} sensor${sensorLabels.length !== 1 ? "s" : ""}`}
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
          ) : inlineEdit ? (
            /* ── EDIT MODE: unified draggable list (all layouts) ── */
            <DraggableFieldList
              keys={sensorLabels}
              onReorder={(newOrder) => onReorder?.(newOrder)}
              onDragBegin={() => { setEditingOriginal(null); setIconPickerKey(null); }}
              renderRow={renderEditRow}
            />
          ) : resolvedVisible.length === 0 ? (
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
          ) : resolvedVisible.length === 1 ? (
            /* ── SINGLE SENSOR ── */
            <View style={styles.singleStat}>
              <Text style={[styles.singleNum, { color: bigColor }]}>
                {formatBigNum(resolvedVisible[0].sensor).num}
                <Text style={styles.singleUnit}>{formatBigNum(resolvedVisible[0].sensor).unit}</Text>
              </Text>
              {renderBigLabel(resolvedVisible[0].original)}
              {resolvedVisible[0].sensor.type === "usage" && (
                <View style={{ marginTop: 8, width: "100%" }}>
                  <MiniBar value={resolvedVisible[0].sensor.value} color={accentColor} height={5} />
                </View>
              )}
            </View>
          ) : effectiveLayout === "tiles" ? (
            /* ── TILES LAYOUT ── */
            <View style={styles.tilesGrid}>
              {chunkArray(resolvedVisible, 3).map((row, ri) => (
                <View key={ri} style={styles.tilesRow}>
                  {row.map((r) => {
                    const { num, unit } = formatBigNum(r.sensor);
                    const col = valueColor(r.sensor, accentColor);
                    return (
                      <View key={r.original} style={[styles.tile, { borderColor: accentColor + "30" }]}>
                        <View style={styles.tileIcon}>
                          {renderSensorIcon(getSensorIcon(r.original, r.sensor.type), 14, accentColor)}
                        </View>
                        <Text style={styles.tileLabel} numberOfLines={2}>
                          {getDisplayLabel(r.original).toUpperCase()}
                        </Text>
                        <Text style={[styles.tileValue, { color: col }]}>{num}</Text>
                        <Text style={[styles.tileUnit, { color: accentColor }]}>{unit}</Text>
                      </View>
                    );
                  })}
                  {row.length < 3 && [...Array(3 - row.length)].map((_, i) => (
                    <View key={`ph_${i}`} style={styles.tilePlaceholder} />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            /* ── PURE STAT ROWS ── */
            <View style={styles.pureRows}>
              {resolvedVisible.map((r, i) => renderSensorRow(r, i))}
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
        onSelect={(s) => {
          if (pickerMode === "add") {
            onAddSensor?.(s.label);
          } else if (pickerMode === "swap" && swappingOriginal) {
            onSwapSensor?.(swappingOriginal, s.label);
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
  tilesGrid: {
    gap: 8,
  },
  tilesRow: {
    flexDirection: "row",
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  tilePlaceholder: {
    flex: 1,
  },
  tileIcon: {
    marginBottom: 5,
    opacity: 0.6,
  },
  tileLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 0.8,
    marginBottom: 3,
    textAlign: "center",
  },
  tileValue: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 24,
  },
  tileUnit: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 1,
    opacity: 0.75,
  },
});

const dragStyles = StyleSheet.create({
  editPanelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  editPanelDragHandle: {
    paddingHorizontal: 3,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 2,
  },
  editPanelToggle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  editPanelIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  editPanelLabelPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editPanelRowText: {
    fontSize: 12,
    color: C.text,
    fontWeight: "500",
    flex: 1,
  },
  editPanelLabelInput: {
    borderBottomWidth: 1.5,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  editPanelActionBtn: {
    paddingLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  iconPickerScroll: {
    maxHeight: 268,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 2,
  },
  iconPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  iconPickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});
