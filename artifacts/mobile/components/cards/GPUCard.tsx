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

const DEFAULT_ORDER = ["usage", "vramRow", "clockGpu", "clockMem", "vram"];

interface Props {
  gpus: GPUInfo[];
  titleEdit?: CardTitleEditConfig;
  cardEdit?: BuiltinCardEdit;
}

export function GPUCard({ gpus, titleEdit, cardEdit }: Props) {
  const base = titleEdit?.customTitle ?? "GPU";
  const hidden = new Set(cardEdit?.hiddenFields ?? []);
  const order = cardEdit?.fieldOrder ?? DEFAULT_ORDER;
  const extraMap = cardEdit?.extraSensorMap ?? {};
  const aliases = cardEdit?.fieldAliases ?? {};
  const getLabel = (key: string, def: string) => aliases[key] ?? def;

  const extraKeys = order.filter(k =>
    !["usage", "vramRow", "clockGpu", "clockMem", "vram"].includes(k) && !hidden.has(k)
  );

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
        {extraKeys.length > 0 && (
          <View style={styles.fieldList}>
            {extraKeys.map(key => {
              const val = extraMap[key];
              return val ? <StatRow key={key} label={getLabel(key, key)} value={val} /> : null;
            })}
          </View>
        )}
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

        function renderField(key: string): React.ReactNode {
          switch (key) {
            case "usage":
              return gpu.usage != null ? (
                <View key={key} style={styles.usageBadge}>
                  <Text style={[styles.bigNum, { color: ACCENT }]}>{Math.round(gpu.usage)}%</Text>
                  <Text style={styles.bigLabel}>{getLabel("usage", "GPU Load")}</Text>
                </View>
              ) : null;
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
            case "vram":
              return vramPct != null ? (
                <View key={key} style={styles.vramSection}>
                  <View style={styles.vramHeader}>
                    <Text style={styles.sectionText}>VRAM</Text>
                    <Text style={[styles.vramPct, { color: vramPct > 85 ? "#FF4444" : ACCENT }]}>
                      {Math.round(vramPct)}%
                    </Text>
                  </View>
                  <MiniBar value={vramPct} color={ACCENT} height={6} />
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
            <View style={styles.fieldList}>
              {visibleOrder.map(key => renderField(key))}
            </View>
          </CardBase>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  fieldList: {
    gap: 6,
  },
  usageBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingBottom: 2,
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
    color: C.textMuted,
    letterSpacing: 1.2,
  },
  vramPct: {
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
});
