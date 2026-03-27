import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
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
import Colors from "@/constants/colors";
import { usePcs } from "@/context/PcsContext";

interface AddPcSheetProps {
  visible: boolean;
  onClose: () => void;
}

const C = Colors.light;

export function AddPcSheet({ visible, onClose }: AddPcSheetProps) {
  const { addPc } = usePcs();
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8765");
  const [apiKey, setApiKey] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !host.trim()) return;
    addPc({
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || 8765,
      apiKey: apiKey.trim() || undefined,
    });
    setName("");
    setHost("");
    setPort("8765");
    setApiKey("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
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
            <Pressable onPress={onClose} hitSlop={12}>
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
              <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
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
              <Text style={styles.fieldLabel}>IP ADDRESS / HOSTNAME</Text>
              <TextInput
                style={styles.input}
                value={host}
                onChangeText={setHost}
                placeholder="192.168.1.100"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PORT</Text>
              <TextInput
                style={styles.input}
                value={port}
                onChangeText={setPort}
                placeholder="8765"
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>API KEY (OPTIONAL)</Text>
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
            style={[
              styles.addBtn,
              (!name.trim() || !host.trim()) && styles.addBtnDisabled,
            ]}
            onPress={handleAdd}
            disabled={!name.trim() || !host.trim()}
          >
            <Text style={styles.addBtnText}>Add PC</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: C.cardBorder,
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  setupBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(0, 212, 255, 0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 255, 0.2)",
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
    borderRadius: 12,
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
    color: "#000",
  },
});
