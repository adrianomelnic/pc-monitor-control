import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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

  const borderColor =
    result === "success"
      ? C.success
      : result === "error"
      ? C.danger
      : color;

  return (
    <Pressable
      onPress={handle}
      style={({ pressed }) => [styles.btn, { borderColor }, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + "22" }]}>
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : result === "success" ? (
          <Feather name="check" size={20} color={C.success} />
        ) : result === "error" ? (
          <Feather name="x" size={20} color={C.danger} />
        ) : (
          <Feather name={icon} size={20} color={color} />
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flex: 1,
    minWidth: 80,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSecondary,
    textAlign: "center",
  },
});
