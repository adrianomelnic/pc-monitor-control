import React from "react";

export type GamepadDirection = "up" | "down" | "left" | "right";
export type FocusableEntry = {
  id: string;
  group?: string;
  rect: { x: number; y: number; w: number; h: number };
  onActivate: () => void;
  onContext: () => void;
  onSecondary: () => void;
  ensureVisible: () => void;
  setFocused: (v: boolean) => void;
  route?: string;
  edgeOverrides?: Partial<
    Record<GamepadDirection, string | (() => string | null | undefined)>
  >;
};

const ctx = {
  register: (_e: Omit<FocusableEntry, "route">) => () => {},
  controllerConnected: false,
  controllerName: null as string | null,
  controllerKind: null as string | null,
  navigationSounds: false,
  setKeyboardCaptureActive: (_v: boolean) => {},
  pushBackHandler: (_h: () => boolean) => () => {},
  pushFocusScope: (_g: string) => () => {},
};

export function useGamepad() {
  return ctx;
}

export function useFocusScroll() {
  return null as null | {
    scrollRef: React.RefObject<unknown>;
    topInset: number;
    bottomInset: number;
    horizontal?: boolean;
  };
}

export function useGamepadBackHandler(
  _h: () => boolean,
  _enabled: boolean,
) {}

export function scrollNodeIntoView(
  _handle: number | null,
  _ref: unknown,
  _top: number,
  _bottom: number,
  _h?: boolean,
) {}
