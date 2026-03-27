import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Colors from "@/constants/colors";
import { PC } from "@/context/PcsContext";
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

  return (
    <Pressable
      onPress={() => router.push(`/pc/${pc.id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View>
            <Text style={styles.name}>{pc.name}</Text>
            <Text style={styles.host}>{pc.host}:{pc.port}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {pc.os ? (
            <Feather
              name={
                pc.os.toLowerCase().includes("win")
                  ? "monitor"
                  : pc.os.toLowerCase().includes("mac")
                  ? "cpu"
                  : "terminal"
              }
              size={16}
              color={C.textSecondary}
            />
          ) : null}
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {pc.status === "online" && pc.metrics ? (
        <View style={styles.metrics}>
          <MetricRing
            value={pc.metrics.cpuUsage}
            label="CPU"
            color={C.tint}
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
    </Pressable>
  );
}

const C = Colors.light;

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    gap: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "600",
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
});
