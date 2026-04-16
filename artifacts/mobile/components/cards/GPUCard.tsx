import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme, tabularNumsVariant } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { GPUInfo } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, MiniBar, StatRow } from "./CardBase";

function fmtMB(mb: number | null) {
  if (mb == null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

const DEFAULT_ORDER = ["usage", "voltage", "wattage", "vramRow", "clockGpu", "clockMem", "vram"];

interface Props {
  gpus: GPUInfo[];
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function GPUCard({ gpus, titleEdit, cardEdit }: Props) {
  const { theme } = useTheme();
  const ACCENT = theme.cardAccents.gpu;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sectionLabel = (s: string) => (theme.titleCase === "upper" ? s.toUpperCase() : s);
  const base = titleEdit?.customTitle ?? "GPU";
  const hidden = cardEdit?.hiddenFields !== undefined
    ? new Set(cardEdit.hiddenFields)
    : new Set(["vramRow"]);
  const order = cardEdit?.fieldOrder ?? DEFAULT_ORDER;
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;

  if (!gpus || gpus.length === 0) {
    return (
      <CardBase
        icon="monitor"
        title={base}
        accentColor={ACCENT}
        titleEditable={titleEdit?.editable}
        titleDraft={titleEdit?.draft}
        onTitleChange={titleEdit?.onChange}
        onTitleSubmit={titleEdit?.onSubmit}
        onTitlePress={titleEdit?.onTitlePress}
        rightAction={titleEdit?.rightAction}
        style={titleEdit?.borderStyle}
        editPanel={cardEdit?.editPanel}
        extraTemps={cardEdit?.extraTemps}
      >
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
        const isFirst = idx === 0;
        const gpuTitle = gpus.length > 1 ? `${base} ${idx}` : base;
        const visibleOrder = order.filter(k => !hidden.has(k));
        const showHero = !hidden.has("usage") && gpu.usage != null;
        const showVram = !hidden.has("vram") && vramPct != null;
        const rightFields = visibleOrder.filter(k => k !== "usage" && k !== "vram");

        function renderRightField(key: string): React.ReactNode {
          if (extraMap[key] !== undefined && key !== "vram") {
            return <StatRow key={key} label={getLabel(key, key)} value={extraMap[key]} />;
          }
          switch (key) {
            case "voltage":
              return <StatRow key={key} label={getLabel("voltage", "Voltage")} value={gpu.voltage != null ? `${gpu.voltage.toFixed(3)} V` : "—"} color={ACCENT} />;
            case "wattage":
              return <StatRow key={key} label={getLabel("wattage", "Power")} value={gpu.power != null ? `${Math.round(gpu.power)} W` : "—"} />;
            case "vramRow":
              return (
                <StatRow key={key} label={getLabel("vramRow", "VRAM")} value={`${fmtMB(gpu.vramUsed)} / ${fmtMB(gpu.vramTotal)}`} color={ACCENT} />
              );
            case "clockGpu":
              return gpu.clockGpu != null ? (
                <StatRow key={key} label={getLabel("clockGpu", "GPU Clock")} value={`${gpu.clockGpu} MHz`} />
              ) : null;
            case "clockMem":
              return gpu.clockMem != null ? (
                <StatRow key={key} label={getLabel("clockMem", "Mem Clock")} value={`${gpu.clockMem} MHz`} />
              ) : null;
            default: {
              const val = extraMap[key];
              return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
            }
          }
        }

        return (
          <CardBase
            key={idx}
            icon="monitor"
            title={gpuTitle}
            subtitle={gpu.name}
            accentColor={ACCENT}
            temperature={gpu.temperature ?? null}
            extraTemps={isFirst ? cardEdit?.extraTemps : undefined}
            titleEditable={isFirst ? titleEdit?.editable : false}
            titleDraft={isFirst ? titleEdit?.draft : undefined}
            onTitleChange={isFirst ? titleEdit?.onChange : undefined}
            onTitleSubmit={isFirst ? titleEdit?.onSubmit : undefined}
            onTitlePress={isFirst ? titleEdit?.onTitlePress : undefined}
            rightAction={isFirst ? titleEdit?.rightAction : undefined}
            style={isFirst ? titleEdit?.borderStyle : undefined}
            editPanel={isFirst ? cardEdit?.editPanel : undefined}
          >
            {showHero ? (
              <View style={styles.heroRow}>
                <View style={styles.heroLeft}>
                  <Text style={[styles.bigNum, { color: ACCENT }]}>{Math.round(gpu.usage!)}
                    <Text style={styles.bigUnit}>%</Text>
                  </Text>
                  <Text style={styles.bigLabel}>{sectionLabel(getLabel("usage", "GPU Load"))}</Text>
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
            {showVram && (
              <View style={styles.barSection}>
                <View style={styles.barHeader}>
                  <Text style={styles.sectionLabel}>{sectionLabel("VRAM")}</Text>
                  <Text style={styles.barCaption}>
                    {fmtMB(gpu.vramUsed)} / {fmtMB(gpu.vramTotal)}
                  </Text>
                </View>
                <MiniBar value={vramPct!} color={ACCENT} height={5} />
              </View>
            )}
          </CardBase>
        );
      })}
    </>
  );
}

const createStyles = (t: Theme) => {
  const C = t.colors;
  const fontVariant = tabularNumsVariant(t);
  return StyleSheet.create({
    heroRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
    heroLeft: { alignItems: "center", justifyContent: "flex-start", minWidth: 60, paddingTop: 0 },
    heroRight: { flex: 1, gap: 6 },
    bigNum: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -1.5,
      fontVariant,
      lineHeight: 36,
    },
    bigUnit: { fontSize: 16, fontWeight: "600" },
    bigLabel: {
      fontSize: 9,
      color: C.textMuted,
      fontWeight: "700",
      marginTop: 2,
      letterSpacing: t.sectionLabelLetterSpacing,
    },
    fieldList: { gap: 6 },
    barSection: { gap: 4, marginTop: 2 },
    barHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: C.textMuted,
      letterSpacing: t.sectionLabelLetterSpacing,
    },
    barCaption: {
      fontSize: 10,
      color: C.textSecondary,
      fontWeight: "600",
      fontVariant,
    },
    empty: {
      fontSize: 12,
      color: C.textMuted,
      textAlign: "center",
      paddingVertical: 8,
    },
  });
};
