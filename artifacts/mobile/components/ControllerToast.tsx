import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGamepad } from "@/context/GamepadContext";
import { useColors } from "@/hooks/useColors";

export function ControllerToast() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { controllerConnected, controllerName, controllerKind } = useGamepad();

  const [message, setMessage] = useState<{
    text: string;
    icon: "check-circle" | "alert-circle";
  } | null>(null);

  const opacity = useRef(new Animated.Value(0)).current;
  const lastConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (lastConnected.current === null) {
      lastConnected.current = controllerConnected;
      return;
    }
    if (lastConnected.current === controllerConnected) return;
    lastConnected.current = controllerConnected;

    if (controllerConnected) {
      const label =
        controllerName ?? labelForKind(controllerKind) ?? "Controller";
      setMessage({ text: `${label} ready`, icon: "check-circle" });
    } else {
      setMessage({ text: "Controller disconnected", icon: "alert-circle" });
    }
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.delay(2400),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]).start(() => setMessage(null));
  }, [controllerConnected, controllerName, controllerKind, opacity]);

  if (!message || Platform.OS !== "ios") return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity,
          top: insets.top + 8,
          backgroundColor: colors.card,
          borderColor: controllerConnected ? colors.green : colors.border,
        },
      ]}
    >
      <Feather
        name={message.icon}
        size={14}
        color={controllerConnected ? colors.green : colors.mutedForeground}
      />
      <Text style={[styles.text, { color: colors.foreground }]}>
        {message.text}
      </Text>
    </Animated.View>
  );
}

function labelForKind(kind: string | null): string | null {
  switch (kind) {
    case "xbox": return "Xbox controller";
    case "playstation": return "DualSense";
    case "mfi": return "MFi controller";
    default: return null;
  }
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 1000,
    elevation: 10,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
});
