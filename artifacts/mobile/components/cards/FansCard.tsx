import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { FanInfo } from "@/context/PcsContext";
import { CardBase } from "./CardBase";

const C = Colors.light;
const ACCENT = "#FB923C";

function rpmColor(rpm: number) {
  if (rpm > 2500) return "#FF4444";
  if (rpm > 1500) return "#FFB800";
  return "#00CC88";
}

function rpmBar(rpm: number, max = 3000) {
  return Math.min(100, (rpm / max) * 100);
}

interface DiagResult {
  status: string;
  error_code?: number;
  detail?: string;
  sig_hex?: string;
  num_readings?: number;
  size_reading?: number;
  temp_fan_samples?: { idx: number; type: string; orig: string; user: string; value: number }[];
  error?: string;
  trace?: string;
}

interface Props {
  fans: FanInfo[];
  baseUrl?: string;
  apiKey?: string;
}

export function FansCard({ fans, baseUrl, apiKey }: Props) {
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);

  async function runDiagnosis() {
    if (!baseUrl) return;
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers["X-API-Key"] = apiKey;
      const res = await fetch(`${baseUrl}/hwinfo_debug`, { headers });
      const json = await res.json();
      setDiagResult(json);
    } catch (e: any) {
      setDiagResult({ status: "fetch_error", error: e?.message ?? String(e) });
    } finally {
      setDiagLoading(false);
    }
  }

  function renderDiag() {
    if (!diagResult) return null;
    const { status } = diagResult;

    if (status === "no_shared_memory") {
      return (
        <View style={styles.diagBox}>
          <Text style={styles.diagFail}>Shared memory not found (err {diagResult.error_code})</Text>
          <Text style={styles.diagText}>
            HWiNFO64 is not writing to shared memory yet.{"\n\n"}
            Fix: Close HWiNFO64 completely (check system tray), then reopen it. Shared Memory Support must be enabled BEFORE HWiNFO64 starts.
          </Text>
        </View>
      );
    }
    if (status === "bad_signature") {
      return (
        <View style={styles.diagBox}>
          <Text style={styles.diagFail}>Unknown signature: {diagResult.sig_hex}</Text>
          <Text style={styles.diagText}>{diagResult.detail}</Text>
        </View>
      );
    }
    if (status === "ok") {
      const samples = diagResult.temp_fan_samples ?? [];
      const temps = samples.filter((s) => s.type === "temp");
      const fans2 = samples.filter((s) => s.type === "fan");
      const labelsLookGarbled = temps.slice(0, 3).some(
        (t) => !t.orig || /[\u4e00-\u9fff]/.test(t.orig)
      );
      return (
        <View style={styles.diagBox}>
          <Text style={styles.diagOk}>
            Shared memory OK — {diagResult.num_readings} readings, {temps.length} temps, {fans2.length} fans
          </Text>
          <Text style={styles.diagSection}>
            Format: size_reading={diagResult.size_reading}, lbl={diagResult.lbl_bytes_used}B, val@+{diagResult.val_off_base}
          </Text>
          {diagResult.first_element_hex && (
            <Text style={[styles.diagRow, { fontSize: 10 }]} numberOfLines={2}>
              hex: {diagResult.first_element_hex}
            </Text>
          )}
          {temps.length > 0 && (
            <>
              <Text style={styles.diagSection}>Sample temps:</Text>
              {temps.slice(0, 5).map((t, i) => (
                <Text key={i} style={styles.diagRow}>
                  {t.orig || t.user || "?"}: {t.value?.toFixed(1)}°C
                </Text>
              ))}
            </>
          )}
          {fans2.length > 0 && (
            <>
              <Text style={styles.diagSection}>Sample fans:</Text>
              {fans2.slice(0, 5).map((f, i) => (
                <Text key={i} style={styles.diagRow}>
                  {f.orig || f.user || "?"}: {f.value?.toFixed(0)} RPM
                </Text>
              ))}
            </>
          )}
          {samples.length === 0 && (
            <Text style={styles.diagText}>No temp/fan readings found in shared memory.</Text>
          )}
          {labelsLookGarbled ? (
            <Text style={[styles.diagText, { marginTop: 6, color: "#FFB800" }]}>
              Labels still look garbled. Copy latest pc_agent.py from Agent Setup tab and restart the agent.
            </Text>
          ) : (
            <Text style={[styles.diagText, { marginTop: 6 }]}>
              If labels look correct but the app still shows nothing, copy the latest agent from Agent Setup and restart.
            </Text>
          )}
        </View>
      );
    }
    if (status === "fetch_error" || status === "exception") {
      return (
        <View style={styles.diagBox}>
          <Text style={styles.diagFail}>Error: {diagResult.error}</Text>
          <Text style={styles.diagText}>Make sure you copied the LATEST pc_agent.py from Agent Setup and restarted it.</Text>
        </View>
      );
    }
    return (
      <View style={styles.diagBox}>
        <Text style={styles.diagText}>Status: {status}</Text>
        {diagResult.detail && <Text style={styles.diagText}>{diagResult.detail}</Text>}
      </View>
    );
  }

  return (
    <CardBase
      icon="wind"
      title="Fans"
      subtitle={fans.length > 0 ? `${fans.length} fan${fans.length > 1 ? "s" : ""} detected` : undefined}
      accentColor={ACCENT}
    >
      {fans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyRow}>
            <Feather name="info" size={13} color={C.warning} />
            <Text style={styles.emptyTitle}>No fan sensors detected</Text>
          </View>
          <Text style={styles.emptyText}>
            To get fan speeds and CPU temps on Windows, enable{" "}
            <Text style={styles.emptyCode}>Shared Memory Support</Text> in HWiNFO64:
          </Text>
          <View style={styles.steps}>
            {[
              "Open HWiNFO64 and click Settings",
              "Go to the HWiNFO64 tab",
              'Check "Shared Memory Support"',
              "Click OK, then CLOSE and REOPEN HWiNFO64",
              "Restart pc_agent.py",
            ].map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>

          {baseUrl && (
            <View style={styles.diagWrap}>
              <Pressable
                style={({ pressed }) => [styles.diagBtn, pressed && { opacity: 0.7 }]}
                onPress={runDiagnosis}
                disabled={diagLoading}
              >
                {diagLoading ? (
                  <ActivityIndicator size="small" color={ACCENT} />
                ) : (
                  <>
                    <Feather name="cpu" size={13} color={ACCENT} />
                    <Text style={styles.diagBtnText}>Run HWiNFO64 Diagnosis</Text>
                  </>
                )}
              </Pressable>
              {renderDiag()}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.fanList}>
          {fans.map((fan, i) => {
            const color = rpmColor(fan.rpm);
            const pct = rpmBar(fan.rpm);
            return (
              <View key={i} style={styles.fanRow}>
                <View style={styles.fanLeft}>
                  <Feather name="wind" size={12} color={color} />
                  <Text style={styles.fanLabel} numberOfLines={1}>
                    {fan.label}
                  </Text>
                </View>
                <View style={styles.fanRight}>
                  <View style={styles.fanBarTrack}>
                    <View
                      style={[
                        styles.fanBarFill,
                        { width: `${pct}%` as any, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.fanRpm, { color }]}>
                    {fan.rpm.toLocaleString()} RPM
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </CardBase>
  );
}

const styles = StyleSheet.create({
  fanList: { gap: 10 },
  fanRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fanLeft: { flexDirection: "row", alignItems: "center", gap: 6, width: 110, flexShrink: 0 },
  fanLabel: { fontSize: 12, color: C.textSecondary, fontWeight: "500", flex: 1 },
  fanRight: { flex: 1, gap: 4 },
  fanBarTrack: { height: 5, backgroundColor: C.backgroundTertiary, borderRadius: 3, overflow: "hidden" },
  fanBarFill: { height: 5, borderRadius: 3 },
  fanRpm: { fontSize: 11, fontWeight: "700" },
  emptyWrap: { gap: 8 },
  emptyRow: { flexDirection: "row", gap: 7, alignItems: "center" },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: C.warning },
  emptyText: { fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  emptyCode: { fontFamily: "Menlo, monospace", color: C.text, fontWeight: "600" },
  steps: { gap: 5, paddingLeft: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT, flexShrink: 0 },
  stepText: { fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  diagWrap: { marginTop: 4, gap: 8 },
  diagBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: ACCENT + "44",
    alignSelf: "flex-start",
    minHeight: 36,
    minWidth: 200,
    justifyContent: "center",
  },
  diagBtnText: { fontSize: 13, fontWeight: "600", color: ACCENT },
  diagBox: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  diagOk: { fontSize: 12, fontWeight: "700", color: "#00CC88", marginBottom: 4 },
  diagFail: { fontSize: 12, fontWeight: "700", color: "#FF4444", marginBottom: 4 },
  diagSection: { fontSize: 11, fontWeight: "700", color: C.textSecondary, marginTop: 6 },
  diagRow: { fontSize: 11, color: C.text, fontFamily: "Menlo, monospace" },
  diagText: { fontSize: 11, color: C.textSecondary, lineHeight: 16 },
});
