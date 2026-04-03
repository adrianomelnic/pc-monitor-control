import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { CPUInfo } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, MiniBar, StatRow } from "./CardBase";

const C = Colors.light;
const ACCENT = "#00D4FF";

function fmt(mhz: number) {
  return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`;
}

interface Props {
  cpu: CPUInfo;
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function CPUCard({ cpu, titleEdit, cardEdit }: Props) {
  const cores = cpu.usagePerCore ?? [];
  const cols = cores.length > 8 ? 4 : 2;
  const hidden = new Set(cardEdit?.hiddenFields ?? []);

  return (
    <CardBase
      icon="cpu"
      title={titleEdit?.customTitle ?? "CPU"}
      subtitle={cpu.name}
      accentColor={ACCENT}
      temperature={cpu.temperature ?? null}
      titleEditable={titleEdit?.editable}
      titleDraft={titleEdit?.draft}
      onTitleChange={titleEdit?.onChange}
      onTitleSubmit={titleEdit?.onSubmit}
      rightAction={titleEdit?.rightAction}
      style={titleEdit?.borderStyle}
      extraSensorRows={cardEdit?.extraSensorRows}
      editPanel={cardEdit?.editPanel}
    >
      {/* Main stats row */}
      <View style={styles.mainRow}>
        <View style={styles.bigStat}>
          <Text style={[styles.bigNum, { color: ACCENT }]}>
            {Math.round(cpu.usageTotal)}
            <Text style={styles.bigUnit}>%</Text>
          </Text>
          <Text style={styles.bigLabel}>Usage</Text>
        </View>
        <View style={styles.detailGrid}>
          {!hidden.has("physicalCores") && (
            <StatRow label="Physical cores" value={String(cpu.coresPhysical ?? "—")} />
          )}
          {!hidden.has("logicalCores") && (
            <StatRow label="Logical cores" value={String(cpu.coresLogical ?? "—")} />
          )}
          {!hidden.has("freqCurrent") && (
            <StatRow label="Current freq" value={cpu.freqCurrent ? fmt(cpu.freqCurrent) : "—"} />
          )}
          {!hidden.has("freqMax") && (
            <StatRow label="Max freq" value={cpu.freqMax ? fmt(cpu.freqMax) : "—"} color={ACCENT} />
          )}
        </View>
      </View>

      {/* Per-core grid */}
      {cores.length > 0 && !hidden.has("perCore") && (
        <>
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionText}>PER CORE</Text>
          </View>
          <View style={[styles.coreGrid, { gap: cols === 4 ? 6 : 8 }]}>
            {cores.map((val, i) => {
              const barColor =
                val > 85 ? "#FF4444" : val > 65 ? "#FFB800" : ACCENT;
              return (
                <View
                  key={i}
                  style={[
                    styles.coreItem,
                    { width: cols === 4 ? "22%" : "47%" },
                  ]}
                >
                  <View style={styles.coreHeader}>
                    <Text style={styles.coreLabel}>C{i}</Text>
                    <Text style={[styles.corePct, { color: barColor }]}>
                      {Math.round(val)}%
                    </Text>
                  </View>
                  <MiniBar value={val} color={ACCENT} height={4} />
                </View>
              );
            })}
          </View>
        </>
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
    color: C.textSecondary,
    marginTop: 2,
  },
  detailGrid: {
    flex: 1,
    gap: 4,
  },
  sectionLabel: {
    marginTop: 2,
  },
  sectionText: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.2,
  },
  coreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  coreItem: {
    gap: 3,
    marginBottom: 6,
  },
  coreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coreLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "600",
  },
  corePct: {
    fontSize: 10,
    fontWeight: "700",
  },
});
