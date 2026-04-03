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

  function renderField(key: string): React.ReactNode {
    switch (key) {
      case "usage":
        return <StatRow key={key} label="In use" value={`${Math.round(ram.percent)}%`} color={usedColor} />;
      case "used":
        return <StatRow key={key} label="Used" value={fmtMB(ram.used)} color={ACCENT} />;
      case "available":
        return <StatRow key={key} label="Available" value={fmtMB(ram.available)} color="#00CC88" />;
      case "total":
        return <StatRow key={key} label="Total" value={fmtMB(ram.total)} />;
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
        return val ? <StatRow key={key} label={key} value={val} /> : null;
      }
    }
  }

  return (
    <CardBase
      icon="database"
      title={titleEdit?.customTitle ?? "Memory"}
      accentColor={ACCENT}
      temperature={ram.temperature ?? undefined}
      titleEditable={titleEdit?.editable}
      titleDraft={titleEdit?.draft}
      onTitleChange={titleEdit?.onChange}
      onTitleSubmit={titleEdit?.onSubmit}
      onTitlePress={titleEdit?.onTitlePress}
      rightAction={titleEdit?.rightAction}
      style={titleEdit?.borderStyle}
      editPanel={cardEdit?.editPanel}
    >
      <View style={styles.fieldList}>
        {order.filter(k => !hidden.has(k)).map(key => renderField(key))}
      </View>
    </CardBase>
  );
}

const styles = StyleSheet.create({
  fieldList: {
    gap: 5,
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
