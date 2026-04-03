import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import Colors from "@/constants/colors";
import { BuiltinCardConfig, BuiltinCardKind, CardConfig, CustomCardConfig, useDashboard } from "@/context/DashboardContext";
import { BuiltinCardEdit, CardTitleEditConfig } from "@/components/cards/CardBase";
import { usePcs } from "@/context/PcsContext";

const C = Colors.light;

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const CARD_NAMES: Record<string, string> = {
  cpu: "CPU",
  gpu: "GPU",
  ram: "Memory",
  fans: "Fans",
  disks: "Storage",
  network: "Network",
};

const CARD_ACCENTS: Record<string, string> = {
  cpu: "#00D4FF",
  gpu: "#34D399",
  ram: "#A78BFA",
  fans: "#FB923C",
  disks: "#2DD4BF",
  network: "#60A5FA",
};

const BUILTIN_CARD_FIELDS: Record<string, { key: string; label: string }[]> = {
  cpu: [
    { key: "usage", label: "Usage" },
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
  gpu: ["usage", "vramRow", "clockGpu", "clockMem", "vram"],
  cpu: ["usage", "physicalCores", "logicalCores", "freqCurrent", "freqMax", "perCore", "perCoreVertical", "cpuBar"],
  ram: ["usage", "used", "available", "total", "bar", "swap"],
};

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
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const [cmdOutput, setCmdOutput] = useState("");
  const [cmdRunning, setCmdRunning] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<CustomCardConfig | null>(null);
  const [inlineEditBuiltin, setInlineEditBuiltin] = useState<BuiltinCardKind | null>(null);
  const [builtinTitleDraft, setBuiltinTitleDraft] = useState("");
  const [titleInputActive, setTitleInputActive] = useState<BuiltinCardKind | null>(null);
  const [extraSensorPickerFor, setExtraSensorPickerFor] = useState<BuiltinCardKind | null>(null);
  const [editingFieldLabel, setEditingFieldLabel] = useState<{ kind: BuiltinCardKind; key: string } | null>(null);
  const [fieldLabelDraft, setFieldLabelDraft] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

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
    const hidden = [...(card.hiddenFields ?? [])];
    const idx = hidden.indexOf(fieldKey);
    if (idx >= 0) hidden.splice(idx, 1);
    else hidden.push(fieldKey);
    updateBuiltinCard(pcId, kind, { hiddenFields: hidden });
  };

  const getDefaultKeys = (kind: string): string[] => {
    if (DEFAULT_FIELD_ORDER[kind]) return DEFAULT_FIELD_ORDER[kind];
    if (kind === "fans") return (m?.fans ?? []).map(f => f.label);
    if (kind === "disks") return (m?.disks ?? []).map(d => d.device || d.mountpoint);
    if (kind === "network") return (m?.network ?? []).filter(i => i.isUp).map(i => i.name);
    return [];
  };

  const addExtraSensor = (kind: BuiltinCardKind, label: string) => {
    const card = cards.find((c) => c.id === kind) as BuiltinCardConfig | undefined;
    if (!card) return;
    const extras = [...(card.extraSensors ?? [])];
    if (!extras.includes(label)) extras.push(label);
    const defaultKeys = getDefaultKeys(kind);
    const currentOrder = getEffectiveFieldOrder(card.fieldOrder, defaultKeys, card.extraSensors ?? []);
    const newOrder = currentOrder.includes(label) ? currentOrder : [...currentOrder, label];
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
    const hidden = new Set(card.hiddenFields ?? []);
    const extrasSet = new Set(card.extraSensors ?? []);
    const builtinFields = BUILTIN_CARD_FIELDS[card.kind] ?? [];
    const fieldAliases = card.fieldAliases ?? {};

    const dynamicItems: { key: string; label: string }[] =
      card.kind === "network"
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

    return (
      <View style={styles.editPanel}>
        <View style={styles.editPanelDivider} />
        {effectiveOrder.map((key, idx) => {
          const isHidden = hidden.has(key);
          const isExtra = extrasSet.has(key);
          const defaultLabel = defaultLabelMap[key] ?? key;
          const displayLabel = fieldAliases[key] ?? defaultLabel;
          const isFirst = idx === 0;
          const isLast = idx === effectiveOrder.length - 1;
          const isEditingThisLabel = editingFieldLabel?.kind === card.kind && editingFieldLabel?.key === key;

          return (
            <View key={key} style={styles.editPanelRow}>
              <View style={styles.editPanelArrows}>
                <Pressable
                  onPress={() => !isFirst && moveBuiltinField(card.kind, key, "up")}
                  hitSlop={4}
                  disabled={isFirst}
                >
                  <Feather name="chevron-up" size={16} color={isFirst ? C.textMuted + "33" : accent} />
                </Pressable>
                <Pressable
                  onPress={() => !isLast && moveBuiltinField(card.kind, key, "down")}
                  hitSlop={4}
                  disabled={isLast}
                >
                  <Feather name="chevron-down" size={16} color={isLast ? C.textMuted + "33" : accent} />
                </Pressable>
              </View>
              <Pressable onPress={() => toggleBuiltinField(card.kind, key)} hitSlop={4}>
                <View style={[styles.editPanelToggle, {
                  borderColor: isHidden ? C.textMuted : accent,
                  backgroundColor: isHidden ? "transparent" : accent + "22",
                }]}>
                  <Feather name={isHidden ? "eye-off" : "eye"} size={11} color={isHidden ? C.textMuted : accent} />
                </View>
              </Pressable>
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
                  <Feather name="edit-2" size={9} color={accent} style={{ opacity: 0.5 }} />
                </Pressable>
              )}
              {isExtra && (
                <Pressable onPress={() => removeExtraSensor(card.kind, key)} hitSlop={8} style={styles.editPanelRemove}>
                  <Feather name="x" size={14} color={C.danger} />
                </Pressable>
              )}
            </View>
          );
        })}

        <Pressable
          onPress={() => setExtraSensorPickerFor(card.kind)}
          style={[styles.editPanelAddBtn, { borderColor: accent + "55", backgroundColor: accent + "11" }]}
        >
          <Feather name="plus" size={13} color={accent} />
          <Text style={[styles.editPanelAddBtnText, { color: accent }]}>Add HWiNFO64 sensor</Text>
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
            color={card.visible ? C.text : C.textMuted}
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
          <Feather name="chevron-up" size={16} color={isFirst ? C.textMuted : C.text} />
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
          <Feather name="chevron-down" size={16} color={isLast ? C.textMuted : C.text} />
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
              <Feather name="edit-2" size={14} color={C.tint} />
            </Pressable>

            <Pressable
              style={styles.editBtn}
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
              <Feather name="x" size={16} color={C.danger} />
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
          onEdit={() => {
            Haptics.selectionAsync();
            setEditingCard(c);
            setPickerVisible(true);
          }}
          onUpdateTitle={(newTitle) => {
            updateCustomCard(pcId, c.id, { title: newTitle });
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
        />
      );
    }

    // ── Built-in cards: long-press to inline-edit title ───────────────────────
    const builtinCard = card as BuiltinCardConfig;
    const accent = CARD_ACCENTS[card.kind] ?? C.tint;
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
      editPanel: isEditing ? <BuiltinCardEditPanel card={builtinCard} accent={accent} /> : undefined,
    };

    const handleLongPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTitleInputActive(null);
      setInlineEditBuiltin(card.kind as BuiltinCardKind);
    };

    let content: React.ReactNode = null;
    switch (card.kind) {
      case "cpu":
        content = m.cpu ? <CPUCard cpu={m.cpu} titleEdit={titleEdit} cardEdit={cardEdit} /> : null;
        break;
      case "gpu":
        content = m.gpu ? <GPUCard gpus={m.gpu} titleEdit={titleEdit} cardEdit={cardEdit} /> : null;
        break;
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
    <ScrollView
      style={[styles.root, { paddingTop: topPad }]}
      contentContainerStyle={[styles.content, { paddingBottom: 80 + bottomPad }]}
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
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.pcName}>{pc.name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {pc.status === "online"
                ? "Online"
                : pc.status === "connecting"
                ? "Connecting..."
                : "Offline"}
            </Text>
            {pc.os ? <Text style={styles.osText}> · {pc.os}</Text> : null}
          </View>
        </View>
        {/* Edit toggle */}
        {pc.status === "online" && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setEditMode((e) => !e);
            }}
            style={[styles.editToggle, editMode && styles.editToggleActive]}
            hitSlop={8}
          >
            <Feather
              name={editMode ? "check" : "sliders"}
              size={16}
              color={editMode ? C.tint : C.textSecondary}
            />
            <Text style={[styles.editToggleText, editMode && { color: C.tint }]}>
              {editMode ? "Done" : "Edit"}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={handleRemove} hitSlop={8}>
          <Feather name="trash-2" size={18} color={C.danger} />
        </Pressable>
      </View>

      {/* Host + last updated */}
      <View style={styles.hostRow}>
        <Feather name="wifi" size={12} color={C.textMuted} />
        <Text style={styles.hostText}>{pc.host}:{pc.port}</Text>
        {pc.lastSeen ? (
          <Text style={styles.lastSeen}>
            · Updated {new Date(pc.lastSeen).toLocaleTimeString()}
          </Text>
        ) : null}
      </View>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <View style={styles.editBanner}>
          <Feather name="info" size={13} color={C.tint} />
          <Text style={styles.editBannerText}>
            Tap the eye to show/hide cards. Use arrows to reorder. Tap + to add a sensor card.
          </Text>
        </View>
      )}

      {/* ── OFFLINE STATE ── */}
      {pc.status !== "online" && (
        <View style={styles.offlineCard}>
          <Feather
            name={pc.status === "connecting" ? "loader" : "wifi-off"}
            size={32}
            color={statusColor}
          />
          <Text style={[styles.offlineTitle, { color: statusColor }]}>
            {pc.status === "connecting" ? "Connecting..." : "PC Offline"}
          </Text>
          <Text style={styles.offlineDesc}>
            {pc.status === "connecting"
              ? "Trying to reach the PC agent..."
              : "Make sure the PC agent is running on this computer."}
          </Text>
          <Pressable style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* ── SYSTEM SUMMARY BAR ── */}
      {m && pc.status === "online" && (
        <View style={styles.summaryBar}>
          {m.uptime != null && (
            <View style={styles.summaryItem}>
              <Feather name="clock" size={11} color={C.textMuted} />
              <Text style={styles.summaryLabel}>Uptime</Text>
              <Text style={styles.summaryValue}>{formatUptime(m.uptime)}</Text>
            </View>
          )}
          {m.processes != null && (
            <View style={styles.summaryItem}>
              <Feather name="layers" size={11} color={C.textMuted} />
              <Text style={styles.summaryLabel}>Processes</Text>
              <Text style={styles.summaryValue}>{m.processes}</Text>
            </View>
          )}
          {m.temperature != null && (
            <View style={styles.summaryItem}>
              <Feather name="thermometer" size={11} color={C.textMuted} />
              <Text style={styles.summaryLabel}>Temp</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      m.temperature > 85
                        ? C.danger
                        : m.temperature > 70
                        ? C.warning
                        : C.success,
                  },
                ]}
              >
                {Math.round(m.temperature)}°C
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── COMPONENT CARDS ── */}
      {m && pc.status === "online" && (
        <>
          {cards.map((card, idx) => {
            const content = renderCardContent(card);
            // In normal mode: skip hidden cards and empty cards
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
                ) : (
                  /* Hidden card placeholder — only shown in edit mode */
                  editMode ? (
                    <View style={styles.hiddenPlaceholder}>
                      <Feather name="eye-off" size={13} color={C.textMuted} />
                      <Text style={styles.hiddenPlaceholderText}>
                        {card.kind === "custom"
                          ? (card as CustomCardConfig).title
                          : CARD_NAMES[card.kind] ?? card.kind}{" "}
                        card is hidden
                      </Text>
                    </View>
                  ) : null
                )}
              </View>
            );
          })}

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

      {/* ── CONTROLS ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Controls</Text>
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
      </View>

      {/* ── TERMINAL ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Run Command</Text>
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
          >
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.outputText}>{cmdOutput}</Text>
            </ScrollView>
          </ScrollView>
        ) : null}
      </View>

      {/* ── Extra Sensor Picker for built-in cards ── */}
      <CompactSensorPicker
        visible={extraSensorPickerFor != null}
        title="Add HWiNFO64 Sensor"
        accentColor={extraSensorPickerFor ? (CARD_ACCENTS[extraSensorPickerFor] ?? C.tint) : C.tint}
        sensors={allSensors}
        excludeLabels={
          extraSensorPickerFor
            ? ((cards.find((c) => c.id === extraSensorPickerFor) as BuiltinCardConfig | undefined)?.extraSensors ?? [])
            : []
        }
        onSelect={(label) => {
          if (extraSensorPickerFor) addExtraSensor(extraSensorPickerFor, label);
        }}
        onClose={() => setExtraSensorPickerFor(null)}
      />

      {/* ── Sensor Picker Modal ── */}
      <SensorPickerModal
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setEditingCard(null);
        }}
        onSave={(title, sensorLabels, accentColor, icon) => {
          if (editingCard) {
            updateCustomCard(pcId, editingCard.id, { title, sensorLabels, accentColor, icon });
          } else {
            addCustomCard(pcId, title, sensorLabels, accentColor, icon);
          }
        }}
        sensors={allSensors}
        initialTitle={editingCard?.title ?? ""}
        initialSensors={editingCard?.sensorLabels ?? []}
        initialColor={editingCard?.accentColor}
        initialIcon={editingCard?.icon}
        isEdit={!!editingCard}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 2,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  pcName: {
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  osText: {
    fontSize: 12,
    color: C.textSecondary,
  },
  editToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.card,
  },
  editToggleActive: {
    borderColor: C.tint + "60",
    backgroundColor: C.tint + "15",
  },
  editToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSecondary,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -4,
  },
  hostText: {
    fontSize: 12,
    color: C.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  lastSeen: {
    fontSize: 12,
    color: C.textMuted,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.tint + "12",
    borderRadius: 12,
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
    borderRadius: 8,
    backgroundColor: C.backgroundSecondary,
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
    borderRadius: 12,
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
    borderRadius: 14,
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
  summaryBar: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 0,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  summaryLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  controlGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  offlineCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
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
    backgroundColor: C.backgroundSecondary,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
  },
  terminalInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 10,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
  editPanelArrows: {
    flexDirection: "column",
    alignItems: "center",
    gap: -2,
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
  editPanelAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: "dashed",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  editPanelAddBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
