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
import { MetricRing } from "@/components/MetricRing";
import { StatBar } from "@/components/StatBar";
import Colors from "@/constants/colors";
import { usePcs } from "@/context/PcsContext";

const C = Colors.light;

function formatBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

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

export default function PCDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pcs, removePc, refreshPc, sendCommand } = usePcs();
  const pc = pcs.find((p) => p.id === id);
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const [cmdOutput, setCmdOutput] = useState("");
  const [cmdRunning, setCmdRunning] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!pc) {
    return (
      <View style={[styles.root, { paddingTop: topPad }]}>
        <Text style={styles.notFound}>PC not found</Text>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPc(pc.id);
    setRefreshing(false);
  };

  const confirmAction = (title: string, message: string, action: () => void) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: title, style: "destructive", onPress: action },
    ]);
  };

  const handleRemove = () => {
    confirmAction("Remove PC", `Remove "${pc.name}" from your list?`, () => {
      removePc(pc.id);
      router.back();
    });
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

  const m = pc.metrics;
  const statusColor =
    pc.status === "online"
      ? C.online
      : pc.status === "connecting"
      ? C.warning
      : C.offline;

  return (
    <ScrollView
      style={[styles.root, { paddingTop: topPad }]}
      contentContainerStyle={{ paddingBottom: 80 + bottomPad }}
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
      {/* Header */}
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
            {pc.os ? (
              <Text style={styles.osText}> · {pc.os}</Text>
            ) : null}
          </View>
        </View>
        <Pressable onPress={handleRemove} hitSlop={8}>
          <Feather name="trash-2" size={18} color={C.danger} />
        </Pressable>
      </View>

      {/* Host info */}
      <View style={styles.hostRow}>
        <Feather name="wifi" size={12} color={C.textMuted} />
        <Text style={styles.hostText}>
          {pc.host}:{pc.port}
        </Text>
        {pc.lastSeen ? (
          <Text style={styles.lastSeen}>
            · Updated {new Date(pc.lastSeen).toLocaleTimeString()}
          </Text>
        ) : null}
      </View>

      {/* Rings */}
      {m && pc.status === "online" ? (
        <>
          <View style={styles.section}>
            <View style={styles.rings}>
              <MetricRing value={m.cpuUsage} label="CPU" size={90} />
              <MetricRing
                value={(m.ramUsage / m.ramTotal) * 100}
                label="RAM"
                sublabel={`${formatBytes(m.ramUsage)}`}
                color="#A78BFA"
                size={90}
              />
              <MetricRing
                value={(m.diskUsage / m.diskTotal) * 100}
                label="Disk"
                sublabel={`${formatBytes(m.diskUsage)}`}
                color="#34D399"
                size={90}
              />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>System Details</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Uptime</Text>
                <Text style={styles.statValue}>{formatUptime(m.uptime)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Processes</Text>
                <Text style={styles.statValue}>{m.processes ?? "—"}</Text>
              </View>
              {m.temperature != null && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Temp</Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          m.temperature > 85
                            ? C.danger
                            : m.temperature > 70
                            ? C.warning
                            : C.text,
                      },
                    ]}
                  >
                    {Math.round(m.temperature)}°C
                  </Text>
                </View>
              )}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Net Up</Text>
                <Text style={styles.statValue}>
                  {m.networkUp.toFixed(0)} KB/s
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Net Down</Text>
                <Text style={styles.statValue}>
                  {m.networkDown.toFixed(0)} KB/s
                </Text>
              </View>
            </View>

            <View style={{ gap: 12, marginTop: 12 }}>
              <StatBar
                label="RAM"
                value={m.ramUsage}
                max={m.ramTotal}
                unit=" MB"
                color="#A78BFA"
              />
              <StatBar
                label="Disk"
                value={m.diskUsage}
                max={m.diskTotal}
                unit=" MB"
                color="#34D399"
              />
            </View>
          </View>
        </>
      ) : pc.status !== "online" ? (
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
      ) : null}

      {/* Controls */}
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

      {/* Terminal */}
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
            <ScrollView
              style={{ maxHeight: 200 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.outputText}>{cmdOutput}</Text>
            </ScrollView>
          </ScrollView>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
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
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rings: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 20,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  statItem: {
    minWidth: 80,
  },
  statLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    marginTop: 2,
  },
  controlGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  offlineCard: {
    margin: 16,
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
    backgroundColor: C.card,
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
