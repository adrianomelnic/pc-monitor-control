import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Theme } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { usePcs } from "@/context/PcsContext";

interface AddPcSheetProps {
  visible: boolean;
  onClose: () => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; pcName: string; os: string }
  | { kind: "err"; message: string; detail: string };

function friendlyError(e: unknown): { message: string; detail: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const low = msg.toLowerCase();
  if (low.includes("aborted") || low.includes("timeout") || (e instanceof Error && e.name === "AbortError")) {
    return {
      message: "Connection timed out",
      detail:
        "The PC did not respond in 8 seconds. Check that:\n• The PC Agent is running (python pc_agent.py)\n• The IP address is correct\n• Port 8765 is allowed through Windows Firewall\n• Phone and PC are on the same Wi-Fi",
    };
  }
  if (low.includes("network request failed") || low.includes("econnrefused") || low.includes("refused")) {
    return {
      message: "Connection refused",
      detail:
        "The PC is reachable but nothing is listening on that port. Make sure the PC Agent is running:\npython pc_agent.py",
    };
  }
  if (low.includes("instant")) {
    return {
      message: "Blocked instantly",
      detail:
        "The request was blocked before it left the device. This is usually Android blocking plain HTTP (cleartext) traffic. A fresh APK build with HTTP allowed should fix this.",
    };
  }
  if (low.includes("network")) {
    return {
      message: "Network error",
      detail:
        "Could not reach the PC. Check that the phone and PC are on the same Wi-Fi network and the IP address is correct.",
    };
  }
  return { message: "Connection failed", detail: `Raw error: "${msg}" (name: ${e instanceof Error ? e.name : "n/a"})` };
}

export function AddPcSheet({ visible, onClose }: AddPcSheetProps) {
  const { theme } = useTheme();
  const C = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const fieldLabel = (s: string) => (theme.titleCase === "upper" ? s.toUpperCase() : s);

  const { addPc } = usePcs();
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8765");
  const [apiKey, setApiKey] = useState("");
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  const reset = () => {
    setName("");
    setHost("");
    setPort("8765");
    setApiKey("");
    setTestState({ kind: "idle" });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAdd = () => {
    if (!name.trim() || !host.trim()) return;
    addPc({
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || 8765,
      apiKey: apiKey.trim() || undefined,
    });
    reset();
    onClose();
  };

  const handleTest = async () => {
    const h = host.trim();
    const p = parseInt(port) || 8765;
    if (!h) return;
    setTestState({ kind: "testing" });
    const url = `http://${h}:${p}/metrics`;
    try {
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const timer = setTimeout(() => {
          xhr.abort();
          reject(new Error("Timeout"));
        }, 8000);
        xhr.onload = () => {
          clearTimeout(timer);
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error(`Parse error (HTTP ${xhr.status})`)); }
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => {
          clearTimeout(timer);
          reject(new Error(`XHR network error (instant)`));
        };
        xhr.onabort = () => {
          clearTimeout(timer);
          reject(new Error("Timeout"));
        };
        xhr.open("GET", url);
        if (apiKey.trim()) xhr.setRequestHeader("X-API-Key", apiKey.trim());
        xhr.send();
      });
      const pcName: string = data?.metrics?.cpu?.name ?? "Unknown PC";
      const os: string = data?.os ?? "Windows";
      setTestState({ kind: "ok", pcName, os });
    } catch (e: unknown) {
      setTestState({ kind: "err", ...friendlyError(e) });
    }
  };

  const canTest = host.trim().length > 0;
  const canAdd = name.trim().length > 0 && host.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add PC</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Feather name="x" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.hint}>
              Install the PC Agent on your computer, then enter its address below.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{fieldLabel("Display Name")}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Gaming PC, Work Desktop"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{fieldLabel("IP Address / Hostname")}</Text>
              <TextInput
                style={styles.input}
                value={host}
                onChangeText={(t) => {
                  setHost(t);
                  setTestState({ kind: "idle" });
                }}
                placeholder="192.168.1.100"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{fieldLabel("Port")}</Text>
                <TextInput
                  style={styles.input}
                  value={port}
                  onChangeText={(t) => {
                    setPort(t);
                    setTestState({ kind: "idle" });
                  }}
                  placeholder="8765"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.testBtnWrapper}>
                <Pressable
                  style={[styles.testBtn, !canTest && styles.testBtnDisabled]}
                  onPress={handleTest}
                  disabled={!canTest || testState.kind === "testing"}
                >
                  {testState.kind === "testing" ? (
                    <ActivityIndicator size="small" color={C.tint} />
                  ) : (
                    <Feather
                      name="wifi"
                      size={15}
                      color={canTest ? C.tint : C.textMuted}
                    />
                  )}
                  <Text
                    style={[
                      styles.testBtnText,
                      !canTest && styles.testBtnTextDisabled,
                    ]}
                  >
                    {testState.kind === "testing" ? "Testing…" : "Test"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {testState.kind === "ok" && (
              <View style={[styles.resultBox, styles.resultOk]}>
                <Feather name="check-circle" size={15} color={C.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultOkText}>Connected successfully</Text>
                  <Text style={styles.resultOkSub}>
                    {testState.pcName} · {testState.os}
                  </Text>
                </View>
              </View>
            )}
            {testState.kind === "err" && (
              <View style={[styles.resultBox, styles.resultErr]}>
                <Feather name="alert-circle" size={15} color={C.danger} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultErrTitle}>{testState.message}</Text>
                  <Text style={styles.resultErrDetail}>{testState.detail}</Text>
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{fieldLabel("API Key (Optional)")}</Text>
              <TextInput
                style={styles.input}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Leave blank if not set"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                secureTextEntry
              />
            </View>

            <View style={styles.setupBox}>
              <Feather name="terminal" size={14} color={C.tint} />
              <Text style={styles.setupText}>
                Run the PC Agent on your computer:{"\n"}
                <Text style={styles.setupCode}>python pc_agent.py</Text>
              </Text>
            </View>
          </ScrollView>

          <Pressable
            style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!canAdd}
          >
            <Text style={styles.addBtnText}>Add PC</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (t: Theme) => {
  const C = t.colors;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    sheetWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      backgroundColor: C.backgroundSecondary,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 2,
      borderTopColor: C.tint,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      paddingTop: 12,
      maxHeight: "90%",
    },
    handle: {
      width: 36,
      height: 3,
      backgroundColor: C.textMuted,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: C.text,
    },
    hint: {
      fontSize: 13,
      color: C.textSecondary,
      marginBottom: 20,
      lineHeight: 19,
    },
    fieldGroup: {
      marginBottom: 16,
    },
    fieldRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-end",
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: C.textSecondary,
      letterSpacing: t.sectionLabelLetterSpacing,
      marginBottom: 6,
    },
    input: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.cardBorder,
      borderRadius: t.buttonRadius,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: C.text,
      fontSize: 15,
    },
    testBtnWrapper: {
      paddingBottom: 1,
    },
    testBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: C.tint + "15",
      borderWidth: 1,
      borderColor: C.tint + "40",
      borderRadius: t.buttonRadius,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    testBtnDisabled: {
      backgroundColor: C.card,
      borderColor: C.cardBorder,
    },
    testBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.tint,
    },
    testBtnTextDisabled: {
      color: C.textMuted,
    },
    resultBox: {
      flexDirection: "row",
      gap: 10,
      borderRadius: t.buttonRadius,
      borderWidth: 1,
      padding: 12,
      marginBottom: 16,
      alignItems: "flex-start",
    },
    resultOk: {
      backgroundColor: C.success + "14",
      borderColor: C.success + "4D",
    },
    resultOkText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.success,
    },
    resultOkSub: {
      fontSize: 12,
      color: C.textSecondary,
      marginTop: 2,
    },
    resultErr: {
      backgroundColor: C.danger + "14",
      borderColor: C.danger + "4D",
    },
    resultErrTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: C.danger,
      marginBottom: 4,
    },
    resultErrDetail: {
      fontSize: 12,
      color: C.textSecondary,
      lineHeight: 18,
    },
    setupBox: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: C.tint + "0D",
      borderRadius: t.buttonRadius,
      borderWidth: 1,
      borderColor: C.tint + "25",
      padding: 14,
      marginBottom: 20,
      alignItems: "flex-start",
    },
    setupText: {
      flex: 1,
      fontSize: 12,
      color: C.textSecondary,
      lineHeight: 18,
    },
    setupCode: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: C.tint,
    },
    addBtn: {
      backgroundColor: C.tint,
      borderRadius: t.buttonRadius,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    addBtnDisabled: {
      opacity: 0.4,
    },
    addBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
  });
};
