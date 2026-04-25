import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";

const RELEASES_BASE =
  "https://github.com/adrianomelnic/pc-monitor-control/releases/latest/download";
const WIN_DOWNLOAD_URL = `${RELEASES_BASE}/pc-agent-windows.exe`;
const MAC_DOWNLOAD_URL = `${RELEASES_BASE}/pc-agent-macos`;
const RELEASES_PAGE_URL =
  "https://github.com/adrianomelnic/pc-monitor-control/releases/latest";
const REPO_URL = "https://github.com/adrianomelnic/pc-monitor-control";

type OsTab = "windows" | "mac";

export default function AgentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const C = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [osTab, setOsTab] = useState<OsTab>(Platform.OS === "ios" ? "mac" : "windows");
  const [copiedLink, setCopiedLink] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const downloadUrl = osTab === "windows" ? WIN_DOWNLOAD_URL : MAC_DOWNLOAD_URL;
  // Downloaded filenames match the GitHub Release asset names (browsers save
  // by URL basename), so what we tell the user matches what's in their
  // Downloads folder.
  const downloadFilename = osTab === "windows" ? "pc-agent-windows.exe" : "pc-agent-macos";

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Could not open link", msg);
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(downloadUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const STEPS: Array<{
    step: string;
    title: string;
    desc: string;
    note?: string;
  }> = [
    {
      step: "1",
      title: "Download the agent on your PC",
      desc: `Tap the download button below, or open the releases page in a browser on your PC and grab the file for your OS. There's no installer — just one file.`,
    },
    {
      step: "2",
      title: `Double-click ${downloadFilename}`,
      desc:
        osTab === "windows"
          ? "A terminal window will open and Windows will ask permission to open a firewall port — click Yes. Leave the terminal window open while you use the app."
          : "A terminal window will open and the agent starts listening on port 8765. Leave the window open while you use the app.",
      note:
        osTab === "windows"
          ? "First time only: Windows SmartScreen may say \u201CWindows protected your PC\u201D. Click \u201CMore info\u201D \u2192 \u201CRun anyway\u201D — the binary isn't code-signed yet."
          : "First time only: macOS may say \u201Ccannot be opened, developer cannot be verified\u201D. Right-click the file in Finder \u2192 \u201COpen\u201D \u2192 confirm — the binary isn't code-signed yet.",
    },
    {
      step: "3",
      title: "Find your PC's IP address",
      desc:
        osTab === "windows"
          ? "Open Settings \u2192 Network & Internet \u2192 your Wi-Fi network \u2192 Properties, and copy the IPv4 address (e.g. 192.168.1.100). Your phone must be on the same Wi-Fi."
          : "Open System Settings \u2192 Network \u2192 your Wi-Fi network \u2192 Details, and copy the IP address (e.g. 192.168.1.100). Your phone must be on the same Wi-Fi.",
    },
    {
      step: "4",
      title: "Add your PC in the app",
      desc:
        "Go to the My PCs tab, tap +, then enter the display name and IP address. Port 8765 is filled in for you.",
    },
  ];

  return (
    <ScrollView
      style={[styles.root, { paddingTop: topPad }]}
      contentContainerStyle={{ paddingBottom: 100 + bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>PC Agent Setup</Text>
          <Text style={styles.subtitle}>
            Download, double-click, pair. No Python required.
          </Text>
        </View>
      </View>

      <View style={styles.downloadSection}>
        <View style={styles.downloadHeader}>
          <Feather name="download" size={15} color={C.tint} />
          <Text style={styles.downloadTitle}>Download the agent</Text>
        </View>

        <View style={styles.osTabRow}>
          {(["windows", "mac"] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.osTab, osTab === tab && styles.osTabActive]}
              onPress={() => setOsTab(tab)}
            >
              <Text style={[styles.osTabText, osTab === tab && styles.osTabTextActive]}>
                {tab === "windows" ? "Windows" : "macOS"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.bigDownloadBtn, pressed && { opacity: 0.85 }]}
          onPress={() => openUrl(downloadUrl)}
        >
          <Feather name="download" size={16} color={C.tintForeground} />
          <Text style={styles.bigDownloadBtnText}>
            Download {downloadFilename}
          </Text>
        </Pressable>

        <View style={styles.urlRow}>
          <Feather name="link" size={12} color={C.textSecondary} />
          <Text style={styles.urlText} numberOfLines={1}>{downloadUrl}</Text>
          <Pressable
            style={({ pressed }) => [styles.urlCopyBtn, pressed && { opacity: 0.7 }]}
            onPress={copyLink}
          >
            <Text style={styles.urlCopyText}>{copiedLink ? "Copied!" : "Copy"}</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.releasePageBtn, pressed && { opacity: 0.7 }]}
          onPress={() => openUrl(RELEASES_PAGE_URL)}
        >
          <Feather name="external-link" size={13} color={C.textSecondary} />
          <Text style={styles.releasePageText}>See all releases on GitHub</Text>
        </Pressable>
      </View>

      {STEPS.map((s) => (
        <View key={s.step} style={styles.step}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{s.step}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepDesc}>{s.desc}</Text>
            {s.note && (
              <View style={styles.noteBox}>
                <Feather name="info" size={12} color={C.warning} />
                <Text style={styles.noteText}>{s.note}</Text>
              </View>
            )}
          </View>
        </View>
      ))}

      <View style={styles.tipBox}>
        <Feather name="shield" size={14} color={C.tint} />
        <Text style={styles.tipText}>
          For an API key: set the <Text style={styles.tipCode}>PC_AGENT_KEY</Text> environment
          variable on the PC before running the agent, then enter the same key in the app's
          Add PC sheet.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.repoBtn, pressed && { opacity: 0.7 }]}
        onPress={() => openUrl(REPO_URL)}
      >
        <Feather name="github" size={13} color={C.textSecondary} />
        <Text style={styles.repoBtnText}>Source code on GitHub</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) => {
  const C = theme.colors;
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.buttonRadius,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 4,
  },
  downloadSection: {
    backgroundColor: C.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
    marginBottom: 20,
  },
  downloadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  downloadTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  osTabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  osTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.backgroundTertiary,
  },
  osTabActive: {
    backgroundColor: C.tint,
  },
  osTabText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  osTabTextActive: {
    color: C.tintForeground,
  },
  bigDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: C.tint,
    borderRadius: theme.buttonRadius,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  bigDownloadBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: C.tintForeground,
    letterSpacing: 0.3,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
  },
  urlText: {
    flex: 1,
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  urlCopyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: C.backgroundTertiary,
  },
  urlCopyText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.tint,
  },
  releasePageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  releasePageText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
    letterSpacing: 0.3,
  },
  step: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: C.tintForeground,
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  stepDesc: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
  },
  tipBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(0, 212, 255, 0.07)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 255, 0.2)",
    padding: 14,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
  tipCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: C.tint,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255, 184, 0, 0.08)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.25)",
    padding: 10,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: C.warning,
    lineHeight: 17,
  },
  repoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  repoBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
    letterSpacing: 0.3,
  },
  });
};
