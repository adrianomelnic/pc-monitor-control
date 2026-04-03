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
const HERO_DETAIL_KEYS = new Set(["physicalCores", "logicalCores", "freqCurrent", "freqMax"]);

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
  const heroDetails = showHero ? visibleOrder.filter(k => HERO_DETAIL_KEYS.has(k)) : [];
  const heroSet = new Set(showHero ? ["usage", ...heroDetails] : []);
  const belowFields = visibleOrder.filter(k => !heroSet.has(k));

  function renderHeroDetail(key: string): React.ReactNode {
    switch (key) {
      case "physicalCores":
        return (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{getLabel("physicalCores", "Physical cores")}</Text>
            <Text style={styles.detailValue}>{String(cpu.coresPhysical ?? "—")}</Text>
          </View>
        );
      case "logicalCores":
        return (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{getLabel("logicalCores", "Logical cores")}</Text>
            <Text style={styles.detailValue}>{String(cpu.coresLogical ?? "—")}</Text>
          </View>
        );
      case "freqCurrent":
        return (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{getLabel("freqCurrent", "Current freq")}</Text>
            <Text style={styles.detailValue}>{cpu.freqCurrent ? fmt(cpu.freqCurrent) : "—"}</Text>
          </View>
        );
      case "freqMax":
        return (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{getLabel("freqMax", "Max freq")}</Text>
            <Text style={[styles.detailValue, { color: ACCENT }]}>{cpu.freqMax ? fmt(cpu.freqMax) : "—"}</Text>
          </View>
        );
      default:
        return null;
    }
  }

  function renderField(key: string): React.ReactNode {
    switch (key) {
      case "usage":
        return <StatRow key={key} label={getLabel("usage", "Usage")} value={`${Math.round(cpu.usageTotal)}%`} color={ACCENT} />;
      case "physicalCores":
        return <StatRow key={key} label={getLabel("physicalCores", "Physical cores")} value={String(cpu.coresPhysical ?? "—")} />;
      case "logicalCores":
        return <StatRow key={key} label={getLabel("logicalCores", "Logical cores")} value={String(cpu.coresLogical ?? "—")} />;
      case "freqCurrent":
        return <StatRow key={key} label={getLabel("freqCurrent", "Current freq")} value={cpu.freqCurrent ? fmt(cpu.freqCurrent) : "—"} />;
      case "freqMax":
        return <StatRow key={key} label={getLabel("freqMax", "Max freq")} value={cpu.freqMax ? fmt(cpu.freqMax) : "—"} color={ACCENT} />;
      case "perCore":
        return cores.length > 0 ? (
          <View key={key}>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionText}>PER CORE</Text>
            </View>
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
        ) : null;
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
      {showHero && (
        <View style={styles.heroRow}>
          <View style={styles.heroBig}>
            <Text style={[styles.bigNum, { color: ACCENT }]}>{Math.round(cpu.usageTotal)}%</Text>
            <Text style={styles.bigLabel}>{getLabel("usage", "Usage")}</Text>
          </View>
          {heroDetails.length > 0 && (
            <View style={styles.heroDetails}>
              {heroDetails.map(k => renderHeroDetail(k))}
            </View>
          )}
        </View>
      )}
      {belowFields.length > 0 && (
        <View style={styles.fieldList}>
          {belowFields.map(key => renderField(key))}
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  fieldList: {
    gap: 4,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroBig: {
    alignItems: "center",
    minWidth: 54,
  },
  bigNum: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
  },
  bigLabel: {
    fontSize: 10,
    color: C.textSecondary,
    fontWeight: "600",
    marginTop: -2,
  },
  heroDetails: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 12,
    color: C.text,
    fontWeight: "700",
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
