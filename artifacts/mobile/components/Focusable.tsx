import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  LayoutChangeEvent,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
  findNodeHandle,
} from "react-native";

import {
  scrollNodeIntoView,
  useFocusScroll,
  useGamepad,
  type FocusableEntry,
  type GamepadDirection,
} from "@/context/GamepadContext";
import { useColors } from "@/hooks/useColors";
import * as Sounds from "@/utils/sounds";

const RING_BORDER_WIDTH = 2;

export interface FocusableProps extends Omit<PressableProps, "onPress"> {
  focusId: string;
  group?: string;
  onPress?: () => void;
  onContext?: () => void;
  onSecondary?: () => void;
  onFocusedAutoScroll?: () => void;
  showRing?: boolean;
  ringRadius?: number;
  scaleOnFocus?: boolean;
  containerStyle?: ViewStyle;
  disabled?: boolean;
  children?: React.ReactNode;
  edgeOverrides?: FocusableEntry["edgeOverrides"];
}

export const Focusable = forwardRef<View, FocusableProps>(function Focusable(
  {
    focusId,
    group,
    onPress,
    onContext,
    onSecondary,
    onFocusedAutoScroll,
    showRing = true,
    ringRadius = 6,
    scaleOnFocus = true,
    containerStyle,
    disabled,
    children,
    style,
    edgeOverrides,
    ...rest
  },
  outerRef,
) {
  const colors = useColors();
  const { register, controllerConnected, navigationSounds } = useGamepad();
  const focusScroll = useFocusScroll();

  const innerRef = useRef<View | null>(null);
  useImperativeHandle(outerRef, () => innerRef.current as View, []);

  const liveRect = useRef({ x: 0, y: 0, w: 0, h: 0 }).current;
  const [focused, setFocused] = useState(false);

  const onActivateRef = useRef<(() => void) | undefined>(undefined);
  const onContextRef = useRef<(() => void) | undefined>(undefined);
  const onSecondaryRef = useRef<(() => void) | undefined>(undefined);
  const ensureVisibleRef = useRef<(() => void) | undefined>(undefined);
  const edgeOverridesRef = useRef<FocusableProps["edgeOverrides"]>(undefined);
  edgeOverridesRef.current = edgeOverrides;

  useEffect(() => { onActivateRef.current = disabled ? undefined : onPress; }, [onPress, disabled]);
  useEffect(() => { onContextRef.current = onContext; }, [onContext]);
  useEffect(() => { onSecondaryRef.current = onSecondary; }, [onSecondary]);

  const measure = useCallback(() => {
    const node = innerRef.current;
    if (!node) return;
    try {
      node.measureInWindow((x, y, w, h) => {
        if (typeof x === "number" && !Number.isNaN(x)) {
          liveRect.x = x;
          liveRect.y = y;
          liveRect.w = w;
          liveRect.h = h;
        }
      });
    } catch {}
  }, [liveRect]);

  const handleLayout = useCallback((_e: LayoutChangeEvent) => {
    requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    measure();
    const id = setInterval(measure, 750);
    return () => clearInterval(id);
  }, [measure]);

  const defaultEnsureVisible = useCallback(() => {
    if (onFocusedAutoScroll) {
      onFocusedAutoScroll();
      return;
    }
    if (!focusScroll) return;
    const node = innerRef.current;
    if (!node) return;
    const handle = findNodeHandle(node);
    scrollNodeIntoView(
      handle,
      focusScroll.scrollRef,
      focusScroll.topInset,
      focusScroll.bottomInset,
      focusScroll.horizontal,
    );
  }, [focusScroll, onFocusedAutoScroll]);

  useEffect(() => {
    ensureVisibleRef.current = defaultEnsureVisible;
  }, [defaultEnsureVisible]);

  useEffect(() => {
    if (disabled) return;
    const entry: Omit<FocusableEntry, "route"> = {
      id: focusId,
      group,
      rect: liveRect,
      onActivate: () => onActivateRef.current?.(),
      onContext: () => onContextRef.current?.(),
      onSecondary: () => onSecondaryRef.current?.(),
      ensureVisible: () => ensureVisibleRef.current?.(),
      setFocused,
    };
    Object.defineProperty(entry, "edgeOverrides", {
      enumerable: true,
      get: (): Partial<Record<GamepadDirection, string | (() => string | null | undefined)>> | undefined =>
        edgeOverridesRef.current,
    });
    const unreg = register(entry);
    return unreg;
  }, [focusId, group, register, disabled, liveRect]);

  const ringVisible = controllerConnected && focused && showRing && !disabled;
  const scaleVisible = controllerConnected && focused && scaleOnFocus && !disabled;

  return (
    <View
      ref={innerRef}
      onLayout={handleLayout}
      style={[
        containerStyle,
        ringVisible && {
          borderRadius: ringRadius + RING_BORDER_WIDTH,
        },
        ringVisible && styles.ring,
        ringVisible && { borderColor: colors.green, shadowColor: colors.green },
        scaleVisible && styles.scaled,
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : () => {
          if (navigationSounds) Sounds.playActivate();
          onPress?.();
        }}
        disabled={disabled}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    borderWidth: RING_BORDER_WIDTH,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  scaled: {
    transform: [{ scale: 1.04 }],
  },
});
