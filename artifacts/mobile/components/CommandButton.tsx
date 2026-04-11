import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Colors from "@/constants/colors";

interface CommandButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => Promise<void>;
  color?: string;
  destructive?: boolean;
}

const C = Colors.light;

export function CommandButton({
  icon,
  label,
  onPress,
  color = C.tint,
  destructive = false,
}: CommandButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const handle = async () => {
    if (loading) return;
    Haptics.impactAsync(
      destructive
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium
    );
    setLoading(true);
    setResult(null);
    try {
      await onPress();
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 2000);
    }
  };

  const activeColor =
    result === "success" ? C.success : result === "error" ? C.danger : color;
  const bgColor = result === "error" ? C.danger : C.tint;
  const fgColor = "#000000";

  return (
    <Pressable
      onPress={handle}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bgColor },
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fgColor} />
      ) : result === "success" ? (
        <Feather name="check" size={15} color={fgColor} />
      ) : result === "error" ? (
        <Feather name="x" size={15} color="#fff" />
      ) : (
        <Feather name={icon} size={15} color={fgColor} />
      )}
      <Text style={[styles.label, { color: result === "error" ? "#fff" : fgColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 0,
    borderWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
    backgroundColor: C.tint,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
