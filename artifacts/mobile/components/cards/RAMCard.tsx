import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { RAMInfo } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, MiniBar, StatRow } from "./CardBase";

const C = Colors.light;
const ACCENT = "#A78BFA";
const SWAP_COLOR = "#F472B6";

function fmtMB(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

const DEFAULT_ORDER = ["usage", "used", "available", "total", "bar", "swap"];

interface Props {
  ram: RAMInfo;
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function RAMCard({ ram, titleEdit, cardEdit }: Props) {
  const usedColor =
    ram.percent > 85 ? "#FF4444" : ram.percent > 65 ? "#FFB800" : ACCENT;
  const swapPct =
    ram.swapTotal > 0 ? (ram.swapUsed / ram.swapTotal) * 100 : 0;
  const hidden = new Set(cardEdit?.hiddenFields ?? []);
  const order = cardEdit?.fieldOrder ?? DEFAULT_ORDER;
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;

  const visibleOrder = order.filter(k => !hidden.has(k));
  const showHero = !hidden.has("usage");
  const rightFields = visibleOrder.filter(k => k !== "usage" && k !== "bar" && k !== "swap");
  const showBar = !hidden.has("bar");
  const showSwap = !hidden.has("swap") && ram.swapTotal > 0;

  function renderRightField(key: string): React.ReactNode {
    // If a sensor source override exists for this field, use it
    if (extraMap[key] !== undefined) {
      return <StatRow key={key} label={getLabel(key, key)} value={extraMap[key]} />;
    }
    switch (key) {
      case "used":
        return <StatRow key={key} label={getLabel("used", "Used")} value={fmtMB(ram.used)} color={ACCENT} />;
      case "available":
        return <StatRow key={key} label={getLabel("available", "Available")} value={fmtMB(ram.available)} color="#00CC88" />;
      case "total":
        return <StatRow key={key} label={getLabel("total", "Total")} value={fmtMB(ram.total)} />;
      default: {
        const val = extraMap[key];
        return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
      }
    }
  }

  return (
    <CardBase
      icon="database"
      title={titleEdit?.customTitle ?? "Memory"}
      accentColor={ACCENT}
      temperature={ram.temperature ?? undefined}
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
            <Text style={[styles.bigNum, { color: usedColor }]}>{Math.round(ram.percent)}%</Text>
            <Text style={styles.bigLabel}>{getLabel("usage", "In use")}</Text>
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

      {(showBar || showSwap) && (
        <View style={styles.barsSection}>
          {showBar && (
            <View style={styles.barRow}>
              <View style={styles.barHeader}>
                <Text style={styles.sectionLabel}>RAM</Text>
                <Text style={styles.barCaption}>{fmtMB(ram.used)} / {fmtMB(ram.total)}</Text>
              </View>
              <MiniBar value={ram.percent} color={ACCENT} height={6} />
            </View>
          )}
          {showSwap && (
            <View style={styles.barRow}>
              <View style={styles.barHeader}>
                <Text style={styles.sectionLabel}>SWAP / PAGE FILE</Text>
                <Text style={styles.barCaption}>{fmtMB(ram.swapUsed)} / {fmtMB(ram.swapTotal)}</Text>
              </View>
              <MiniBar value={swapPct} color={SWAP_COLOR} height={5} />
            </View>
          )}
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
  barsSection: {
    marginTop: 6,
    gap: 8,
  },
  barRow: {
    gap: 4,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.2,
  },
  barCaption: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: "600",
  },
});
