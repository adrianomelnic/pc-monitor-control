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

  const bgColor =
    result === "success" ? C.success + "18" :
    result === "error" ? C.danger + "18" :
    C.backgroundTertiary;
  const borderColor =
    result === "success" ? C.success + "50" :
    result === "error" ? C.danger + "50" :
    C.cardBorder;
  const fgColor =
    result === "success" ? C.success :
    result === "error" ? C.danger :
    C.text;

  return (
    <Pressable
      onPress={handle}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bgColor, borderColor },
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={C.tint} />
      ) : result === "success" ? (
        <Feather name="check" size={15} color={C.success} />
      ) : result === "error" ? (
        <Feather name="x" size={15} color={C.danger} />
      ) : (
        <Feather name={icon} size={15} color={C.tint} />
      )}
      <Text style={[styles.label, { color: fgColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
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
