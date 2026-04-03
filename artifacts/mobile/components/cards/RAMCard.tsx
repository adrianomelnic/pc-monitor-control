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
const HERO_DETAIL_KEYS = new Set(["used", "available", "total"]);

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
  const heroDetails = showHero ? visibleOrder.filter(k => HERO_DETAIL_KEYS.has(k)) : [];
  const heroSet = new Set(showHero ? ["usage", ...heroDetails] : []);
  const belowFields = visibleOrder.filter(k => !heroSet.has(k));

  function renderHeroDetail(key: string): React.ReactNode {
    switch (key) {
      case "used":
        return (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{getLabel("used", "Used")}</Text>
            <Text style={[styles.detailValue, { color: ACCENT }]}>{fmtMB(ram.used)}</Text>
          </View>
        );
      case "available":
        return (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{getLabel("available", "Available")}</Text>
            <Text style={[styles.detailValue, { color: "#00CC88" }]}>{fmtMB(ram.available)}</Text>
          </View>
        );
      case "total":
        return (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{getLabel("total", "Total")}</Text>
            <Text style={styles.detailValue}>{fmtMB(ram.total)}</Text>
          </View>
        );
      default:
        return null;
    }
  }

  function renderField(key: string): React.ReactNode {
    switch (key) {
      case "usage":
        return <StatRow key={key} label={getLabel("usage", "In use")} value={`${Math.round(ram.percent)}%`} color={usedColor} />;
      case "used":
        return <StatRow key={key} label={getLabel("used", "Used")} value={fmtMB(ram.used)} color={ACCENT} />;
      case "available":
        return <StatRow key={key} label={getLabel("available", "Available")} value={fmtMB(ram.available)} color="#00CC88" />;
      case "total":
        return <StatRow key={key} label={getLabel("total", "Total")} value={fmtMB(ram.total)} />;
      case "bar":
        return (
          <View key={key} style={styles.barSection}>
            <View style={styles.barHeader}>
              <Text style={styles.sectionText}>RAM</Text>
              <Text style={styles.barCaption}>
                {fmtMB(ram.used)} / {fmtMB(ram.total)}
              </Text>
            </View>
            <MiniBar value={ram.percent} color={ACCENT} height={6} />
          </View>
        );
      case "swap":
        return ram.swapTotal > 0 ? (
          <View key={key} style={styles.barSection}>
            <View style={styles.barHeader}>
              <Text style={styles.sectionText}>SWAP / PAGE FILE</Text>
              <Text style={styles.barCaption}>
                {fmtMB(ram.swapUsed)} / {fmtMB(ram.swapTotal)}
              </Text>
            </View>
            <MiniBar value={swapPct} color={SWAP_COLOR} height={5} />
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
      {showHero && (
        <View style={styles.heroRow}>
          <View style={styles.heroBig}>
            <Text style={[styles.bigNum, { color: usedColor }]}>{Math.round(ram.percent)}%</Text>
            <Text style={styles.bigLabel}>{getLabel("usage", "In use")}</Text>
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
    gap: 5,
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
