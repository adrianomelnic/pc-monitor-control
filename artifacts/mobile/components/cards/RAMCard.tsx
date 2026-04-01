import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { RAMInfo } from "@/context/PcsContext";
import { CardBase, MiniBar, StatRow } from "./CardBase";

const C = Colors.light;
const ACCENT = "#A78BFA";
const SWAP_COLOR = "#F472B6";

function fmtMB(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

interface Props {
  ram: RAMInfo;
}

export function RAMCard({ ram }: Props) {
  const usedColor =
    ram.percent > 85 ? "#FF4444" : ram.percent > 65 ? "#FFB800" : ACCENT;
  const swapPct =
    ram.swapTotal > 0 ? (ram.swapUsed / ram.swapTotal) * 100 : 0;

  return (
    <CardBase icon="database" title="Memory" accentColor={ACCENT}>
      {/* Main row */}
      <View style={styles.mainRow}>
        <View style={styles.bigStat}>
          <Text style={[styles.bigNum, { color: usedColor }]}>
            {Math.round(ram.percent)}
            <Text style={styles.bigUnit}>%</Text>
          </Text>
          <Text style={styles.bigLabel}>In use</Text>
        </View>
        <View style={styles.detailGrid}>
          <StatRow label="Used" value={fmtMB(ram.used)} color={ACCENT} />
          <StatRow label="Available" value={fmtMB(ram.available)} color="#00CC88" />
          <StatRow label="Total" value={fmtMB(ram.total)} />
        </View>
      </View>

      {/* RAM bar */}
      <View style={styles.barSection}>
        <View style={styles.barHeader}>
          <Text style={styles.sectionText}>RAM</Text>
          <Text style={styles.barCaption}>
            {fmtMB(ram.used)} / {fmtMB(ram.total)}
          </Text>
        </View>
        <MiniBar value={ram.percent} color={ACCENT} height={6} />
      </View>

      {/* Swap */}
      {ram.swapTotal > 0 && (
        <View style={styles.barSection}>
          <View style={styles.barHeader}>
            <Text style={styles.sectionText}>SWAP / PAGE FILE</Text>
            <Text style={styles.barCaption}>
              {fmtMB(ram.swapUsed)} / {fmtMB(ram.swapTotal)}
            </Text>
          </View>
          <MiniBar value={swapPct} color={SWAP_COLOR} height={5} />
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  bigStat: {
    alignItems: "center",
    minWidth: 64,
  },
  bigNum: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  bigUnit: {
    fontSize: 18,
    fontWeight: "400",
  },
  bigLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  detailGrid: {
    flex: 1,
    gap: 5,
  },
  barSection: {
    gap: 5,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.light.textMuted,
    letterSpacing: 1.2,
  },
  barCaption: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: "600",
  },
});
