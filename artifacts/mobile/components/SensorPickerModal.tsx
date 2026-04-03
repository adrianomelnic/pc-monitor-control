import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ACCENT_COLORS } from "@/context/DashboardContext";
import { SensorReading } from "@/context/PcsContext";
import Colors from "@/constants/colors";

const C = Colors.light;

// Short badge label for each reading type
const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  temperature: { label: "°C",  color: "#FB923C" },
  fan:         { label: "RPM", color: "#60A5FA" },
  voltage:     { label: "V",   color: "#FBBF24" },
  power:       { label: "W",   color: "#F472B6" },
  current:     { label: "A",   color: "#A78BFA" },
  clock:       { label: "MHz", color: "#34D399" },
  usage:       { label: "%",   color: "#00D4FF" },
  other:       { label: "—",   color: "#6B7280" },
};

function formatPreview(s: SensorReading): string {
  if (s.type === "temperature") return `${s.value.toFixed(1)} ${s.unit}`;
  if (s.type === "fan")         return `${Math.round(s.value)} ${s.unit}`;
  if (s.type === "clock")       return s.value >= 1000 ? `${(s.value / 1000).toFixed(2)} GHz` : `${Math.round(s.value)} ${s.unit}`;
  if (s.type === "voltage")     return `${s.value.toFixed(3)} ${s.unit}`;
  if (s.type === "power")       return `${s.value.toFixed(1)} ${s.unit}`;
  if (s.type === "current")     return `${s.value.toFixed(2)} ${s.unit}`;
  if (s.type === "usage")       return `${s.value.toFixed(1)} ${s.unit}`;
  return s.unit ? `${s.value} ${s.unit}` : String(s.value);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, sensorLabels: string[], accentColor: string) => void;
  sensors: SensorReading[];
  initialTitle?: string;
  initialSensors?: string[];
  initialColor?: string;
  isEdit?: boolean;
}

export function SensorPickerModal({
  visible,
  onClose,
  onSave,
  sensors,
  initialTitle = "",
  initialSensors = [],
  initialColor,
  isEdit = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initialTitle);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSensors));
  const [accentColor, setAccentColor] = useState(initialColor ?? ACCENT_COLORS[0]);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setSelected(new Set(initialSensors));
      setAccentColor(initialColor ?? ACCENT_COLORS[0]);
      setSearch("");
      setCollapsed(new Set());
    }
  }, [visible]);

  const toggleCollapse = (comp: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(comp)) next.delete(comp);
      else next.add(comp);
      return next;
    });
  };

  // Group by component (hardware device), preserving HWiNFO64 order
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const orderMap: Record<string, number> = {};
    const map: Record<string, SensorReading[]> = {};

    for (const s of sensors) {
      const comp = s.component || "Unknown";
      const matchLabel = s.label.toLowerCase().includes(q);
      const matchComp = comp.toLowerCase().includes(q);
      if (q && !matchLabel && !matchComp) continue;

      if (!(comp in orderMap)) {
        orderMap[comp] = Object.keys(orderMap).length;
        map[comp] = [];
      }
      map[comp].push(s);
    }

    // Sort by original appearance order (not alphabetically)
    return Object.keys(map)
      .sort((a, b) => orderMap[a] - orderMap[b])
      .map((comp) => ({ comp, items: map[comp] }));
  }, [sensors, search]);

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Select / deselect all sensors for a component group
  const toggleGroup = (items: SensorReading[]) => {
    const labels = items.map((s) => s.label);
    const allSelected = labels.every((l) => selected.has(l));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        labels.forEach((l) => next.delete(l));
      } else {
        labels.forEach((l) => next.add(l));
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave(title.trim() || "Custom Card", Array.from(selected), accentColor);
    onClose();
  };

  const canSave = selected.size > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>
        {/* ── Header ── */}
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </Pressable>
          <Text style={styles.sheetTitle}>{isEdit ? "Edit Card" : "New Sensor Card"}</Text>
          <Pressable onPress={handleSave} hitSlop={8} disabled={!canSave}>
            <Text style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}>
              Save{selected.size > 0 ? ` (${selected.size})` : ""}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* ── Card Title ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CARD TITLE</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. GPU Sensors, CPU Clocks..."
              placeholderTextColor={C.textMuted}
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>

          {/* ── Accent Color ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACCENT COLOR</Text>
            <View style={styles.colorRow}>
              {ACCENT_COLORS.map((col) => (
                <Pressable
                  key={col}
                  style={[styles.colorDot, { backgroundColor: col }, accentColor === col && styles.colorDotActive]}
                  onPress={() => setAccentColor(col)}
                />
              ))}
            </View>
          </View>

          {/* ── Search ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              SELECT SENSORS{selected.size > 0 ? ` · ${selected.size} selected` : ""}
            </Text>
            <View style={styles.searchBar}>
              <Feather name="search" size={14} color={C.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search sensors or components..."
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            {/* ── Sensor list grouped by hardware component ── */}
            {sensors.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="alert-circle" size={28} color={C.textMuted} />
                <Text style={styles.emptyTitle}>No HWiNFO64 Data</Text>
                <Text style={styles.emptyDesc}>
                  Make sure HWiNFO64 is running with shared memory enabled on this PC.
                </Text>
              </View>
            ) : grouped.length === 0 ? (
              <Text style={styles.emptyDesc}>No sensors match "{search}"</Text>
            ) : (
              grouped.map(({ comp, items }) => {
                const allSelected = items.every((s) => selected.has(s.label));
                const someSelected = !allSelected && items.some((s) => selected.has(s.label));
                const isCollapsed = collapsed.has(comp);
                return (
                  <View key={comp} style={styles.group}>
                    {/* Component header row: checkbox = select-all, rest = expand/collapse */}
                    <View style={styles.groupHeader}>
                      <Pressable
                        style={[
                          styles.groupCheck,
                          (allSelected || someSelected) && { backgroundColor: accentColor, borderColor: accentColor }
                        ]}
                        onPress={() => toggleGroup(items)}
                        hitSlop={6}
                      >
                        {allSelected && <Feather name="check" size={11} color="#fff" />}
                        {someSelected && <View style={styles.groupCheckDash} />}
                      </Pressable>

                      <Pressable style={styles.groupHeaderLabel} onPress={() => toggleCollapse(comp)}>
                        <Text style={styles.groupName} numberOfLines={2}>{comp}</Text>
                        <Text style={styles.groupCount}>
                          {someSelected || allSelected
                            ? `${items.filter((s) => selected.has(s.label)).length}/`
                            : ""}
                          {items.length}
                        </Text>
                        <Feather
                          name={isCollapsed ? "chevron-right" : "chevron-down"}
                          size={14}
                          color={C.textMuted}
                        />
                      </Pressable>
                    </View>

                    {/* Individual sensor rows — hidden when collapsed */}
                    {!isCollapsed && items.map((s, si) => {
                      const isSelected = selected.has(s.label);
                      const badge = TYPE_BADGE[s.type] ?? TYPE_BADGE.other;
                      return (
                        <TouchableOpacity
                          key={`${comp}_${si}_${s.label}`}
                          style={[styles.sensorRow, isSelected && { borderColor: accentColor + "60", backgroundColor: accentColor + "10" }]}
                          onPress={() => toggle(s.label)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkbox, isSelected && { backgroundColor: accentColor, borderColor: accentColor }]}>
                            {isSelected && <Feather name="check" size={11} color="#fff" />}
                          </View>

                          <View style={[styles.typeBadge, { backgroundColor: badge.color + "20" }]}>
                            <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
                          </View>

                          <Text style={styles.sensorLabel} numberOfLines={1}>{s.label}</Text>
                          <Text style={styles.sensorValue}>{formatPreview(s)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 40 + insets.bottom }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
  },
  cancelBtn: {
    fontSize: 16,
    color: C.textSecondary,
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: "700",
    color: C.tint,
  },
  scroll: { flex: 1 },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1,
  },
  titleInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    padding: 0,
  },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textSecondary,
  },
  emptyDesc: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  group: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
    backgroundColor: C.card,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  groupHeaderLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  groupCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  groupCheckDash: {
    width: 10,
    height: 2,
    backgroundColor: "#fff",
    borderRadius: 1,
  },
  groupName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: C.text,
    lineHeight: 16,
  },
  groupCount: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "600",
  },
  sensorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
    minWidth: 32,
    alignItems: "center",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sensorLabel: {
    flex: 1,
    fontSize: 12,
    color: C.text,
  },
  sensorValue: {
    fontSize: 12,
    color: C.textMuted,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
});
