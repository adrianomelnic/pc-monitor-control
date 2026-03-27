import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddPcSheet } from "@/components/AddPcSheet";
import { PCCard } from "@/components/PCCard";
import Colors from "@/constants/colors";
import { usePcs } from "@/context/PcsContext";

const C = Colors.light;

export default function HomeScreen() {
  const { pcs, refreshAll } = usePcs();
  const [addVisible, setAddVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshAll();
    setRefreshing(false);
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
          <Feather name="plus" size={20} color="#000" />
        </Pressable>
      </View>

      <FlatList
        data={pcs}
        keyExtractor={(item) => item.id}
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
        renderItem={({ item }) => <PCCard pc={item} />}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: C.tint,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
});
