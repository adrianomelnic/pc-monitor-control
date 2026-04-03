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

const TYPE_LABELS: Record<string, string> = {
  temperature: "Temperature",
  fan: "Fan Speed",
  voltage: "Voltage",
  power: "Power",
  current: "Current",
  clock: "Clock / Frequency",
  usage: "Usage / Load",
  other: "Other",
};

const TYPE_ORDER = ["temperature", "fan", "usage", "clock", "power", "voltage", "current", "other"];

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

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setSelected(new Set(initialSensors));
      setAccentColor(initialColor ?? ACCENT_COLORS[0]);
      setSearch("");
    }
  }, [visible]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const map: Record<string, SensorReading[]> = {};
    for (const s of sensors) {
      if (q && !s.label.toLowerCase().includes(q)) continue;
      if (!map[s.type]) map[s.type] = [];
      map[s.type].push(s);
    }
    return TYPE_ORDER.filter((t) => map[t]?.length).map((t) => ({
      type: t,
      label: TYPE_LABELS[t] ?? t,
      items: map[t],
    }));
  }, [sensors, search]);

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleSave = () => {
    const t = title.trim() || "Custom Card";
    onSave(t, Array.from(selected), accentColor);
    onClose();
  };

  const canSave = selected.size > 0;

  function formatPreview(s: SensorReading) {
    if (s.type === "temperature") return `${s.value.toFixed(1)} ${s.unit}`;
    if (s.type === "fan") return `${Math.round(s.value)} ${s.unit}`;
    if (s.type === "clock") return s.value >= 1000 ? `${(s.value / 1000).toFixed(2)} GHz` : `${Math.round(s.value)} ${s.unit}`;
    if (s.unit) return `${s.value.toFixed(1)} ${s.unit}`;
    return String(s.value);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </Pressable>
          <Text style={styles.sheetTitle}>{isEdit ? "Edit Card" : "New Sensor Card"}</Text>
          <Pressable onPress={handleSave} hitSlop={8} disabled={!canSave}>
            <Text style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}>Save</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CARD TITLE</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. GPU Sensors, Temps..."
              placeholderTextColor={C.textMuted}
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>

          {/* Accent Color */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACCENT COLOR</Text>
            <View style={styles.colorRow}>
              {ACCENT_COLORS.map((col) => (
                <Pressable
                  key={col}
                  style={[
                    styles.colorDot,
                    { backgroundColor: col },
                    accentColor === col && styles.colorDotActive,
                  ]}
                  onPress={() => setAccentColor(col)}
                />
              ))}
            </View>
          </View>

          {/* Selection summary */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              SENSORS{selected.size > 0 ? ` · ${selected.size} selected` : ""}
            </Text>

            {/* Search */}
            <View style={styles.searchBar}>
              <Feather name="search" size={14} color={C.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search sensors..."
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            {sensors.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="alert-circle" size={24} color={C.textMuted} />
                <Text style={styles.emptyText}>
                  No HWiNFO64 sensor data available.{"\n"}Make sure HWiNFO64 is running on this PC.
                </Text>
              </View>
            ) : grouped.length === 0 ? (
              <Text style={styles.emptyText}>No sensors match "{search}"</Text>
            ) : (
              grouped.map((group) => (
                <View key={group.type} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  {group.items.map((s) => {
                    const isSelected = selected.has(s.label);
                    return (
                      <TouchableOpacity
                        key={s.label}
                        style={[styles.sensorRow, isSelected && styles.sensorRowSelected]}
                        onPress={() => toggle(s.label)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, isSelected && { backgroundColor: accentColor, borderColor: accentColor }]}>
                          {isSelected && <Feather name="check" size={11} color="#fff" />}
                        </View>
                        <Text style={styles.sensorLabel} numberOfLines={1}>{s.label}</Text>
                        <Text style={styles.sensorValue}>{formatPreview(s)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
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
  scroll: {
    flex: 1,
  },
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
    gap: 10,
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  group: {
    marginTop: 16,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sensorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 6,
  },
  sensorRowSelected: {
    borderColor: C.tint + "60",
    backgroundColor: C.tint + "10",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  sensorLabel: {
    flex: 1,
    fontSize: 13,
    color: C.text,
  },
  sensorValue: {
    fontSize: 12,
    color: C.textMuted,
    fontVariant: ["tabular-nums"],
  },
});
