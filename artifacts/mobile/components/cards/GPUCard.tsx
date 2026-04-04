import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { GPUInfo } from "@/context/PcsContext";
import { BuiltinCardEdit, CardBase, CardTitleEditConfig, MiniBar, StatRow } from "./CardBase";

const C = Colors.light;
const ACCENT = "#34D399";

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
          switch (key) {
            case "voltage":
              return <StatRow key={key} label={getLabel("voltage", "GPU voltage")} value={gpu.voltage != null ? `${gpu.voltage.toFixed(3)} V` : "—"} color={ACCENT} />;
            case "wattage":
              return <StatRow key={key} label={getLabel("wattage", "GPU power")} value={gpu.power != null ? `${Math.round(gpu.power)} W` : "—"} />;
            case "vramRow":
              return (
                <StatRow key={key} label={getLabel("vramRow", "VRAM used")} value={`${fmtMB(gpu.vramUsed)} / ${fmtMB(gpu.vramTotal)}`} color={ACCENT} />
              );
            case "clockGpu":
              return gpu.clockGpu != null ? (
                <StatRow key={key} label={getLabel("clockGpu", "GPU clock")} value={`${gpu.clockGpu} MHz`} />
              ) : null;
            case "clockMem":
              return gpu.clockMem != null ? (
                <StatRow key={key} label={getLabel("clockMem", "Mem clock")} value={`${gpu.clockMem} MHz`} />
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
                  <Text style={[styles.bigNum, { color: ACCENT }]}>{Math.round(gpu.usage!)}%</Text>
                  <Text style={styles.bigLabel}>{getLabel("usage", "GPU Load")}</Text>
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
                  <Text style={styles.sectionLabel}>VRAM</Text>
                  <Text style={styles.barCaption}>
                    {fmtMB(gpu.vramUsed)} / {fmtMB(gpu.vramTotal)}
                  </Text>
                </View>
                <MiniBar value={vramPct!} color={ACCENT} height={6} />
              </View>
            )}
          </CardBase>
        );
      })}
    </>
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
  barSection: {
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
  barPct: {
    fontSize: 11,
    fontWeight: "700",
  },
  barCaption: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: "600",
  },
  empty: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
});
