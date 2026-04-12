import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { DiskInfo } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, MiniBar, StatRow, TempBadge } from "./CardBase";

const C = Colors.light;
const ACCENT = "#00BFA5";

function fmtMB(mb: number) {
  if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(1)} TB`;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function fmtSpeed(kbs: number) {
  if (kbs >= 1024) return `${(kbs / 1024).toFixed(1)} MB/s`;
  return `${Math.round(kbs)} KB/s`;
}

interface Props {
  disks: DiskInfo[];
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function DisksCard({ disks, titleEdit, cardEdit }: Props) {
  if (!disks || disks.length === 0) return null;
  const hidden = new Set(cardEdit?.hiddenFields ?? []);
  const defaultKeys = disks.map(d => d.device || d.mountpoint);
  const order = cardEdit?.fieldOrder ?? defaultKeys;
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;
  const diskMap = new Map(disks.map(d => [d.device || d.mountpoint, d]));
  const visibleKeys = order.filter(k => !hidden.has(k));
  const visibleDiskCount = visibleKeys.filter(k => diskMap.has(k)).length;

  function renderItem(key: string, idx: number): React.ReactNode {
    const disk = diskMap.get(key);
    if (disk) {
      const label = disk.device.replace(/\\\\.\\/, "").replace(/\/$/, "") || disk.mountpoint;
      const diskColor = disk.percent > 85 ? "#FF4444" : disk.percent > 65 ? "#FFB800" : ACCENT;
      return (
        <View key={key} style={[styles.diskItem, idx > 0 && styles.diskDivider]}>
          <View style={styles.diskHeader}>
            <View style={styles.diskTitleRow}>
              <View style={[styles.diskBadge, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "33" }]}>
                <Text style={[styles.diskBadgeText, { color: ACCENT }]}>{label}</Text>
              </View>
              {disk.fstype ? (
                <Text style={styles.fstype}>{disk.fstype.toUpperCase()}</Text>
              ) : null}
            </View>
            {disk.temperature != null ? <TempBadge value={disk.temperature} /> : null}
          </View>
          <View style={styles.usageRow}>
            <View style={styles.usageFlex}>
              <MiniBar value={disk.percent} color={ACCENT} height={5} />
            </View>
            <Text style={[styles.usagePct, { color: diskColor }]}>{Math.round(disk.percent)}%</Text>
          </View>
          <View style={styles.spaceRow}>
            <Text style={styles.spaceUsed}>{fmtMB(disk.used)} used</Text>
            <Text style={styles.spaceSep}>·</Text>
            <Text style={styles.spaceFree}>{fmtMB(disk.free)} free</Text>
            <Text style={styles.spaceSep}>·</Text>
            <Text style={styles.spaceTotal}>{fmtMB(disk.total)} total</Text>
          </View>
          <View style={styles.ioRow}>
            <View style={styles.ioItem}>
              <Text style={styles.ioLabel}>READ</Text>
              <Text style={[styles.ioVal, { color: ACCENT }]}>{fmtSpeed(disk.readSpeed ?? 0)}</Text>
            </View>
            <View style={styles.ioSep} />
            <View style={styles.ioItem}>
              <Text style={styles.ioLabel}>WRITE</Text>
              <Text style={[styles.ioVal, { color: "#FF6D00" }]}>{fmtSpeed(disk.writeSpeed ?? 0)}</Text>
            </View>
          </View>
        </View>
      );
    }
    const val = extraMap[key];
    return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
  }

  return (
    <CardBase
      icon="hard-drive"
      title={titleEdit?.customTitle ?? "Storage"}
      subtitle={`${visibleDiskCount} volume${visibleDiskCount !== 1 ? "s" : ""}`}
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
      <View style={styles.diskList}>
        {visibleKeys.map((key, idx) => renderItem(key, idx))}
      </View>
    </CardBase>
  );
}

const styles = StyleSheet.create({
  diskList: { gap: 0 },
  diskItem: { gap: 7, paddingVertical: 4 },
  diskDivider: { borderTopWidth: 1, borderTopColor: C.cardBorder, marginTop: 4, paddingTop: 12 },
  diskHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  diskTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  diskBadge: { borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  diskBadgeText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, fontVariant: ["tabular-nums"] },
  fstype: { fontSize: 9, color: C.textMuted, fontWeight: "700", letterSpacing: 1 },
  usageRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  usageFlex: { flex: 1 },
  usagePct: { fontSize: 12, fontWeight: "800", width: 36, textAlign: "right", fontVariant: ["tabular-nums"] },
  spaceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  spaceUsed: { fontSize: 10, color: C.text, fontWeight: "600", fontVariant: ["tabular-nums"] },
  spaceFree: { fontSize: 10, color: C.success, fontWeight: "600", fontVariant: ["tabular-nums"] },
  spaceTotal: { fontSize: 10, color: C.textMuted, fontWeight: "500", fontVariant: ["tabular-nums"] },
  spaceSep: { fontSize: 10, color: C.textMuted },
  ioRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundSecondary,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 8,
    gap: 0,
  },
  ioItem: { flex: 1, alignItems: "center", gap: 2 },
  ioLabel: { fontSize: 9, color: C.textMuted, fontWeight: "700", letterSpacing: 1.2 },
  ioVal: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  ioSep: { width: 1, height: 28, backgroundColor: C.cardBorder },
});
