import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddPcSheet } from "@/components/AddPcSheet";
import { PCCard } from "@/components/PCCard";
import { Theme } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { DEMO_PC_HOST, DEMO_PC_ID, usePcs } from "@/context/PcsContext";

export default function HomeScreen() {
  const { theme } = useTheme();
  const C = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { pcs, refreshAll, addDemoMode } = usePcs();
  const [addVisible, setAddVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const numCols = isWide ? 2 : 1;

  const isDemoAdded = pcs.some((p) => p.host === DEMO_PC_HOST);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshAll();
    setRefreshing(false);
  };

  const handleDemo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isDemoAdded) addDemoMode();
    router.push(`/pc/${DEMO_PC_ID}`);
  };

  const onlineCount = pcs.filter((p) => p.status === "online").length;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My PCs</Text>
          <Text style={styles.subtitle}>
            {pcs.length === 0
              ? "No computers added"
              : `${onlineCount}/${pcs.length} online`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAddVisible(true);
          }}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        key={numCols}
        data={pcs}
        keyExtractor={(item) => item.id}
        numColumns={numCols}
        columnWrapperStyle={isWide ? styles.columnWrapper : undefined}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 100 + bottomPad },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.tint}
            colors={[C.tint]}
          />
        }
        renderItem={({ item }) => (
          <View style={isWide ? styles.pcCardWrapper : undefined}>
            <PCCard pc={item} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="monitor" size={48} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No PCs added yet</Text>
            <Text style={styles.emptyText}>
              Tap the + button to add a computer.{"\n"}
              Install the PC Agent on any machine you want to monitor.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => setAddVisible(true)}
            >
              <Text style={styles.emptyBtnText}>Add your first PC</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.82 }]}
              onPress={handleDemo}
            >
              <View style={styles.demoBtnIcon}>
                <Feather name="play-circle" size={20} color="#FF6D00" />
              </View>
              <View style={styles.demoBtnText}>
                <Text style={styles.demoBtnTitle}>Try Demo Mode</Text>
                <Text style={styles.demoBtnSub}>Explore with simulated data — no PC needed</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#FF6D00" />
            </Pressable>
          </View>
        }
      />

      <AddPcSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
      />
    </View>
  );
}

const createStyles = (t: Theme) => {
  const C = t.colors;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      paddingBottom: 8,
    },
    title: { fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: t.buttonRadius,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
    },
    list: { paddingHorizontal: 16, paddingTop: 8 },
    columnWrapper: { gap: 12 },
    pcCardWrapper: { flex: 1 },
    empty: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 20, fontWeight: "700", color: C.text },
    emptyText: { fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 21 },
    emptyBtn: {
      marginTop: 8,
      backgroundColor: C.tint,
      borderRadius: t.buttonRadius,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    emptyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    demoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "rgba(255, 109, 0, 0.08)",
      borderRadius: t.buttonRadius,
      borderWidth: 1.5,
      borderColor: "rgba(255, 109, 0, 0.3)",
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 4,
      width: "100%",
    },
    demoBtnIcon: {
      width: 36,
      height: 36,
      borderRadius: t.buttonRadius,
      backgroundColor: "rgba(255, 109, 0, 0.13)",
      alignItems: "center",
      justifyContent: "center",
    },
    demoBtnText: { flex: 1, gap: 2 },
    demoBtnTitle: { fontSize: 14, fontWeight: "700", color: "#FF6D00" },
    demoBtnSub: { fontSize: 12, color: C.textSecondary, lineHeight: 16 },
  });
};
