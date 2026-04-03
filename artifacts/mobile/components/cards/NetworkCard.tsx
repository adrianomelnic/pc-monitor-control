import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { NetworkInterface } from "@/context/PcsContext";
import { CardBase, CardTitleEditConfig } from "./CardBase";

const C = Colors.light;
const ACCENT = "#60A5FA";
const UP_COLOR = "#00D4FF";
const DOWN_COLOR = "#A78BFA";

function fmtSpeed(kbs: number) {
  if (kbs >= 1024) return `${(kbs / 1024).toFixed(1)} MB/s`;
  if (kbs < 1) return "0 KB/s";
  return `${Math.round(kbs)} KB/s`;
}

function fmtTotal(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

interface Props {
  interfaces: NetworkInterface[];
  titleEdit?: CardTitleEditConfig;
}

export function NetworkCard({ interfaces, titleEdit }: Props) {
  const active = interfaces.filter((i) => i.isUp);

  return (
    <CardBase
      icon="wifi"
      title={titleEdit?.customTitle ?? "Network"}
      subtitle={`${active.length} active interface${active.length !== 1 ? "s" : ""}`}
      accentColor={ACCENT}
      titleEditable={titleEdit?.editable}
      titleDraft={titleEdit?.draft}
      onTitleChange={titleEdit?.onChange}
      onTitleSubmit={titleEdit?.onSubmit}
      rightAction={titleEdit?.rightAction}
      style={titleEdit?.borderStyle}
    >
      {active.length === 0 ? (
        <Text style={styles.empty}>No active network interfaces</Text>
      ) : (
        <View style={styles.list}>
          {active.map((iface, i) => (
            <View key={i} style={[styles.ifaceItem, i > 0 && styles.ifaceDivider]}>
              {/* Interface name + link speed */}
              <View style={styles.ifaceHeader}>
                <View style={styles.nameBadge}>
                  <Feather name="wifi" size={11} color={ACCENT} />
                  <Text style={styles.ifaceName} numberOfLines={1}>
                    {iface.name}
                  </Text>
                </View>
                {iface.speedMax ? (
                  <Text style={styles.linkSpeed}>
                    {iface.speedMax >= 1000
                      ? `${iface.speedMax / 1000} Gbps`
                      : `${iface.speedMax} Mbps`}
                  </Text>
                ) : null}
              </View>

              {/* Speed cards */}
              <View style={styles.speedRow}>
                <View style={[styles.speedBox, { borderColor: UP_COLOR + "33" }]}>
                  <View style={styles.speedLabel}>
                    <Feather name="arrow-up" size={11} color={UP_COLOR} />
                    <Text style={styles.speedLabelText}>Upload</Text>
                  </View>
                  <Text style={[styles.speedVal, { color: UP_COLOR }]}>
                    {fmtSpeed(iface.speedUp)}
                  </Text>
                </View>
                <View style={[styles.speedBox, { borderColor: DOWN_COLOR + "33" }]}>
                  <View style={styles.speedLabel}>
                    <Feather name="arrow-down" size={11} color={DOWN_COLOR} />
                    <Text style={styles.speedLabelText}>Download</Text>
                  </View>
                  <Text style={[styles.speedVal, { color: DOWN_COLOR }]}>
                    {fmtSpeed(iface.speedDown)}
                  </Text>
                </View>
              </View>

              {/* Totals */}
              <View style={styles.totalsRow}>
                <Text style={styles.totalItem}>
                  <Text style={{ color: UP_COLOR }}>↑ </Text>
                  <Text style={styles.totalVal}>{fmtTotal(iface.totalSent)}</Text>
                  <Text style={styles.totalLabel}> sent</Text>
                </Text>
                <Text style={styles.totalDot}>·</Text>
                <Text style={styles.totalItem}>
                  <Text style={{ color: DOWN_COLOR }}>↓ </Text>
                  <Text style={styles.totalVal}>{fmtTotal(iface.totalRecv)}</Text>
                  <Text style={styles.totalLabel}> received</Text>
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  ifaceItem: {
    gap: 8,
    paddingVertical: 4,
  },
  ifaceDivider: {
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    marginTop: 4,
    paddingTop: 12,
  },
  ifaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ACCENT + "15",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ifaceName: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
    maxWidth: 180,
  },
  linkSpeed: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "600",
  },
  speedRow: {
    flexDirection: "row",
    gap: 8,
  },
  speedBox: {
    flex: 1,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  speedLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  speedLabelText: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  speedVal: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  totalsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  totalItem: {
    fontSize: 11,
  },
  totalVal: {
    fontSize: 11,
    color: C.text,
    fontWeight: "700",
  },
  totalLabel: {
    fontSize: 11,
    color: C.textMuted,
  },
  totalDot: {
    fontSize: 11,
    color: C.textMuted,
  },
  empty: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
});
