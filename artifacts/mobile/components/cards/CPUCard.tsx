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

const DEFAULT_ORDER = ["usage", "physicalCores", "logicalCores", "freqCurrent", "freqMax", "perCore"];

interface Props {
  cpu: CPUInfo;
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function CPUCard({ cpu, titleEdit, cardEdit }: Props) {
  const cores = cpu.usagePerCore ?? [];
  const cols = cores.length > 8 ? 4 : 2;
  const hidden = new Set(cardEdit?.hiddenFields ?? []);
  const order = cardEdit?.fieldOrder ?? DEFAULT_ORDER;
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;

  const visibleOrder = order.filter(k => !hidden.has(k));
  const showHero = !hidden.has("usage");
  const rightFields = visibleOrder.filter(k => k !== "usage" && k !== "perCore");
  const showPerCore = !hidden.has("perCore") && cores.length > 0;

  function renderRightField(key: string): React.ReactNode {
    switch (key) {
      case "physicalCores":
        return <StatRow key={key} label={getLabel("physicalCores", "Physical cores")} value={String(cpu.coresPhysical ?? "—")} />;
      case "logicalCores":
        return <StatRow key={key} label={getLabel("logicalCores", "Logical cores")} value={String(cpu.coresLogical ?? "—")} />;
      case "freqCurrent":
        return <StatRow key={key} label={getLabel("freqCurrent", "Current freq")} value={cpu.freqCurrent ? fmt(cpu.freqCurrent) : "—"} />;
      case "freqMax":
        return <StatRow key={key} label={getLabel("freqMax", "Max freq")} value={cpu.freqMax ? fmt(cpu.freqMax) : "—"} color={ACCENT} />;
      default: {
        const val = extraMap[key];
        return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
      }
    }
  }

  return (
    <CardBase
      icon="cpu"
      title={titleEdit?.customTitle ?? "CPU"}
      subtitle={cpu.name}
      accentColor={ACCENT}
      temperature={cpu.temperature ?? null}
      extraTemps={cardEdit?.extraTemps}
      titleEditable={titleEdit?.editable}
      titleDraft={titleEdit?.draft}
      onTitleChange={titleEdit?.onChange}
      onTitleSubmit={titleEdit?.onSubmit}
      onTitlePress={titleEdit?.onTitlePress}
      rightAction={titleEdit?.rightAction}
      style={titleEdit?.borderStyle}
      editPanel={cardEdit?.editPanel}
    >
      {showHero ? (
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <Text style={[styles.bigNum, { color: ACCENT }]}>{Math.round(cpu.usageTotal)}%</Text>
            <Text style={styles.bigLabel}>{getLabel("usage", "Usage")}</Text>
          </View>
          <View style={styles.heroRight}>
            {rightFields.map(key => renderRightField(key))}
          </View>
        </View>
      ) : (
        <View style={styles.fieldList}>
          {rightFields.map(key => renderRightField(key))}
        </View>
      )}

      {showPerCore && (
        <View style={styles.perCoreSection}>
          <Text style={styles.sectionLabel}>PER CORE</Text>
          <View style={[styles.coreGrid, { gap: cols === 4 ? 6 : 8 }]}>
            {cores.map((val, i) => {
              const barColor = val > 85 ? "#FF4444" : val > 65 ? "#FFB800" : ACCENT;
              return (
                <View key={i} style={[styles.coreItem, { width: cols === 4 ? "22%" : "47%" }]}>
                  <View style={styles.coreHeader}>
                    <Text style={styles.coreLabel}>C{i}</Text>
                    <Text style={[styles.corePct, { color: barColor }]}>{Math.round(val)}%</Text>
                  </View>
                  <MiniBar value={val} color={ACCENT} height={4} />
                </View>
              );
            })}
          </View>
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  heroLeft: {
    alignItems: "center",
    justifyContent: "flex-start",
    minWidth: 54,
    paddingTop: 2,
  },
  heroRight: {
    flex: 1,
    gap: 5,
  },
  bigNum: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
  },
  bigLabel: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: "600",
    marginTop: 1,
  },
  fieldList: {
    gap: 5,
  },
  perCoreSection: {
    marginTop: 6,
    gap: 4,
  },
  sectionLabel: {
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
