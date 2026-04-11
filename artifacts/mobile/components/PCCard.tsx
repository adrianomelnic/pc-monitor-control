import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Colors from "@/constants/colors";
import { DEMO_PC_HOST, PC, usePcs } from "@/context/PcsContext";
import { MetricRing } from "./MetricRing";

interface PCCardProps {
  pc: PC;
}

function formatBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}G`;
  return `${Math.round(mb)}M`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function PCCard({ pc }: PCCardProps) {
  const C = Colors.light;
  const { removePc, updatePc } = usePcs();
  const isDemo = pc.host === DEMO_PC_HOST;

  const statusColor =
    pc.status === "online"
      ? C.online
      : pc.status === "connecting"
      ? C.warning
      : C.offline;

  const statusLabel =
    pc.status === "online"
      ? "Online"
      : pc.status === "connecting"
      ? "Connecting..."
      : "Offline";

  const [editVisible, setEditVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [hostDraft, setHostDraft] = useState("");
  const [portDraft, setPortDraft] = useState("");

  const openEdit = () => {
    setNameDraft(pc.name);
    setHostDraft(pc.host);
    setPortDraft(String(pc.port));
    setEditVisible(true);
  };

  const saveEdit = () => {
    const portNum = parseInt(portDraft, 10);
    if (!nameDraft.trim()) {
      Alert.alert("Name required", "Please enter a name for this PC.");
      return;
    }
    if (!hostDraft.trim()) {
      Alert.alert("IP required", "Please enter the PC's IP address.");
      return;
    }
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert("Invalid port", "Port must be a number between 1 and 65535.");
      return;
    }
    updatePc(pc.id, { name: nameDraft.trim(), host: hostDraft.trim(), port: portNum });
    setEditVisible(false);
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Remove PC",
      `Remove "${pc.name}" from your list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removePc(pc.id),
        },
      ]
    );
  };

  return (
    <>
      <Pressable
        onPress={() => router.push(`/pc/${pc.id}`)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{pc.name}</Text>
                {isDemo && (
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoBadgeText}>DEMO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.host}>{isDemo ? "Demo Mode — no PC required" : `${pc.host}:${pc.port}`}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {statusLabel}
            </Text>
            {pc.os ? (
              <Text style={styles.osText} numberOfLines={1}>{pc.os}</Text>
            ) : null}
          </View>
        </View>

        {pc.status === "online" && pc.metrics ? (
          <View style={styles.metrics}>
            <MetricRing
              value={pc.metrics.cpuUsage}
              label="CPU"
              color="#00D4FF"
              size={72}
            />
            <MetricRing
              value={(pc.metrics.ramUsage / pc.metrics.ramTotal) * 100}
              label="RAM"
              sublabel={`${formatBytes(pc.metrics.ramUsage)}/${formatBytes(pc.metrics.ramTotal)}`}
              color="#A78BFA"
              size={72}
            />
            <MetricRing
              value={(pc.metrics.diskUsage / pc.metrics.diskTotal) * 100}
              label="Disk"
              sublabel={`${formatBytes(pc.metrics.diskUsage)}/${formatBytes(pc.metrics.diskTotal)}`}
              color="#34D399"
              size={72}
            />
            <View style={styles.networkInfo}>
              <View style={styles.netRow}>
                <Feather name="arrow-up" size={12} color={C.tint} />
                <Text style={styles.netVal}>
                  {formatBytes(pc.metrics.networkUp)}/s
                </Text>
              </View>
              <View style={styles.netRow}>
                <Feather name="arrow-down" size={12} color="#A78BFA" />
                <Text style={styles.netVal}>
                  {formatBytes(pc.metrics.networkDown)}/s
                </Text>
              </View>
              {pc.metrics.uptime ? (
                <Text style={styles.uptimeText}>
                  Up {formatUptime(pc.metrics.uptime)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : pc.status === "offline" ? (
          <View style={styles.offlineRow}>
            <Feather name="wifi-off" size={14} color={C.textMuted} />
            <Text style={styles.offlineText}>
              {pc.lastSeen
                ? `Last seen ${new Date(pc.lastSeen).toLocaleTimeString()}`
                : "Never connected"}
            </Text>
          </View>
        ) : (
          <View style={styles.offlineRow}>
            <Feather name="loader" size={14} color={C.warning} />
            <Text style={[styles.offlineText, { color: C.warning }]}>
              Connecting to agent...
            </Text>
          </View>
        )}

        <View style={styles.cardSeparator} />

        <View style={styles.cardActions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
            onPress={(e) => { e.stopPropagation?.(); openEdit(); }}
            hitSlop={8}
          >
            <Feather name="edit-2" size={13} color="#000" />
            <Text style={styles.actionBtnText}>Edit</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtnRemove, pressed && { opacity: 0.75 }]}
            onPress={(e) => { e.stopPropagation?.(); handleRemove(); }}
            hitSlop={8}
          >
            <Feather name="trash-2" size={13} color="#fff" />
            <Text style={styles.actionBtnTextRemove}>Remove PC</Text>
          </Pressable>
        </View>
      </Pressable>

      {/* ── Edit PC Modal ── */}
      <Modal
        transparent
        visible={editVisible}
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%" }}
          >
            <Pressable onPress={() => {}} style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Edit Connection</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="My Gaming PC"
                  placeholderTextColor={C.textMuted}
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>IP Address</Text>
                <TextInput
                  style={[styles.fieldInput, isDemo && styles.fieldInputDisabled]}
                  value={hostDraft}
                  onChangeText={setHostDraft}
                  placeholder="192.168.1.100"
                  placeholderTextColor={C.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  editable={!isDemo}
                />
                {isDemo && (
                  <Text style={styles.fieldHint}>Cannot change IP for demo mode</Text>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Port</Text>
                <TextInput
                  style={[styles.fieldInput, isDemo && styles.fieldInputDisabled]}
                  value={portDraft}
                  onChangeText={setPortDraft}
                  placeholder="8765"
                  placeholderTextColor={C.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={!isDemo}
                />
              </View>

              <View style={styles.sheetBtns}>
                <Pressable
                  style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setEditVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
                  onPress={saveEdit}
                >
                  <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const C = Colors.light;

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderTopWidth: 2,
    borderTopColor: C.tint,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  demoBadge: {
    backgroundColor: "#F97316",
    borderRadius: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  demoBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.3,
  },
  host: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  osText: {
    fontSize: 10,
    color: C.textMuted,
    maxWidth: 100,
  },
  cardSeparator: {
    height: 1,
    backgroundColor: C.cardBorder,
    marginHorizontal: -2,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: C.tint,
    borderRadius: 0,
  },
  actionBtnRemove: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: C.danger,
    borderRadius: 0,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
  actionBtnTextRemove: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  metrics: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  networkInfo: {
    alignItems: "center",
    gap: 4,
  },
  netRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  netVal: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: "500",
  },
  uptimeText: {
    fontSize: 10,
    color: C.textMuted,
    marginTop: 2,
  },
  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineText: {
    fontSize: 13,
    color: C.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.cardBorder,
    borderTopColor: C.tint,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 3,
    borderRadius: 0,
    backgroundColor: C.tint,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.3,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: C.background,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  fieldInputDisabled: {
    opacity: 0.45,
  },
  fieldHint: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: -2,
  },
  sheetBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 0,
    backgroundColor: C.tint,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
});
