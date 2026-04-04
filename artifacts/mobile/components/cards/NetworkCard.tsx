import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { NetworkInterface } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, StatRow } from "./CardBase";

const C = Colors.light;
const ACCENT = "#60A5FA";
const UP_COLOR = "#00D4FF";
const DOWN_COLOR = "#A78BFA";

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
  cardEdit?: BuiltinCardEdit;
}

export function NetworkCard({ interfaces, titleEdit, cardEdit }: Props) {
  const hidden = new Set(cardEdit?.hiddenFields ?? []);
  const allUp = interfaces.filter((i) => i.isUp);
  // Default: show only physical interfaces. If the user has saved a custom order, respect it.
  const physicalUp = allUp.filter((i) => !isVirtualIface(i.name));
  const order = cardEdit?.fieldOrder ?? physicalUp.map((i) => i.name);
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;
  const ifaceMap = new Map(allUp.map(i => [i.name, i]));
  const visibleKeys = order.filter(k => !hidden.has(k));
  const visibleIfaceCount = visibleKeys.filter(k => ifaceMap.has(k)).length;

  function renderItem(key: string, idx: number): React.ReactNode {
    const iface = ifaceMap.get(key);
    if (iface) {
      return (
        <View key={key} style={[styles.ifaceItem, idx > 0 && styles.ifaceDivider]}>
          <View style={styles.ifaceHeader}>
            <View style={styles.nameBadge}>
              <Feather name="wifi" size={11} color={ACCENT} />
              <Text style={styles.ifaceName} numberOfLines={1}>{iface.name}</Text>
            </View>
            {iface.speedMax ? (
              <Text style={styles.linkSpeed}>
                {iface.speedMax >= 1000 ? `${iface.speedMax / 1000} Gbps` : `${iface.speedMax} Mbps`}
              </Text>
            ) : null}
          </View>
          <View style={styles.speedRow}>
            <View style={[styles.speedBox, { borderColor: UP_COLOR + "33" }]}>
              <View style={styles.speedLabel}>
                <Feather name="arrow-up" size={11} color={UP_COLOR} />
                <Text style={styles.speedLabelText}>Upload</Text>
              </View>
              <Text style={[styles.speedVal, { color: UP_COLOR }]}>{fmtSpeed(iface.speedUp)}</Text>
            </View>
            <View style={[styles.speedBox, { borderColor: DOWN_COLOR + "33" }]}>
              <View style={styles.speedLabel}>
                <Feather name="arrow-down" size={11} color={DOWN_COLOR} />
                <Text style={styles.speedLabelText}>Download</Text>
              </View>
              <Text style={[styles.speedVal, { color: DOWN_COLOR }]}>{fmtSpeed(iface.speedDown)}</Text>
            </View>
          </View>
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
      );
    }
    const val = extraMap[key];
    return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
  }

  return (
    <CardBase
      icon="wifi"
      title={titleEdit?.customTitle ?? "Network"}
      subtitle={`${visibleIfaceCount} active interface${visibleIfaceCount !== 1 ? "s" : ""}`}
      accentColor={ACCENT}
      titleEditable={titleEdit?.editable}
      titleDraft={titleEdit?.draft}
      onTitleChange={titleEdit?.onChange}
      onTitleSubmit={titleEdit?.onSubmit}
      onTitlePress={titleEdit?.onTitlePress}
      extraTemps={cardEdit?.extraTemps}
      rightAction={titleEdit?.rightAction}
      style={titleEdit?.borderStyle}
      editPanel={cardEdit?.editPanel}
    >
      {allUp.length === 0 ? (
        <View>
          <Text style={styles.empty}>No active network interfaces</Text>
          {visibleKeys.filter(k => !ifaceMap.has(k)).map(key => {
            const val = extraMap[key];
            return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
          })}
        </View>
      ) : (
        <View style={styles.list}>
          {visibleKeys.map((key, idx) => renderItem(key, idx))}
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  ifaceItem: { gap: 8, paddingVertical: 4 },
  ifaceDivider: { borderTopWidth: 1, borderTopColor: C.cardBorder, marginTop: 4, paddingTop: 12 },
  ifaceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nameBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ACCENT + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  ifaceName: { fontSize: 12, fontWeight: "700", color: ACCENT, maxWidth: 180 },
  linkSpeed: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
  speedRow: { flexDirection: "row", gap: 8 },
  speedBox: { flex: 1, backgroundColor: C.backgroundSecondary, borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  speedLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  speedLabelText: { fontSize: 10, color: C.textMuted, fontWeight: "600", letterSpacing: 0.3 },
  speedVal: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  totalsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  totalItem: { fontSize: 11 },
  totalVal: { fontSize: 11, color: C.text, fontWeight: "700" },
  totalLabel: { fontSize: 11, color: C.textMuted },
  totalDot: { fontSize: 11, color: C.textMuted },
  empty: { fontSize: 12, color: C.textMuted, textAlign: "center", paddingVertical: 8 },
});
