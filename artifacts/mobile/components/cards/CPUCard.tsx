import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme, tabularNumsVariant } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { CPUInfo } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, MiniBar, StatRow } from "./CardBase";

function fmt(mhz: number) {
  return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`;
}

const DEFAULT_ORDER = ["usage", "voltage", "wattage", "physicalCores", "logicalCores", "freqCurrent", "freqMax", "perCore", "perCoreVertical", "cpuBar"];

interface Props {
  cpu: CPUInfo;
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function CPUCard({ cpu, titleEdit, cardEdit }: Props) {
  const { theme } = useTheme();
  const C = theme.colors;
  const ACCENT = theme.cardAccents.cpu;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cores = cpu.usagePerCore ?? [];
  const cols = cores.length > 8 ? 4 : 2;
  const hidden = cardEdit?.hiddenFields !== undefined
    ? new Set(cardEdit.hiddenFields)
    : new Set(["perCore", "cpuBar", "physicalCores", "logicalCores"]);
  const order = cardEdit?.fieldOrder ?? DEFAULT_ORDER;
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;
  const sectionLabel = (s: string) => (theme.titleCase === "upper" ? s.toUpperCase() : s);

  const visibleOrder = order.filter(k => !hidden.has(k));
  const showHero = !hidden.has("usage");
  const BELOW_KEYS = new Set(["perCore", "perCoreVertical", "cpuBar"]);
  const rightFields = visibleOrder.filter(k => k !== "usage" && !BELOW_KEYS.has(k));
  const showPerCore = !hidden.has("perCore") && cores.length > 0;
  const showPerCoreVertical = !hidden.has("perCoreVertical") && cores.length > 0;
  const showCpuBar = !hidden.has("cpuBar");

  function renderRightField(key: string): React.ReactNode {
    if (extraMap[key] !== undefined && key !== "perCore" && key !== "perCoreVertical" && key !== "cpuBar") {
      return <StatRow key={key} label={getLabel(key, key)} value={extraMap[key]} />;
    }
    switch (key) {
      case "voltage":
        return <StatRow key={key} label={getLabel("voltage", "Voltage")} value={cpu.voltage != null ? `${cpu.voltage.toFixed(3)} V` : "—"} color={ACCENT} />;
      case "wattage":
        return <StatRow key={key} label={getLabel("wattage", "Power")} value={cpu.power != null ? `${Math.round(cpu.power)} W` : "—"} />;
      case "physicalCores":
        return <StatRow key={key} label={getLabel("physicalCores", "Phys Cores")} value={String(cpu.coresPhysical ?? "—")} />;
      case "logicalCores":
        return <StatRow key={key} label={getLabel("logicalCores", "Logical")} value={String(cpu.coresLogical ?? "—")} />;
      case "freqCurrent":
        return <StatRow key={key} label={getLabel("freqCurrent", "Freq")} value={cpu.freqCurrent ? fmt(cpu.freqCurrent) : "—"} />;
      case "freqMax":
        return <StatRow key={key} label={getLabel("freqMax", "Max Freq")} value={cpu.freqMax ? fmt(cpu.freqMax) : "—"} color={ACCENT} />;
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
            <Text style={[styles.bigNum, { color: ACCENT }]}>{Math.round(cpu.usageTotal)}
              <Text style={styles.bigUnit}>%</Text>
            </Text>
            <Text style={styles.bigLabel}>{sectionLabel(getLabel("usage", "Usage"))}</Text>
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
        <View style={styles.belowSection}>
          <Text style={styles.sectionLabel}>{sectionLabel(getLabel("perCore", "Per Core"))}</Text>
          <View style={[styles.coreGrid, { gap: cols === 4 ? 6 : 8 }]}>
            {cores.map((val, i) => {
              const barColor = val > 85 ? C.danger : val > 65 ? C.warning : ACCENT;
              return (
                <View key={i} style={[styles.coreItem, { width: cols === 4 ? "22%" : "47%" }]}>
                  <View style={styles.coreHeader}>
                    <Text style={styles.coreLabel}>C{i}</Text>
                    <Text style={[styles.corePct, { color: barColor }]}>{Math.round(val)}%</Text>
                  </View>
                  <MiniBar value={val} color={ACCENT} height={3} />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {showPerCoreVertical && (
        <View style={styles.belowSection}>
          <Text style={styles.sectionLabel}>
            {sectionLabel(getLabel("perCoreVertical", "Per Core"))}{cores.length > 8 ? `  (${cores.length})` : ""}
          </Text>
          <View style={styles.verticalChartRow}>
            {cores.map((val, i) => {
              const barColor = val > 85 ? C.danger : val > 65 ? C.warning : ACCENT;
              const fillH = Math.max((val / 100) * 52, 2);
              const showLabel = cores.length <= 8;
              return (
                <View key={i} style={styles.verticalBarCol}>
                  <View style={styles.verticalBarTrack}>
                    <View style={[styles.verticalBarFill, { height: fillH, backgroundColor: barColor }]} />
                  </View>
                  {showLabel && <Text style={styles.verticalBarNum}>{i}</Text>}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {showCpuBar && (
        <View style={styles.belowSection}>
          <View style={styles.cpuBarHeader}>
            <Text style={styles.sectionLabel}>{sectionLabel(getLabel("cpuBar", "CPU Load"))}</Text>
            <Text style={[styles.cpuBarPct, { color: cpu.usageTotal > 85 ? C.danger : cpu.usageTotal > 65 ? C.warning : ACCENT }]}>
              {Math.round(cpu.usageTotal)}%
            </Text>
          </View>
          <MiniBar value={cpu.usageTotal} color={ACCENT} height={5} />
        </View>
      )}
    </CardBase>
  );
}

const createStyles = (t: Theme) => {
  const C = t.colors;
  const fontVariant = tabularNumsVariant(t);
  return StyleSheet.create({
    heroRow: {
      flexDirection: "row",
      gap: 14,
      alignItems: "flex-start",
    },
    heroLeft: {
      alignItems: "center",
      justifyContent: "flex-start",
      minWidth: 60,
      paddingTop: 0,
    },
    heroRight: {
      flex: 1,
      gap: 6,
    },
    bigNum: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -1.5,
      fontVariant,
      lineHeight: 36,
    },
    bigUnit: {
      fontSize: 16,
      fontWeight: "600",
    },
    bigLabel: {
      fontSize: 9,
      color: C.textMuted,
      fontWeight: "700",
      marginTop: 2,
      letterSpacing: t.sectionLabelLetterSpacing,
    },
    fieldList: {
      gap: 6,
    },
    belowSection: {
      marginTop: 4,
      gap: 4,
    },
    sectionLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: C.textMuted,
      letterSpacing: t.sectionLabelLetterSpacing,
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
      fontSize: 9,
      color: C.textMuted,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    corePct: {
      fontSize: 10,
      fontWeight: "800",
      fontVariant,
    },
    verticalChartRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
    },
    verticalBarCol: {
      flex: 1,
      alignItems: "center",
      gap: 3,
    },
    verticalBarTrack: {
      width: "100%",
      height: 52,
      justifyContent: "flex-end",
      backgroundColor: C.textMuted + "18",
      borderRadius: 1,
      overflow: "hidden",
    },
    verticalBarFill: {
      width: "100%",
      borderRadius: 1,
    },
    verticalBarNum: {
      fontSize: 8,
      color: C.textMuted,
      fontWeight: "700",
    },
    cpuBarHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cpuBarPct: {
      fontSize: 11,
      fontWeight: "800",
      fontVariant,
    },
  });
};
