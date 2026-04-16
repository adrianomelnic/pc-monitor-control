import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommandButton } from "@/components/CommandButton";
import { SensorPickerModal } from "@/components/SensorPickerModal";
import { SensorCard, CompactSensorPicker, formatValue } from "@/components/cards/SensorCard";
import { CPUCard } from "@/components/cards/CPUCard";
import { DisksCard } from "@/components/cards/DisksCard";
import { FansCard } from "@/components/cards/FansCard";
import { GPUCard } from "@/components/cards/GPUCard";
import { NetworkCard } from "@/components/cards/NetworkCard";
import { RAMCard } from "@/components/cards/RAMCard";
import { ThermalsCard, SENSOR_ICON_OPTIONS, defaultSensorIcon, renderSensorIcon } from "@/components/cards/ThermalsCard";
import { Theme, accentEdgeStyle } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { BuiltinCardConfig, BuiltinCardKind, CardConfig, CustomCardConfig, useDashboard } from "@/context/DashboardContext";
import { BuiltinCardEdit, CardTitleEditConfig } from "@/components/cards/CardBase";
import { DraggableFieldList } from "@/components/DraggableFieldList";
import { usePcs, DEMO_PC_HOST, SensorReading } from "@/context/PcsContext";

const CARD_NAMES: Record<string, string> = {
  thermals: "Thermals & Fans",
  cpu: "CPU",
  gpu: "GPU",
  ram: "Memory",
  fans: "Fans",
  disks: "Storage",
  network: "Network",
};

const BUILTIN_CARD_FIELDS: Record<string, { key: string; label: string }[]> = {
  cpu: [
    { key: "usage", label: "Usage" },
    { key: "voltage", label: "CPU voltage" },
    { key: "wattage", label: "CPU power" },
    { key: "physicalCores", label: "Physical cores" },
    { key: "logicalCores", label: "Logical cores" },
    { key: "freqCurrent", label: "Current frequency" },
    { key: "freqMax", label: "Max frequency" },
    { key: "perCore", label: "Per-core grid" },
    { key: "perCoreVertical", label: "Per-core vertical" },
    { key: "cpuBar", label: "CPU load bar" },
  ],
  gpu: [
    { key: "usage", label: "GPU load" },
    { key: "voltage", label: "GPU voltage" },
    { key: "wattage", label: "GPU power" },
    { key: "vramRow", label: "VRAM used" },
    { key: "clockGpu", label: "GPU clock" },
    { key: "clockMem", label: "Mem clock" },
    { key: "vram", label: "VRAM bar" },
  ],
  ram: [
    { key: "usage", label: "In use %" },
    { key: "used", label: "Used" },
    { key: "available", label: "Available" },
    { key: "total", label: "Total" },
    { key: "bar", label: "RAM bar" },
    { key: "swap", label: "Swap / Page file" },
  ],
};

const DEFAULT_FIELD_ORDER: Record<string, string[]> = {
  gpu: ["usage", "voltage", "wattage", "vramRow", "clockGpu", "clockMem", "vram"],
  cpu: ["usage", "voltage", "wattage", "physicalCores", "logicalCores", "freqCurrent", "freqMax", "perCore", "perCoreVertical", "cpuBar"],
  ram: ["usage", "used", "available", "total", "bar", "swap"],
};

function isVirtualIface(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === "lo" ||
    n.includes("loopback") ||
    n.includes("pseudo") ||
    n.includes("virtual") ||
    n.includes("tailscale") ||
    n.includes("tunnel") ||
    n.includes("teredo") ||
    n.includes("isatap") ||
    n.includes("6to4") ||
    n.includes("docker") ||
    n.includes("vmware") ||
    n.includes("vethernet") ||
    n.startsWith("tun") ||
    n.startsWith("tap") ||
    n.startsWith("veth")
  );
}

function getEffectiveFieldOrder(
  stored: string[] | undefined,
  defaults: string[],
  extras: string[]
): string[] {
  const allKeys = [...defaults, ...extras];
  if (!stored) return allKeys;
  const validStored = stored.filter(k => allKeys.includes(k));
  const storedSet = new Set(validStored);
  const newKeys = allKeys.filter(k => !storedSet.has(k));
  const combined = [...validStored, ...newKeys];
  const seen = new Set<string>();
  return combined.filter(k => { if (seen.has(k)) return false; seen.add(k); return true; });
}

export default function PCDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pcs, removePc, refreshPc, sendCommand } = usePcs();
  const { getCards, toggleCard, moveCard, addCustomCard, removeCard, updateCustomCard, updateBuiltinCard } = useDashboard();
  const pc = pcs.find((p) => p.id === id);
  const isDemo = pc?.host === DEMO_PC_HOST;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const C = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const CARD_ACCENTS = theme.cardAccents;

  const [refreshing, setRefreshing] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const [cmdOutput, setCmdOutput] = useState("");
  const [cmdRunning, setCmdRunning] = useState(false);
  const [activePanel, setActivePanel] = useState<"controls" | "terminal" | null>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;

  const togglePanel = (panel: "controls" | "terminal") => {
    Haptics.selectionAsync();
    if (activePanel === panel) {
      Animated.timing(panelAnim, { toValue: 0, duration: 220, useNativeDriver: false }).start(() =>
        setActivePanel(null)
      );
    } else if (activePanel === null) {
      setActivePanel(panel);
      panelAnim.setValue(0);
      Animated.spring(panelAnim, { toValue: 1, useNativeDriver: false, friction: 22, tension: 200 }).start();
    } else {
      setActivePanel(panel);
    }
  };
  const [editMode, setEditMode] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<CustomCardConfig | null>(null);
  const [inlineEditBuiltin, setInlineEditBuiltin] = useState<BuiltinCardKind | null>(null);
  const [builtinTitleDraft, setBuiltinTitleDraft] = useState("");
  const [titleInputActive, setTitleInputActive] = useState<BuiltinCardKind | null>(null);
  const [extraSensorPickerFor, setExtraSensorPickerFor] = useState<BuiltinCardKind | null>(null);
  const [thermalsSensorPickerOpen, setThermalsSensorPickerOpen] = useState(false);
  const [replacingThermalKey, setReplacingThermalKey] = useState<string | null>(null);
  const [replacingExtraFor, setReplacingExtraFor] = useState<{ kind: BuiltinCardKind; key: string } | null>(null);
  const [replacingBuiltinField, setReplacingBuiltinField] = useState<{ kind: BuiltinCardKind; key: string } | null>(null);
  const [iconPickerKey, setIconPickerKey] = useState<string | null>(null);
  const [editingFieldLabel, setEditingFieldLabel] = useState<{ kind: BuiltinCardKind; key: string } | null>(null);
  const [fieldLabelDraft, setFieldLabelDraft] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  if (!pc) {
    return (
      <View style={[styles.root, { paddingTop: topPad }]}>
        <Text style={styles.notFound}>PC not found</Text>
      </View>
    );
  }

  // Stash non-nullable reference (TypeScript can't narrow through inner functions)
  const safePc = pc;
  const pcId = pc.id;

  const cards = getCards(pcId);
  const m = pc.metrics;
  const allSensors = m?.sensors ?? [];

  const commitBuiltinTitle = (kind: BuiltinCardKind, draft: string) => {
    const trimmed = draft.trim();
    const defaultTitle = CARD_NAMES[kind] ?? kind;
    updateBuiltinCard(pcId, kind, {
      customTitle: trimmed && trimmed !== defaultTitle ? trimmed : undefined,
    });
    setTitleInputActive(null);
  };

  const getDefaultFieldLabel = (kind: string, key: string): string => {
    const builtinDef = (BUILTIN_CARD_FIELDS[kind] ?? []).find(f => f.key === key);
    if (builtinDef) return builtinDef.label;
    if (kind === "thermals") {
      if (key.startsWith("t:")) return key.slice(2);
      if (key.startsWith("f:")) return key.slice(2);
      return key;
    }
    if (kind === "fans") {
      const fan = (m?.fans ?? []).find(f => f.label === key);
      if (fan) return fan.label;
    } else if (kind === "disks") {
      const disk = (m?.disks ?? []).find(d => (d.device || d.mountpoint) === key);
      if (disk) return disk.device.replace(/\\\\.\\/, "").replace(/\/$/, "") || disk.mountpoint;
    } else if (kind === "network") {
      const iface = (m?.network ?? []).find(i => i.name === key);
      if (iface) return iface.name;
    }
    return key;
  };

  const commitFieldAlias = (kind: BuiltinCardKind, key: string, draft: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    const trimmed = draft.trim();
    const defaultLabel = getDefaultFieldLabel(kind, key);
    const newAliases = { ...(card.fieldAliases ?? {}) };
    if (!trimmed || trimmed === defaultLabel) {
      delete newAliases[key];
    } else {
      newAliases[key] = trimmed;
    }
    updateBuiltinCard(pcId, kind, { fieldAliases: newAliases });
    setEditingFieldLabel(null);
  };

  const updateSensorIcon = (kind: BuiltinCardKind, key: string, icon: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    const newIcons = { ...(card.sensorIcons ?? {}), [key]: icon };
    updateBuiltinCard(pcId, kind, { sensorIcons: newIcons });
  };

  const getThermalsSmartDefault = (): string[] =>
    (m?.sensors ?? [])
      .filter(s => s.type === "temperature")
      .map(s => "t:" + s.label)
      .filter((k, i, arr) => arr.indexOf(k) === i);

  const showThermalSensor = (label: string, isTemp: boolean) => {
    const card = cards.find((c) => c.id === "thermals") as BuiltinCardConfig | undefined;
    if (!card) return;
    const key = (isTemp ? "t:" : "f:") + label;
    const base = card.hiddenFields ?? getThermalsSmartDefault();
    const newHidden = base.filter(k => k !== key);
    // Move key to the absolute end of fieldOrder so it appears last in the visible list
    const currentOrder = getEffectiveFieldOrder(card.fieldOrder, getDefaultKeys("thermals"), []);
    const newFieldOrder = [...currentOrder.filter(k => k !== key), key];
    updateBuiltinCard(pcId, "thermals", { hiddenFields: newHidden, fieldOrder: newFieldOrder });
  };

  const replaceThermalSensor = (oldKey: string, newLabel: string, isTemp: boolean) => {
    const card = cards.find((c) => c.id === "thermals") as BuiltinCardConfig | undefined;
    if (!card) return;
    const newKey = (isTemp ? "t:" : "f:") + newLabel;
    const base = card.hiddenFields ?? getThermalsSmartDefault();
    const updated = base.filter(k => k !== newKey);
    if (!updated.includes(oldKey)) updated.push(oldKey);
    updateBuiltinCard(pcId, "thermals", { hiddenFields: updated });
  };

  const updateSensorSource = (kind: BuiltinCardKind, fieldKey: string, sensorLabel: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    updateBuiltinCard(pcId, kind, { sensorSource: { ...(card.sensorSource ?? {}), [fieldKey]: sensorLabel } });
  };

  const replaceExtraSensor = (kind: BuiltinCardKind, oldLabel: string, newLabel: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    const extras = (card.extraSensors ?? []).map(l => l === oldLabel ? newLabel : l);
    updateBuiltinCard(pcId, kind, { extraSensors: extras });
  };

  const closeBuiltinEditMode = (kind: BuiltinCardKind) => {
    if (titleInputActive === kind) {
      commitBuiltinTitle(kind, builtinTitleDraft);
    }
    if (editingFieldLabel && editingFieldLabel.kind === kind) {
      commitFieldAlias(kind, editingFieldLabel.key, fieldLabelDraft);
    }
    setInlineEditBuiltin(null);
    setTitleInputActive(null);
    setEditingFieldLabel(null);
  };

  const toggleBuiltinField = (kind: BuiltinCardKind, fieldKey: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    let startingHidden: string[];
    if (card.hiddenFields !== undefined) {
      startingHidden = [...card.hiddenFields];
    } else if (kind === "thermals") {
      startingHidden = getThermalsSmartDefault();
    } else {
      startingHidden = [];
    }
    const idx = startingHidden.indexOf(fieldKey);
    if (idx >= 0) startingHidden.splice(idx, 1);
    else startingHidden.push(fieldKey);
    updateBuiltinCard(pcId, kind, { hiddenFields: startingHidden });
  };

  const getDefaultKeys = (kind: string): string[] => {
    if (DEFAULT_FIELD_ORDER[kind]) return DEFAULT_FIELD_ORDER[kind];
    if (kind === "thermals") {
      const seenT = new Set<string>();
      const seenF = new Set<string>();
      const tKeys: string[] = [];
      const fKeys: string[] = [];
      for (const s of (m?.sensors ?? []).filter(s => s.type === "temperature")) {
        const k = "t:" + s.label;
        if (!seenT.has(k)) { seenT.add(k); tKeys.push(k); }
      }
      for (const f of (m?.fans ?? [])) {
        const k = "f:" + f.label;
        if (!seenF.has(k)) { seenF.add(k); fKeys.push(k); }
      }
      return [...tKeys, ...fKeys];
    }
    if (kind === "fans") return (m?.fans ?? []).map(f => f.label);
    if (kind === "disks") return (m?.disks ?? []).map(d => d.device || d.mountpoint);
    if (kind === "network") return (m?.network ?? []).filter(i => i.isUp && !isVirtualIface(i.name)).map(i => i.name);
    return [];
  };

  const addExtraSensor = (kind: BuiltinCardKind, label: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    const extras = [...(card.extraSensors ?? [])];
    if (!extras.includes(label)) extras.push(label);
    const defaultKeys = getDefaultKeys(kind);
    const currentOrder = getEffectiveFieldOrder(card.fieldOrder, defaultKeys, card.extraSensors ?? []);
    // Always place new sensor at the absolute end
    const newOrder = [...currentOrder.filter(k => k !== label), label];
    updateBuiltinCard(pcId, kind, { extraSensors: extras, fieldOrder: newOrder });
  };

  const removeExtraSensor = (kind: BuiltinCardKind, label: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    const extras = (card.extraSensors ?? []).filter((l) => l !== label);
    const newOrder = card.fieldOrder?.filter(k => k !== label);
    updateBuiltinCard(pcId, kind, { extraSensors: extras, fieldOrder: newOrder });
  };

  const moveBuiltinField = (kind: BuiltinCardKind, key: string, direction: "up" | "down") => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    const defaultKeys = getDefaultKeys(kind);
    const extras = card.extraSensors ?? [];
    const order = getEffectiveFieldOrder(card.fieldOrder, defaultKeys, extras);
    const idx = order.indexOf(key);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= order.length) return;
    const newOrder = [...order];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    updateBuiltinCard(pcId, kind, { fieldOrder: newOrder });
  };

  function BuiltinDoneBtn({ accentColor, kind }: { accentColor: string; kind: BuiltinCardKind }) {
    return (
      <Pressable
        onPress={() => closeBuiltinEditMode(kind)}
        style={[styles.builtinDoneBtn, { backgroundColor: accentColor + "22", borderColor: accentColor + "55" }]}
        hitSlop={8}
      >
        <Feather name="check" size={11} color={accentColor} />
        <Text style={[styles.builtinDoneBtnText, { color: accentColor }]}>Done</Text>
      </Pressable>
    );
  }

  function BuiltinCardEditPanel({ card, accent }: { card: BuiltinCardConfig; accent: string }) {
    const hidden: Set<string> = (() => {
      if (card.hiddenFields !== undefined) return new Set(card.hiddenFields);
      if (card.kind === "thermals") {
        // Default: hide all temps; fans are visible by default
        const d = new Set<string>();
        for (const s of (m?.sensors ?? []).filter(s => s.type === "temperature")) {
          d.add("t:" + s.label);
        }
        return d;
      }
      return new Set<string>();
    })();
    const extrasSet = new Set(card.extraSensors ?? []);
    const builtinFields = BUILTIN_CARD_FIELDS[card.kind] ?? [];
    const fieldAliases = card.fieldAliases ?? {};
    const sensorIcons = card.sensorIcons ?? {};

    const dynamicItems: { key: string; label: string }[] =
      card.kind === "thermals"
        ? (() => {
            const seenT = new Set<string>();
            const seenF = new Set<string>();
            const result: { key: string; label: string }[] = [];
            for (const s of (m?.sensors ?? []).filter(s => s.type === "temperature")) {
              const k = "t:" + s.label;
              if (!seenT.has(k)) { seenT.add(k); result.push({ key: k, label: s.label + " (temp)" }); }
            }
            for (const f of (m?.fans ?? [])) {
              const k = "f:" + f.label;
              if (!seenF.has(k)) { seenF.add(k); result.push({ key: k, label: f.label + " (fan)" }); }
            }
            return result;
          })()
        : card.kind === "network"
        ? (m?.network ?? []).filter((i) => i.isUp).map((i) => ({ key: i.name, label: i.name }))
        : card.kind === "fans"
        ? (m?.fans ?? []).map((f) => ({ key: f.label, label: f.label }))
        : card.kind === "disks"
        ? (m?.disks ?? []).map((d) => ({
            key: d.device || d.mountpoint,
            label: d.device.replace(/\\\\.\\/, "").replace(/\/$/, "") || d.mountpoint,
          }))
        : [];

    const defaultKeys = getDefaultKeys(card.kind);
    const effectiveOrder = getEffectiveFieldOrder(
      card.fieldOrder,
      defaultKeys,
      card.extraSensors ?? []
    );

    const defaultLabelMap: Record<string, string> = {};
    builtinFields.forEach(f => { defaultLabelMap[f.key] = f.label; });
    dynamicItems.forEach(d => { defaultLabelMap[d.key] = d.label; });

    // For thermals: hide temperature sensors that the user hasn't added yet (hidden t: keys).
    // Fans always appear; temp sensors appear only once made visible.
    const panelOrder = card.kind === "thermals"
      ? effectiveOrder.filter(k => !hidden.has(k))
      : effectiveOrder;

    const onReorderFields = (newKeys: string[]) => {
      if (card.kind === "thermals") {
        const currentEffective = getEffectiveFieldOrder(card.fieldOrder, getDefaultKeys("thermals"), []);
        const hiddenItems = currentEffective.filter(k => hidden.has(k));
        updateBuiltinCard(pcId, "thermals", { fieldOrder: [...newKeys, ...hiddenItems] });
      } else {
        updateBuiltinCard(pcId, card.kind, { fieldOrder: newKeys });
      }
    };

    const renderDragRow = (key: string, drag: () => void, isActive: boolean) => {
      const isHidden = hidden.has(key);
      const isExtra = extrasSet.has(key);
      const defaultLabel = defaultLabelMap[key] ?? key;
      const displayLabel = fieldAliases[key] ?? defaultLabel;
      const isEditingThisLabel = editingFieldLabel?.kind === card.kind && editingFieldLabel?.key === key;
      const currentIcon = sensorIcons[key] ?? defaultSensorIcon(key);
      const isPickerOpen = iconPickerKey === key;

      return (
        <View key={key}>
          <View style={[styles.editPanelRow, isActive && { opacity: 0.85 }]}>
            <Pressable
              onLongPress={drag}
              delayLongPress={150}
              hitSlop={6}
              style={styles.editPanelDragHandle}
            >
              <Feather name="menu" size={15} color={isActive ? accent : C.textMuted + "99"} />
            </Pressable>
            <Pressable onPress={() => toggleBuiltinField(card.kind, key)} hitSlop={4}>
              <View style={[styles.editPanelToggle, {
                borderColor: isHidden ? C.textMuted : accent,
                backgroundColor: isHidden ? "transparent" : accent + "22",
              }]}>
                <Feather name={isHidden ? "eye-off" : "eye"} size={11} color={isHidden ? C.textMuted : accent} />
              </View>
            </Pressable>
            {card.kind === "thermals" && (
              <Pressable
                onPress={() => setIconPickerKey(isPickerOpen ? null : key)}
                hitSlop={4}
                style={[styles.editPanelIconBtn, isPickerOpen && { backgroundColor: accent + "22", borderColor: accent + "55" }]}
              >
                {renderSensorIcon(currentIcon, 13, isPickerOpen ? accent : C.textMuted)}
              </Pressable>
            )}
            {isEditingThisLabel ? (
              <TextInput
                style={[styles.editPanelRowText, styles.editPanelLabelInput, { borderBottomColor: accent }]}
                value={fieldLabelDraft}
                onChangeText={setFieldLabelDraft}
                onSubmitEditing={() => commitFieldAlias(card.kind, key, fieldLabelDraft)}
                onBlur={() => commitFieldAlias(card.kind, key, fieldLabelDraft)}
                autoFocus
                autoCorrect={false}
                returnKeyType="done"
                selectTextOnFocus
              />
            ) : (
              <Pressable
                style={styles.editPanelLabelPress}
                onPress={() => {
                  setEditingFieldLabel({ kind: card.kind, key });
                  setFieldLabelDraft(displayLabel);
                }}
                hitSlop={4}
              >
                <Text style={[styles.editPanelRowText, isHidden && { color: C.textMuted }]} numberOfLines={1}>
                  {displayLabel}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                if (card.kind === "thermals") {
                  setReplacingThermalKey(key);
                  setThermalsSensorPickerOpen(true);
                } else if (isExtra) {
                  setReplacingExtraFor({ kind: card.kind, key });
                  setExtraSensorPickerFor(card.kind);
                } else {
                  setReplacingBuiltinField({ kind: card.kind, key });
                  setExtraSensorPickerFor(card.kind);
                }
              }}
              hitSlop={8}
              style={styles.editPanelActionBtn}
            >
              <Feather name="refresh-cw" size={13} color={accent} style={{ opacity: 0.7 }} />
            </Pressable>
            <Pressable
              onPress={() => {
                if (card.kind === "thermals") {
                  toggleBuiltinField(card.kind, key);
                } else if (isExtra) {
                  removeExtraSensor(card.kind, key);
                } else {
                  toggleBuiltinField(card.kind, key);
                }
              }}
              hitSlop={8}
              style={styles.editPanelActionBtn}
            >
              <Feather name="x" size={14} color={C.danger} />
            </Pressable>
          </View>
          {card.kind === "thermals" && isPickerOpen && (
            <ScrollView
              style={[styles.iconPickerScroll, { borderColor: accent + "33" }]}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconPickerRow}>
                {SENSOR_ICON_OPTIONS.map(iconName => {
                  const isSelected = currentIcon === iconName;
                  return (
                    <Pressable
                      key={iconName}
                      onPress={() => { updateSensorIcon(card.kind, key, iconName); setIconPickerKey(null); }}
                      hitSlop={4}
                      style={[
                        styles.iconPickerBtn,
                        isSelected && { backgroundColor: accent + "22", borderColor: accent + "66" },
                      ]}
                    >
                      {renderSensorIcon(iconName, 26, isSelected ? accent : C.textMuted)}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      );
    };

    return (
      <View style={styles.editPanel}>
        <View style={styles.editPanelDivider} />
        <DraggableFieldList
          keys={panelOrder}
          onReorder={onReorderFields}
          onDragBegin={() => { setIconPickerKey(null); setEditingFieldLabel(null); }}
          renderRow={renderDragRow}
        />

        <Pressable
          onPress={() => card.kind === "thermals" ? setThermalsSensorPickerOpen(true) : setExtraSensorPickerFor(card.kind)}
          style={[styles.editPanelAddBtn, { borderColor: accent + "55", backgroundColor: accent + "11" }]}
        >
          <Feather name="plus" size={13} color={accent} />
          <Text style={[styles.editPanelAddBtnText, { color: accent }]}>Add sensor</Text>
        </Pressable>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPc(pc.id);
    setRefreshing(false);
  };

  const handleRemove = () => {
    Alert.alert("Remove PC", `Remove "${pc.name}" from your list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removePc(pc.id);
          router.back();
        },
      },
    ]);
  };

  const runCommand = async () => {
    if (!cmdInput.trim() || cmdRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCmdRunning(true);
    setCmdOutput("Running...");
    const result = await sendCommand(pc.id, "run", [cmdInput.trim()]);
    setCmdOutput(
      result.success
        ? result.output || "Done (no output)"
        : `Error: ${result.error || "Command failed"}`
    );
    setCmdRunning(false);
  };

  const statusColor =
    pc.status === "online"
      ? C.online
      : pc.status === "connecting"
      ? C.warning
      : C.offline;

  // ── Edit bar rendered above each card in edit mode ──────────────────────────
  function EditBar({ card, isFirst, isLast }: { card: CardConfig; isFirst: boolean; isLast: boolean }) {
    const isCustom = card.kind === "custom";
    const name = isCustom
      ? (card as CustomCardConfig).title
      : (card as BuiltinCardConfig).customTitle ?? (CARD_NAMES[card.kind] ?? card.kind);
    return (
      <View style={styles.editBar}>
        <Pressable
          style={styles.editBtn}
          onPress={() => {
            Haptics.selectionAsync();
            toggleCard(pcId, card.id);
          }}
          hitSlop={6}
        >
          <Feather
            name={card.visible ? "eye" : "eye-off"}
            size={15}
            color={C.textSecondary}
          />
        </Pressable>

        <Text style={styles.editCardName} numberOfLines={1}>{name}</Text>

        <Pressable
          style={[styles.editBtn, isFirst && styles.editBtnDisabled]}
          onPress={() => {
            if (!isFirst) {
              Haptics.selectionAsync();
              moveCard(pcId, card.id, "up");
            }
          }}
          hitSlop={6}
          disabled={isFirst}
        >
          <Feather name="chevron-up" size={16} color={C.textSecondary} />
        </Pressable>

        <Pressable
          style={[styles.editBtn, isLast && styles.editBtnDisabled]}
          onPress={() => {
            if (!isLast) {
              Haptics.selectionAsync();
              moveCard(pcId, card.id, "down");
            }
          }}
          hitSlop={6}
          disabled={isLast}
        >
          <Feather name="chevron-down" size={16} color={C.textSecondary} />
        </Pressable>

        {isCustom && (
          <>
            <Pressable
              style={styles.editBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setEditingCard(card as CustomCardConfig);
                setPickerVisible(true);
              }}
              hitSlop={6}
            >
              <Feather name="edit-2" size={14} color={C.textSecondary} />
            </Pressable>

            <Pressable
              style={[styles.editBtn, { backgroundColor: C.danger }]}
              onPress={() => {
                Alert.alert("Remove Card", `Remove "${name}"?`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      removeCard(pcId, card.id);
                    },
                  },
                ]);
              }}
              hitSlop={6}
            >
              <Feather name="x" size={16} color="#fff" />
            </Pressable>
          </>
        )}
      </View>
    );
  }

  // ── Render a single card by kind ─────────────────────────────────────────────
  function renderCardContent(card: CardConfig) {
    if (!m) return null;
    if (card.kind === "custom") {
      const c = card as CustomCardConfig;
      return (
        <SensorCard
          title={c.title}
          icon={c.icon ?? "layers"}
          sensorLabels={c.sensorLabels}
          accentColor={c.accentColor}
          sensors={allSensors}
          sensorAliases={c.sensorAliases}
          layout={c.layout}
          hiddenSensors={c.hiddenSensors}
          sensorIcons={c.sensorIcons}
          onEdit={() => {
            Haptics.selectionAsync();
            setEditingCard(c);
            setPickerVisible(true);
          }}
          onUpdateTitle={(newTitle) => {
            updateCustomCard(pcId, c.id, { title: newTitle });
          }}
          onReorder={(newLabels) => {
            updateCustomCard(pcId, c.id, { sensorLabels: newLabels });
          }}
          onUpdateAlias={(originalLabel, newAlias) => {
            const current = { ...(c.sensorAliases ?? {}) };
            if (newAlias && newAlias !== originalLabel) {
              current[originalLabel] = newAlias;
            } else {
              delete current[originalLabel];
            }
            updateCustomCard(pcId, c.id, { sensorAliases: current });
          }}
          onSwapSensor={(oldLabel, newLabel) => {
            const newLabels = c.sensorLabels.map((l) => (l === oldLabel ? newLabel : l));
            const newAliases = { ...(c.sensorAliases ?? {}) };
            delete newAliases[oldLabel];
            updateCustomCard(pcId, c.id, { sensorLabels: newLabels, sensorAliases: newAliases });
          }}
          onAddSensor={(newLabel) => {
            updateCustomCard(pcId, c.id, { sensorLabels: [...c.sensorLabels, newLabel] });
          }}
          onRemoveSensor={(label) => {
            const newLabels = c.sensorLabels.filter((l) => l !== label);
            const newAliases = { ...(c.sensorAliases ?? {}) };
            delete newAliases[label];
            updateCustomCard(pcId, c.id, { sensorLabels: newLabels, sensorAliases: newAliases });
          }}
          onToggleHidden={(label) => {
            const hidden = c.hiddenSensors ?? [];
            const next = hidden.includes(label)
              ? hidden.filter((h) => h !== label)
              : [...hidden, label];
            updateCustomCard(pcId, c.id, { hiddenSensors: next });
          }}
          onUpdateSensorIcon={(label, iconName) => {
            updateCustomCard(pcId, c.id, {
              sensorIcons: { ...(c.sensorIcons ?? {}), [label]: iconName },
            });
          }}
        />
      );
    }

    // ── Built-in cards: long-press to inline-edit title ───────────────────────
    const builtinCard = card as BuiltinCardConfig;
    const accent = CARD_ACCENTS[card.kind as keyof typeof CARD_ACCENTS] ?? C.tint;
    const isEditing = inlineEditBuiltin === card.kind;
    const isTitleActive = titleInputActive === card.kind;

    const titleEdit: CardTitleEditConfig = {
      customTitle: builtinCard.customTitle,
      editable: isTitleActive,
      draft: isTitleActive ? builtinTitleDraft : undefined,
      onChange: isTitleActive ? setBuiltinTitleDraft : undefined,
      onSubmit: isTitleActive ? () => commitBuiltinTitle(card.kind as BuiltinCardKind, builtinTitleDraft) : undefined,
      onTitlePress: isEditing && !isTitleActive ? () => {
        setBuiltinTitleDraft(builtinCard.customTitle ?? (CARD_NAMES[card.kind] ?? card.kind));
        setTitleInputActive(card.kind as BuiltinCardKind);
      } : undefined,
      rightAction: isEditing ? <BuiltinDoneBtn accentColor={accent} kind={card.kind as BuiltinCardKind} /> : undefined,
      borderStyle: isEditing ? { borderColor: accent + "66", borderWidth: 1.5 } : undefined,
    };

    const allExtras = builtinCard.extraSensors ?? [];
    const tempLabelSet = new Set<string>();
    const sensorLookup = new Map(allSensors.map(s => [s.label, s]));
    allExtras.forEach(label => {
      const sensor = sensorLookup.get(label);
      if (sensor && sensor.type === "temperature") tempLabelSet.add(label);
    });

    const defaultKeys = getDefaultKeys(card.kind);
    const fullOrder = getEffectiveFieldOrder(builtinCard.fieldOrder, defaultKeys, allExtras);

    const extraSensorMap: Record<string, string> = {};
    const extraTemps: { label: string; value: number }[] = [];
    fullOrder.forEach(key => {
      if (!allExtras.includes(key)) return;
      const sensor = sensorLookup.get(key);
      if (tempLabelSet.has(key)) {
        if (sensor) extraTemps.push({ label: key, value: sensor.value });
      } else {
        extraSensorMap[key] = sensor ? formatValue(sensor) : "—";
      }
    });
    // Inject sensorSource overrides for built-in fields
    Object.entries(builtinCard.sensorSource ?? {}).forEach(([fieldKey, sensorLabel]) => {
      if (allExtras.includes(fieldKey)) return; // extra sensor already handled
      const sensor = sensorLookup.get(sensorLabel);
      extraSensorMap[fieldKey] = sensor ? formatValue(sensor) : "—";
    });

    const nonTempExtras = allExtras.filter(l => !tempLabelSet.has(l));
    const effectiveOrder = getEffectiveFieldOrder(
      builtinCard.fieldOrder,
      defaultKeys,
      nonTempExtras
    );

    const cardEdit: BuiltinCardEdit = {
      hiddenFields: builtinCard.hiddenFields,
      fieldOrder: effectiveOrder,
      extraSensorMap,
      extraTemps: extraTemps.length > 0 ? extraTemps : undefined,
      fieldAliases: builtinCard.fieldAliases,
      editPanel: isEditing ? BuiltinCardEditPanel({ card: builtinCard, accent }) : undefined,
    };

    const handleLongPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTitleInputActive(null);
      setInlineEditBuiltin(card.kind as BuiltinCardKind);
    };

    let content: React.ReactNode = null;
    switch (card.kind) {
      case "thermals": {
        const allTemps = (m.sensors ?? []).filter(s => s.type === "temperature");
        const allFans2 = m.fans ?? [];
        const thermalsEdit: BuiltinCardEdit = {
          hiddenFields: builtinCard.hiddenFields,
          fieldOrder: getEffectiveFieldOrder(builtinCard.fieldOrder, getDefaultKeys("thermals"), []),
          fieldAliases: builtinCard.fieldAliases,
          sensorIcons: builtinCard.sensorIcons,
          editPanel: isEditing ? BuiltinCardEditPanel({ card: builtinCard, accent }) : undefined,
        };
        content = (
          <ThermalsCard
            temps={allTemps}
            fans={allFans2}
            titleEdit={titleEdit}
            cardEdit={thermalsEdit}
          />
        );
        break;
      }
      case "cpu": {
        if (!m.cpu) { content = null; break; }
        const cpuSrc = builtinCard.sensorSource ?? {};
        const cpuVoltageSensor = cpuSrc.voltage
          ? allSensors.find(s => s.label === cpuSrc.voltage)
          : allSensors.find(s => s.type === "voltage" && /cpu.*core|vcore|cpu.*volt/i.test(s.label));
        const cpuPowerSensor = cpuSrc.wattage
          ? allSensors.find(s => s.label === cpuSrc.wattage)
          : allSensors.find(s => s.type === "power" && /cpu.*package|package.*power|cpu.*power|cpu.*tdp/i.test(s.label));
        const augCpu = {
          ...m.cpu,
          voltage: cpuVoltageSensor?.value ?? null,
          power: cpuPowerSensor?.value ?? null,
        };
        content = <CPUCard cpu={augCpu} titleEdit={titleEdit} cardEdit={cardEdit} />;
        break;
      }
      case "gpu": {
        if (!m.gpu) { content = null; break; }
        const gpuSrc = builtinCard.sensorSource ?? {};
        const gpuVoltageSensors = gpuSrc.voltage
          ? allSensors.filter(s => s.label === gpuSrc.voltage)
          : allSensors.filter(s => s.type === "voltage" && /gpu.*core.*volt|gpu.*volt|gpu.*vdd/i.test(s.label));
        const gpuPowerSensors = gpuSrc.wattage
          ? allSensors.filter(s => s.label === gpuSrc.wattage)
          : allSensors.filter(s => s.type === "power" && /gpu.*power|gpu.*wattage|gpu.*tdp/i.test(s.label));
        const augGpus = m.gpu.map((g, i) => ({
          ...g,
          voltage: gpuVoltageSensors[i]?.value ?? null,
          power: gpuPowerSensors[i]?.value ?? null,
        }));
        content = <GPUCard gpus={augGpus} titleEdit={titleEdit} cardEdit={cardEdit} />;
        break;
      }
      case "ram":
        content = m.ram ? <RAMCard ram={m.ram} titleEdit={titleEdit} cardEdit={cardEdit} /> : null;
        break;
      case "fans":
        content = m.fans != null ? (
          <FansCard
            fans={m.fans}
            baseUrl={`http://${safePc.host}:${safePc.port}`}
            apiKey={safePc.apiKey}
            titleEdit={titleEdit}
            cardEdit={cardEdit}
          />
        ) : null;
        break;
      case "disks":
        content = m.disks && m.disks.length > 0 ? <DisksCard disks={m.disks} titleEdit={titleEdit} cardEdit={cardEdit} /> : null;
        break;
      case "network":
        content = m.network && m.network.length > 0 ? <NetworkCard interfaces={m.network} titleEdit={titleEdit} cardEdit={cardEdit} /> : null;
        break;
      default:
        return null;
    }
    if (!content) return null;

    return (
      <Pressable onLongPress={handleLongPress} delayLongPress={500}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.pageContainer}>
    <ScrollView
      style={[styles.root, { paddingTop: topPad }]}
      contentContainerStyle={[styles.content, { paddingBottom: 32 + bottomPad }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={C.tint}
          colors={[C.tint]}
        />
      }
    >
      {/* ── Header: two rows ── */}
      <View style={styles.header}>
        {/* Row 1: back arrow + PC name + status */}
        <View style={styles.headerRow1}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </Pressable>
          <Text style={styles.pcName} numberOfLines={1}>{pc.name}</Text>
          <View style={styles.headerStatus}>
            <View style={[styles.statusDot, { backgroundColor: isDemo ? "#F97316" : statusColor }]} />
            <Text style={[styles.statusText, { color: isDemo ? "#F97316" : statusColor }]}>
              {isDemo
                ? "Demo"
                : pc.status === "online"
                ? "Online"
                : pc.status === "connecting"
                ? "Connecting..."
                : "Offline"}
            </Text>
          </View>
        </View>
        {/* Row 2: action buttons (right-aligned) */}
        {pc.status === "online" ? (
          <View style={styles.headerRow2}>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setEditMode((e) => !e); }}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  editMode && styles.headerIconBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={6}
              >
                <Feather name="sliders" size={16} color={editMode ? C.tint : C.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => togglePanel("terminal")}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  activePanel === "terminal" && styles.headerIconBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={6}
              >
                <Feather name="terminal" size={16} color={activePanel === "terminal" ? C.tint : C.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => togglePanel("controls")}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  activePanel === "controls" && styles.headerIconBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={6}
              >
                <Feather name="power" size={16} color={activePanel === "controls" ? C.tint : C.textSecondary} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* ── Inline expandable header panel ── */}
      <Animated.View
        style={[
          styles.inlinePanel,
          {
            maxHeight: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }),
            opacity: panelAnim,
          },
        ]}
      >
        {activePanel === "controls" && (
          <View style={styles.controlGrid}>
            <CommandButton
              icon="moon"
              label="Sleep"
              color={C.tint}
              onPress={async () => {
                const r = await sendCommand(pc.id, "sleep");
                if (!r.success) throw new Error(r.error);
              }}
            />
            <CommandButton
              icon="lock"
              label="Lock"
              color="#A78BFA"
              onPress={async () => {
                const r = await sendCommand(pc.id, "lock");
                if (!r.success) throw new Error(r.error);
              }}
            />
            <CommandButton
              icon="refresh-cw"
              label="Restart"
              color={C.warning}
              destructive
              onPress={async () => {
                await new Promise<void>((resolve, reject) => {
                  Alert.alert(
                    "Restart PC",
                    `Restart "${pc.name}"? All unsaved work will be lost.`,
                    [
                      { text: "Cancel", style: "cancel", onPress: () => reject() },
                      {
                        text: "Restart",
                        style: "destructive",
                        onPress: async () => {
                          const r = await sendCommand(pc.id, "restart");
                          if (!r.success) reject(new Error(r.error));
                          else resolve();
                        },
                      },
                    ]
                  );
                });
              }}
            />
            <CommandButton
              icon="power"
              label="Shutdown"
              color={C.danger}
              destructive
              onPress={async () => {
                await new Promise<void>((resolve, reject) => {
                  Alert.alert(
                    "Shutdown PC",
                    `Shut down "${pc.name}"? All unsaved work will be lost.`,
                    [
                      { text: "Cancel", style: "cancel", onPress: () => reject() },
                      {
                        text: "Shutdown",
                        style: "destructive",
                        onPress: async () => {
                          const r = await sendCommand(pc.id, "shutdown");
                          if (!r.success) reject(new Error(r.error));
                          else resolve();
                        },
                      },
                    ]
                  );
                });
              }}
            />
          </View>
        )}
        {activePanel === "terminal" && (
          <View style={styles.terminalPanel}>
            <View style={styles.terminalInput}>
              <Feather name="terminal" size={14} color={C.textMuted} style={{ marginTop: 1 }} />
              <TextInput
                style={styles.cmdInput}
                value={cmdInput}
                onChangeText={setCmdInput}
                placeholder="e.g. tasklist, ls -la, ipconfig"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={runCommand}
                editable={!cmdRunning}
              />
              <Pressable
                onPress={runCommand}
                disabled={!cmdInput.trim() || cmdRunning}
                hitSlop={8}
              >
                <Feather
                  name="send"
                  size={18}
                  color={!cmdInput.trim() ? C.textMuted : C.tint}
                />
              </Pressable>
            </View>
            {cmdOutput ? (
              <ScrollView
                style={styles.outputBox}
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
              >
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  <Text style={styles.outputText}>{cmdOutput}</Text>
                </ScrollView>
              </ScrollView>
            ) : null}
          </View>
        )}
      </Animated.View>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <View style={styles.editBanner}>
          <Feather name="info" size={13} color={C.tint} />
          <Text style={styles.editBannerText}>
            Tap the eye to show/hide cards. Use arrows to reorder. Tap + to add a sensor card.
          </Text>
        </View>
      )}

      {/* ── COMPONENT CARDS ── */}
      {m && (
        <>
          {isWide && !editMode ? (
            /* Wide mode: two independent vertical columns — no row-height coupling */
            <View style={styles.cardGrid}>
              {[0, 1].map((col) => {
                const colCards = cards
                  .filter((card) => card.visible && renderCardContent(card) !== null)
                  .filter((_, i) => i % 2 === col);
                return (
                  <View key={col} style={styles.cardGridCol}>
                    {colCards.map((card) => (
                      <View key={card.id}>{renderCardContent(card)}</View>
                    ))}
                  </View>
                );
              })}
            </View>
          ) : (
            /* Portrait / edit mode: single column */
            cards.map((card, idx) => {
              const content = renderCardContent(card);
              if (!editMode && (!card.visible || !content)) return null;
              const isFirst = idx === 0;
              const isLast = idx === cards.length - 1;
              return (
                <View key={card.id}>
                  {editMode && (
                    <EditBar card={card} isFirst={isFirst} isLast={isLast} />
                  )}
                  {card.visible ? (
                    content
                  ) : editMode ? (
                    <View style={styles.hiddenPlaceholder}>
                      <Feather name="eye-off" size={13} color={C.textMuted} />
                      <Text style={styles.hiddenPlaceholderText}>
                        {card.kind === "custom"
                          ? (card as CustomCardConfig).title
                          : CARD_NAMES[card.kind] ?? card.kind}{" "}
                        card is hidden
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {/* Add Sensor Card button (edit mode only) */}
          {editMode && (
            <Pressable
              style={styles.addCardBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingCard(null);
                setPickerVisible(true);
              }}
            >
              <Feather name="plus-circle" size={18} color={C.tint} />
              <Text style={styles.addCardBtnText}>Add Sensor Card</Text>
            </Pressable>
          )}
        </>
      )}

      {/* ── Extra Sensor Picker for built-in cards ── */}
      <CompactSensorPicker
        visible={extraSensorPickerFor != null}
        title={replacingBuiltinField ? "Replace Field Sensor" : replacingExtraFor ? "Replace Sensor" : "Add HWiNFO64 Sensor"}
        accentColor={extraSensorPickerFor ? (CARD_ACCENTS[extraSensorPickerFor as keyof typeof CARD_ACCENTS] ?? C.tint) : C.tint}
        sensors={allSensors}
        excludeLabels={
          extraSensorPickerFor
            ? ((cards.find((c) => c.id === extraSensorPickerFor) as BuiltinCardConfig | undefined)?.extraSensors ?? [])
            : []
        }
        onSelect={(s) => {
          if (replacingBuiltinField) {
            updateSensorSource(replacingBuiltinField.kind, replacingBuiltinField.key, s.label);
            setReplacingBuiltinField(null);
          } else if (replacingExtraFor) {
            replaceExtraSensor(replacingExtraFor.kind, replacingExtraFor.key, s.label);
            setReplacingExtraFor(null);
          } else if (extraSensorPickerFor) {
            addExtraSensor(extraSensorPickerFor, s.label);
          }
        }}
        onClose={() => { setExtraSensorPickerFor(null); setReplacingExtraFor(null); setReplacingBuiltinField(null); }}
      />

      {/* ── Thermals Sensor Picker ── */}
      {(() => {
        const thermalsCard = cards.find((c) => c.id === "thermals") as BuiltinCardConfig | undefined;
        const thermalsSensors: SensorReading[] = [
          ...(m?.sensors ?? []).filter(s => s.type === "temperature"),
          ...(m?.fans ?? []).map(f => ({ label: f.label, value: f.rpm, type: "fan" as const, unit: "RPM", component: "Fans" })),
        ];
        const thermalsExcludeLabels: string[] = (() => {
          const hf = thermalsCard?.hiddenFields;
          if (hf === undefined) return [];
          return thermalsSensors
            .filter(s => {
              const key = (s.type === "temperature" ? "t:" : "f:") + s.label;
              return !hf.includes(key);
            })
            .map(s => s.label);
        })();
        return (
          <CompactSensorPicker
            visible={thermalsSensorPickerOpen}
            title={replacingThermalKey ? "Replace Sensor" : "Add Sensor"}
            accentColor="#F97316"
            sensors={thermalsSensors}
            excludeLabels={thermalsExcludeLabels}
            onSelect={(s) => {
              // s.type is exactly what the user selected — no label-collision guessing needed.
              const isTemp = s.type === "temperature";
              if (replacingThermalKey) {
                replaceThermalSensor(replacingThermalKey, s.label, isTemp);
                setReplacingThermalKey(null);
              } else {
                showThermalSensor(s.label, isTemp);
              }
              setThermalsSensorPickerOpen(false);
            }}
            onClose={() => { setThermalsSensorPickerOpen(false); setReplacingThermalKey(null); }}
          />
        );
      })()}

      {/* ── Sensor Picker Modal ── */}
      <SensorPickerModal
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setEditingCard(null);
        }}
        onSave={(title, sensorLabels, accentColor, icon, layout) => {
          if (editingCard) {
            updateCustomCard(pcId, editingCard.id, { title, sensorLabels, accentColor, icon, layout });
          } else {
            addCustomCard(pcId, title, sensorLabels, accentColor, icon, layout);
          }
        }}
        sensors={allSensors}
        initialTitle={editingCard?.title ?? ""}
        initialSensors={editingCard?.sensorLabels ?? []}
        initialColor={editingCard?.accentColor}
        initialIcon={editingCard?.icon}
        initialLayout={editingCard?.layout}
        isEdit={!!editingCard}
      />
    </ScrollView>

    </View>
  );
}

const createStyles = (t: Theme) => {
  const C = t.colors;
  return StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: C.background,
  },
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  content: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  notFound: {
    color: C.text,
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  header: {
    flexDirection: "column",
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
  },
  headerRow1: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRow2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingLeft: 44,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pcName: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: C.card,
    borderRadius: t.cardRadius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...accentEdgeStyle(t, C.tint),
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoRowText: {
    fontSize: 13,
    color: C.textSecondary,
    flex: 1,
  },
  infoSeparator: {
    height: 1,
    backgroundColor: C.cardBorder,
    marginHorizontal: -2,
  },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  deleteRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.danger,
  },
  demoNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.warning + "14",
    borderRadius: t.cardRadius,
    borderWidth: 1,
    borderColor: C.warning + "40",
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
  },
  cardGrid: {
    flexDirection: "row",
    gap: 8,
  },
  cardGridCol: {
    flex: 1,
    gap: 8,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.tint + "12",
    borderRadius: t.cardRadius,
    borderWidth: 1,
    borderColor: C.tint + "30",
    padding: 12,
  },
  editBannerText: {
    flex: 1,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
  },
  editBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  editBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.buttonRadius,
    backgroundColor: C.backgroundTertiary,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  editBtnDisabled: {
    opacity: 0.35,
  },
  editCardName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: C.textSecondary,
    marginHorizontal: 4,
  },
  hiddenPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderRadius: t.cardRadius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderStyle: "dashed",
    opacity: 0.5,
  },
  hiddenPlaceholderText: {
    fontSize: 13,
    color: C.textMuted,
    fontStyle: "italic",
  },
  addCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: t.cardRadius,
    borderWidth: 1.5,
    borderColor: C.tint + "50",
    borderStyle: "dashed",
    backgroundColor: C.tint + "08",
  },
  addCardBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.tint,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: t.cardRadius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...accentEdgeStyle(t, C.tint),
    padding: 16,
    gap: 12,
  },
  controlGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 12,
  },
  offlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: t.buttonRadius,
    borderWidth: 1,
    marginTop: 4,
  },
  offlinePillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  offlineCard: {
    backgroundColor: C.card,
    borderRadius: t.cardRadius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...accentEdgeStyle(t, C.danger),
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  offlineDesc: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: C.tint,
    borderWidth: 0,
    borderRadius: t.buttonRadius,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  terminalInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.backgroundSecondary,
    borderRadius: t.innerRadius,
    padding: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cmdInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    padding: 0,
  },
  outputBox: {
    backgroundColor: C.background,
    borderRadius: t.innerRadius,
    padding: 12,
  },
  outputText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    color: C.success,
    lineHeight: 18,
  },
  builtinDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: t.buttonRadius,
    borderWidth: 1,
  },
  builtinDoneBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  editPanel: {
    gap: 4,
    paddingTop: 4,
  },
  editPanelDivider: {
    height: 1,
    backgroundColor: C.cardBorder,
    marginBottom: 6,
  },
  editPanelSection: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
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
    borderRadius: t.buttonRadius,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  editPanelRowText: {
    fontSize: 12,
    color: C.text,
    fontWeight: "500",
    flex: 1,
  },
  editPanelLabelPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editPanelLabelInput: {
    borderBottomWidth: 1.5,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  editPanelRemove: {
    paddingLeft: 8,
  },
  editPanelActionBtn: {
    paddingLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  editPanelAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: t.buttonRadius,
    borderStyle: "dashed",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  editPanelAddBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  editPanelIconBtn: {
    width: 26,
    height: 26,
    borderRadius: t.buttonRadius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconPickerScroll: {
    maxHeight: 364,
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
    width: 52,
    height: 52,
    borderRadius: t.buttonRadius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: t.buttonRadius,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.backgroundTertiary,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  inlinePanel: {
    overflow: "hidden",
  },
  terminalPanel: {
    paddingVertical: 14,
    gap: 12,
  },
  headerIconBtnActive: {
    backgroundColor: C.tint + "18",
    borderWidth: 1,
    borderColor: C.tint + "60",
  },
  });
};
