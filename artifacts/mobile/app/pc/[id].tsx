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
import { SensorCard } from "@/components/cards/SensorCard";
import { CPUCard } from "@/components/cards/CPUCard";
import { DisksCard } from "@/components/cards/DisksCard";
import { FansCard } from "@/components/cards/FansCard";
import { GPUCard } from "@/components/cards/GPUCard";
import { NetworkCard } from "@/components/cards/NetworkCard";
import { RAMCard } from "@/components/cards/RAMCard";
import Colors from "@/constants/colors";
import { CardConfig, CustomCardConfig, useDashboard } from "@/context/DashboardContext";
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
  ram: "RAM",
  fans: "Fans",
  disks: "Disks",
  network: "Network",
};

export default function PCDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pcs, removePc, refreshPc, sendCommand } = usePcs();
  const { getCards, toggleCard, moveCard, addCustomCard, removeCard, updateCustomCard } = useDashboard();
  const pc = pcs.find((p) => p.id === id);
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const [cmdOutput, setCmdOutput] = useState("");
  const [cmdRunning, setCmdRunning] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<CustomCardConfig | null>(null);

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
    const name = isCustom ? (card as CustomCardConfig).title : CARD_NAMES[card.kind] ?? card.kind;
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
          onEdit={() => {
            Haptics.selectionAsync();
            setEditingCard(c);
            setPickerVisible(true);
          }}
        />
      );
    }
    switch (card.kind) {
      case "cpu":
        return m.cpu ? <CPUCard cpu={m.cpu} /> : null;
      case "gpu":
        return m.gpu ? <GPUCard gpus={m.gpu} /> : null;
      case "ram":
        return m.ram ? <RAMCard ram={m.ram} /> : null;
      case "fans":
        return m.fans != null ? (
          <FansCard
            fans={m.fans}
            baseUrl={`http://${safePc.host}:${safePc.port}`}
            apiKey={safePc.apiKey}
          />
        ) : null;
      case "disks":
        return m.disks && m.disks.length > 0 ? <DisksCard disks={m.disks} /> : null;
      case "network":
        return m.network && m.network.length > 0 ? <NetworkCard interfaces={m.network} /> : null;
      default:
        return null;
    }
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: topPad }]}
      contentContainerStyle={[styles.content, { paddingBottom: 80 + bottomPad }]}
      showsVerticalScrollIndicator={false}
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
});
