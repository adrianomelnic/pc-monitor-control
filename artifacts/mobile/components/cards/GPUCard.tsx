import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { GPUInfo } from "@/context/PcsContext";
import { CardBase, MiniBar, StatRow } from "./CardBase";

const C = Colors.light;
const ACCENT = "#34D399";

function fmtMB(mb: number | null) {
  if (mb == null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

interface Props {
  gpus: GPUInfo[];
}

export function GPUCard({ gpus }: Props) {
  if (!gpus || gpus.length === 0) {
    return (
      <CardBase icon="monitor" title="GPU" accentColor={ACCENT}>
        <Text style={styles.empty}>No GPU detected or nvidia-smi not available</Text>
      </CardBase>
    );
  }

  return (
    <>
      {gpus.map((gpu, idx) => {
        const vramPct =
          gpu.vramTotal && gpu.vramUsed != null
            ? (gpu.vramUsed / gpu.vramTotal) * 100
            : null;

        return (
          <CardBase
            key={idx}
            icon="monitor"
            title={`GPU${gpus.length > 1 ? ` ${idx}` : ""}`}
            subtitle={gpu.name}
            accentColor={ACCENT}
            temperature={gpu.temperature ?? null}
          >
            <View style={styles.mainRow}>
              {/* Usage big number */}
              <View style={styles.bigStat}>
                <Text style={[styles.bigNum, { color: gpu.usage != null ? ACCENT : C.textMuted }]}>
                  {gpu.usage != null ? Math.round(gpu.usage) : "—"}
                  {gpu.usage != null && <Text style={styles.bigUnit}>%</Text>}
                </Text>
                <Text style={styles.bigLabel}>GPU Load</Text>
              </View>

              <View style={styles.detailGrid}>
                <StatRow
                  label="VRAM used"
                  value={`${fmtMB(gpu.vramUsed)} / ${fmtMB(gpu.vramTotal)}`}
                  color={ACCENT}
                />
                {gpu.clockGpu != null && (
                  <StatRow label="GPU clock" value={`${gpu.clockGpu} MHz`} />
                )}
                {gpu.clockMem != null && (
                  <StatRow label="Mem clock" value={`${gpu.clockMem} MHz`} />
                )}
              </View>
            </View>

            {/* VRAM bar */}
            {vramPct != null && (
              <View style={styles.vramSection}>
                <View style={styles.vramHeader}>
                  <Text style={styles.sectionText}>VRAM</Text>
                  <Text style={[styles.vramPct, { color: vramPct > 85 ? "#FF4444" : ACCENT }]}>
                    {Math.round(vramPct)}%
                  </Text>
                </View>
                <MiniBar value={vramPct} color={ACCENT} height={6} />
              </View>
            )}
          </CardBase>
        );
      })}
    </>
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
  vramSection: {
    gap: 5,
  },
  vramHeader: {
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
  vramPct: {
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    fontSize: 12,
    color: Colors.light.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
});
