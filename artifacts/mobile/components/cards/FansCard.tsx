import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { FanInfo } from "@/context/PcsContext";
import { CardBase } from "./CardBase";

const C = Colors.light;
const ACCENT = "#FB923C";

function rpmColor(rpm: number) {
  if (rpm > 2500) return "#FF4444";
  if (rpm > 1500) return "#FFB800";
  return "#00CC88";
}

function rpmBar(rpm: number, max = 3000) {
  return Math.min(100, (rpm / max) * 100);
}

interface Props {
  fans: FanInfo[];
}

export function FansCard({ fans }: Props) {
  return (
    <CardBase
      icon="wind"
      title="Fans"
      subtitle={fans.length > 0 ? `${fans.length} fan${fans.length > 1 ? "s" : ""} detected` : undefined}
      accentColor={ACCENT}
    >
      {fans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyRow}>
            <Feather name="info" size={13} color={C.warning} />
            <Text style={styles.emptyTitle}>No fan sensors detected</Text>
          </View>
          <Text style={styles.emptyText}>
            To get fan speeds and CPU temps on Windows, enable{" "}
            <Text style={styles.emptyCode}>Shared Memory Support</Text> in
            HWiNFO64:
          </Text>
          <View style={styles.steps}>
            {["Open HWiNFO64 and click Settings", "Go to the HWiNFO64 tab", 'Check "Shared Memory Support"', "Restart pc_agent.py"].map(
              (s, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepDot} />
                  <Text style={styles.stepText}>{s}</Text>
                </View>
              )
            )}
          </View>
        </View>
      ) : (
        <View style={styles.fanList}>
          {fans.map((fan, i) => {
            const color = rpmColor(fan.rpm);
            const pct = rpmBar(fan.rpm);
            return (
              <View key={i} style={styles.fanRow}>
                <View style={styles.fanLeft}>
                  <Feather name="wind" size={12} color={color} />
                  <Text style={styles.fanLabel} numberOfLines={1}>
                    {fan.label}
                  </Text>
                </View>
                <View style={styles.fanRight}>
                  <View style={styles.fanBarTrack}>
                    <View
                      style={[
                        styles.fanBarFill,
                        { width: `${pct}%` as any, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.fanRpm, { color }]}>
                    {fan.rpm.toLocaleString()} RPM
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  fanList: {
    gap: 10,
  },
  fanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fanLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 110,
    flexShrink: 0,
  },
  fanLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  fanRight: {
    flex: 1,
    gap: 4,
  },
  fanBarTrack: {
    height: 5,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 3,
    overflow: "hidden",
  },
  fanBarFill: {
    height: 5,
    borderRadius: 3,
  },
  fanRpm: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyWrap: {
    gap: 8,
  },
  emptyRow: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.warning,
  },
  emptyText: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
  emptyCode: {
    fontFamily: "Menlo, monospace",
    color: C.text,
    fontWeight: "600",
  },
  steps: {
    gap: 5,
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: ACCENT,
    flexShrink: 0,
  },
  stepText: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
});
