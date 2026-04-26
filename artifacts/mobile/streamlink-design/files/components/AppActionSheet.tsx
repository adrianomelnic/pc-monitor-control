import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { Focusable } from "@/components/Focusable";
import { useGamepad, useGamepadBackHandler } from "@/context/GamepadContext";

export type AppActionSheetVariant =
  | "running"      // long-pressed the currently running app
  | "other"        // long-pressed a different app while one is running
  | "idle";        // long-pressed an app when nothing is running

export interface AppActionSheetProps {
  visible: boolean;
  onClose: () => void;
  appTitle: string;
  runningAppTitle?: string;
  variant: AppActionSheetVariant;
  onResumeApp?: () => void;
  onQuitApp?: () => void;
  onResumeRunningApp?: () => void;
  onQuitRunningAndStart?: () => void;
  onHideApp?: () => void;
  onStartApp?: () => void;
}

export function AppActionSheet({
  visible,
  onClose,
  appTitle,
  runningAppTitle,
  variant,
  onResumeApp,
  onQuitApp,
  onResumeRunningApp,
  onQuitRunningAndStart,
  onHideApp,
  onStartApp,
}: AppActionSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  // While the sheet is open, the gamepad B button should close it instead of
  // popping the route. Pushing onto the back-handler stack ensures the sheet
  // wins over the screen-default back behaviour.
  useGamepadBackHandler(() => {
    if (!visible) return false;
    onClose();
    return true;
  }, visible);

  // Trap controller focus inside the sheet while it is open. The provider
  // restricts navigation to focusables tagged group="sheet" and pulls the
  // initial focus onto the first sheet option, so A/B work immediately.
  const { pushFocusScope } = useGamepad();
  useEffect(() => {
    if (!visible) return;
    const dispose = pushFocusScope("sheet");
    return dispose;
  }, [visible, pushFocusScope]);

  if (!visible) return null;

  const renderOptions = () => {
    if (variant === "running") {
      return (
        <>
          <Option
            label="Resume App"
            color={colors.green}
            onPress={() => { onClose(); onResumeApp?.(); }}
            separator
          />
          <Option
            label="Quit App"
            color="#ef4444"
            onPress={() => { onClose(); onQuitApp?.(); }}
            separator
          />
          <Option
            label="Hide App"
            color="#ef4444"
            onPress={() => { onClose(); onHideApp?.(); }}
          />
        </>
      );
    }

    if (variant === "other") {
      return (
        <>
          <Option
            label="Resume Running App"
            color={colors.mutedForeground}
            onPress={() => { onClose(); onResumeRunningApp?.(); }}
            separator
          />
          <Option
            label="Quit Running App and Start"
            color="#ef4444"
            onPress={() => { onClose(); onQuitRunningAndStart?.(); }}
            separator
          />
          <Option
            label="Hide App"
            color="#ef4444"
            onPress={() => { onClose(); onHideApp?.(); }}
          />
        </>
      );
    }

    return (
      <>
        <Option
          label="Start"
          color={colors.green}
          onPress={() => { onClose(); onStartApp?.(); }}
          separator
        />
        <Option
          label="Hide App"
          color="#ef4444"
          onPress={() => { onClose(); onHideApp?.(); }}
        />
      </>
    );
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape", "landscape-left", "landscape-right"]}
    >
      <View style={styles.wrapper}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: "#141414",
              borderColor: colors.border,
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.titleBlock}>
            <Text style={[styles.titleText, { color: colors.foreground }]} numberOfLines={1}>
              {appTitle}
            </Text>
            {variant === "other" && runningAppTitle && (
              <Text style={[styles.subtitleText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {runningAppTitle} is currently running
              </Text>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {renderOptions()}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Focusable
            focusId="sheet-cancel"
            group="sheet"
            ringRadius={6}
            style={styles.option}
            onPress={onClose}
          >
            <Text style={[styles.optionText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Focusable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Option({
  label,
  color,
  onPress,
  separator,
}: {
  label: string;
  color: string;
  onPress: () => void;
  separator?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <Focusable
        focusId={`sheet-opt-${label}`}
        group="sheet"
        ringRadius={6}
        style={styles.option}
        onPress={onPress}
      >
        <Text style={[styles.optionText, { color }]}>{label}</Text>
      </Focusable>
      {separator && <View style={[styles.hairline, { backgroundColor: colors.border }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 4,
  },
  titleText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  subtitleText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: 1,
    marginBottom: 4,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
