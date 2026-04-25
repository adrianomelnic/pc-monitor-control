import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Theme } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { usePcs } from "@/context/PcsContext";

const INSTALL_PS1_URL =
  "https://raw.githubusercontent.com/adrianomelnic/pc-monitor-control/main/scripts/install.ps1";
const INSTALL_SH_URL =
  "https://raw.githubusercontent.com/adrianomelnic/pc-monitor-control/main/scripts/install.sh";
const WIN_CMD = `powershell -c "irm ${INSTALL_PS1_URL} | iex"`;
const MAC_CMD = `curl -fsSL ${INSTALL_SH_URL} | bash`;

interface AddPcSheetProps {
  visible: boolean;
  onClose: () => void;
}

type WizardStep = "install" | "connect";
type OsTab = "windows" | "mac";

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
  const [step, setStep] = useState<WizardStep>("install");
  // Default OS tab: macOS only on iOS, otherwise Windows.
  const [osTab, setOsTab] = useState<OsTab>(Platform.OS === "ios" ? "mac" : "windows");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8765");
  const [apiKey, setApiKey] = useState("");
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });
  const [sending, setSending] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (visible) {
      // Always start the wizard at step 1 when re-opened.
      setStep("install");
    }
  }, [visible]);

  const installCmd = osTab === "windows" ? WIN_CMD : MAC_CMD;
  const installUrl = osTab === "windows" ? INSTALL_PS1_URL : INSTALL_SH_URL;

  const reset = () => {
    setStep("install");
    setOsTab(Platform.OS === "ios" ? "mac" : "windows");
    setName("");
    setHost("");
    setPort("8765");
    setApiKey("");
    setTestState({ kind: "idle" });
    setSending(false);
    setCopiedCmd(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSendCommand = async () => {
    if (sending) return;
    setSending(true);
    try {
      await Share.share({
        message: installCmd,
        title: "PC Monitor Agent installer",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Could not open share sheet", msg);
    } finally {
      setSending(false);
    }
  };

  const handleCopyCommand = async () => {
    await Clipboard.setStringAsync(installCmd);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
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

  const renderInstallStep = () => (
    <>
      <Text style={styles.hint}>
        Run one command on your PC. It downloads the agent, installs the
        Python dependencies, and starts it for you.
      </Text>

      <View style={styles.osTabRow}>
        {(["windows", "mac"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.osTab, osTab === tab && styles.osTabActive]}
            onPress={() => setOsTab(tab)}
          >
            <Feather
              name={tab === "windows" ? "monitor" : "command"}
              size={13}
              color={osTab === tab ? C.tintForeground : C.textSecondary}
            />
            <Text style={[styles.osTabText, osTab === tab && styles.osTabTextActive]}>
              {tab === "windows" ? "Windows" : "macOS / Linux"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.cmdBox}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={styles.cmdText}>{installCmd}</Text>
        </ScrollView>
      </View>

      <Pressable
        style={[styles.primaryBtn, sending && styles.primaryBtnBusy]}
        onPress={handleSendCommand}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator size="small" color={C.tintForeground} />
        ) : (
          <Feather name="send" size={15} color={C.tintForeground} />
        )}
        <Text style={styles.primaryBtnText}>
          {sending ? "Opening share sheet…" : "Send to my PC"}
        </Text>
      </Pressable>
      <Text style={styles.primaryHint}>
        Share via AirDrop, Mail, or Messages — open it on your PC and paste
        into {osTab === "windows" ? "PowerShell" : "Terminal"}.
      </Text>

      <View style={styles.qrCard}>
        <View style={styles.qrHeader}>
          <Feather name="maximize" size={13} color={C.textSecondary} />
          <Text style={styles.qrTitle}>{fieldLabel("Or scan with your PC's camera")}</Text>
        </View>
        <View style={styles.qrWrap}>
          <View style={styles.qrCanvas}>
            <QRCode
              value={installUrl}
              size={148}
              color={theme.colors.text}
              backgroundColor={theme.colors.card}
            />
          </View>
        </View>
        <Text style={styles.qrHint}>
          {osTab === "windows"
            ? "Windows 11: open the Camera app and point it at this code."
            : "macOS: aim Continuity Camera or your iPhone camera at this code."}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.copyRow, pressed && { opacity: 0.7 }]}
        onPress={handleCopyCommand}
      >
        <Feather
          name={copiedCmd ? "check" : "copy"}
          size={14}
          color={copiedCmd ? C.success : C.tint}
        />
        <Text style={[styles.copyRowText, copiedCmd && { color: C.success }]}>
          {copiedCmd ? "Copied to clipboard" : "Copy command instead"}
        </Text>
      </Pressable>

      <View style={styles.stepFooter}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => setStep("connect")}
        >
          <Text style={styles.primaryBtnText}>I&apos;ve installed it</Text>
          <Feather name="arrow-right" size={15} color={C.tintForeground} />
        </Pressable>
        <Pressable
          onPress={() => setStep("connect")}
          hitSlop={8}
          style={styles.skipBtn}
        >
          <Text style={styles.skipBtnText}>Skip — I already have it running</Text>
        </Pressable>
      </View>
    </>
  );

  const renderConnectStep = () => (
    <>
      <Text style={styles.hint}>
        Now point the app at your running agent. Enter its IP address on
        your local network, then test the connection.
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
    </>
  );

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
            {step === "connect" ? (
              <Pressable
                onPress={() => setStep("install")}
                hitSlop={12}
                style={styles.backInline}
              >
                <Feather name="chevron-left" size={18} color={C.textSecondary} />
                <Text style={styles.backInlineText}>Back</Text>
              </Pressable>
            ) : (
              <View style={{ width: 56 }} />
            )}
            <View style={styles.titleWrap}>
              <Text style={styles.sheetTitle}>
                {step === "install" ? "Get the agent on your PC" : "Connect to your PC"}
              </Text>
              <Text style={styles.stepCounter}>
                Step {step === "install" ? "1" : "2"} of 2
              </Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
              <Feather name="x" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === "install" ? renderInstallStep() : renderConnectStep()}
          </ScrollView>

          {step === "connect" && (
            <Pressable
              style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!canAdd}
            >
              <Text style={styles.addBtnText}>Add PC</Text>
            </Pressable>
          )}
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
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: C.tint,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      paddingTop: 12,
      maxHeight: "92%",
    },
    handle: {
      width: 36,
      height: 4,
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
      gap: 8,
    },
    backInline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      width: 56,
    },
    backInlineText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: C.textSecondary,
    },
    closeBtn: {
      width: 28,
      alignItems: "flex-end",
    },
    titleWrap: {
      flex: 1,
      alignItems: "center",
    },
    sheetTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: C.text,
      letterSpacing: 0.3,
      textAlign: "center",
    },
    stepCounter: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: C.textMuted,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginTop: 2,
    },
    hint: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: C.textSecondary,
      marginBottom: 18,
      lineHeight: 19,
    },
    osTabRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    osTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: t.buttonRadius,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.cardBorder,
    },
    osTabActive: {
      backgroundColor: C.tint,
      borderColor: C.tint,
    },
    osTabText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: C.textSecondary,
    },
    osTabTextActive: {
      color: C.tintForeground,
    },
    cmdBox: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.cardBorder,
      borderRadius: t.buttonRadius,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14,
    },
    cmdText: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
      color: C.tint,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: C.tint,
      borderRadius: t.buttonRadius,
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    primaryBtnBusy: {
      opacity: 0.7,
    },
    primaryBtnText: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: C.tintForeground,
      letterSpacing: 0.3,
    },
    primaryHint: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: C.textMuted,
      lineHeight: 16,
      marginTop: 8,
      marginBottom: 18,
      textAlign: "center",
    },
    qrCard: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.cardBorder,
      borderRadius: t.buttonRadius,
      padding: 14,
      marginBottom: 14,
    },
    qrHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
    },
    qrTitle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: C.textSecondary,
      letterSpacing: 1.5,
    },
    qrWrap: {
      alignItems: "center",
    },
    qrCanvas: {
      backgroundColor: C.card,
      padding: 10,
      borderRadius: 6,
    },
    qrHint: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: C.textMuted,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 12,
    },
    copyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      marginBottom: 18,
    },
    copyRowText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: C.tint,
      letterSpacing: 0.3,
    },
    stepFooter: {
      gap: 10,
      marginBottom: 8,
    },
    skipBtn: {
      alignSelf: "center",
      paddingVertical: 6,
    },
    skipBtnText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: C.textMuted,
      letterSpacing: 0.3,
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
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: C.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 2,
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
      fontFamily: "Inter_600SemiBold",
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
      fontFamily: "Inter_600SemiBold",
      color: C.success,
    },
    resultOkSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: C.textSecondary,
      marginTop: 2,
    },
    resultErr: {
      backgroundColor: C.danger + "14",
      borderColor: C.danger + "4D",
    },
    resultErrTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: C.danger,
      marginBottom: 4,
    },
    resultErrDetail: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: C.textSecondary,
      lineHeight: 18,
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
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: C.tintForeground,
    },
  });
};
