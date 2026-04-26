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

// Width of the green focus ring. Must match `styles.ring.borderWidth` and is
// used in the radius calculation so the ring's inner curve sits flush with
// the child's outer corners.
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
  // Optional edge-bridge overrides. Lets a Focusable explicitly route a
  // direction (e.g. DOWN from a grid tile to the bottom toolbar) when the
  // spatial scorer would otherwise pick a far off-screen sibling. Consult
  // GamepadContext.FocusableEntry.edgeOverrides for the resolution rules.
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

  // Keep callbacks in refs so they are always current without causing the
  // registration effect to re-run (which would trigger a focus-reset cascade
  // every time the parent re-renders with new inline functions).
  const onActivateRef = useRef<(() => void) | undefined>(undefined);
  const onContextRef = useRef<(() => void) | undefined>(undefined);
  const onSecondaryRef = useRef<(() => void) | undefined>(undefined);
  const ensureVisibleRef = useRef<(() => void) | undefined>(undefined);
  // Forward edgeOverrides through a ref so updating them on a parent
  // re-render doesn't tear down the registration (which would briefly
  // drop focus). The pickNext routine reads the live ref via the
  // registry entry's `edgeOverrides` getter below.
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

  // Registration effect only re-runs when identity-stable values change.
  // Callbacks (onPress, onContext, etc.) are accessed through refs so that
  // inline arrow functions in the parent do not trigger re-registration
  // (which caused every Focusable to briefly steal focus on each render).
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
    // Define edgeOverrides as a getter on the registry entry so the
    // pickNext routine always sees the latest map without re-registering.
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
          // The ring is a 2px border drawn flush against the child. Its
          // *outer* radius must equal the child's outer radius + the ring
          // border width so the *inner* curve matches the card's corners
          // exactly — otherwise the card pokes out past the ring at the
          // corners and looks like a notched/ill-fitting margin.
          borderRadius: ringRadius + RING_BORDER_WIDTH,
        },
        ringVisible && styles.ring,
        ringVisible && { borderColor: colors.green, shadowColor: colors.green },
        scaleVisible && styles.scaled,
      ]}
    >
      <Pressable
        // Touch path: fire the same activate click that controller A-button
        // press plays via GamepadContext.activateHaptic. The `navigationSounds`
        // setting is the single toggle for both touch and controller sounds.
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
