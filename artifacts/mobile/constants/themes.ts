import type { TextStyle } from "react-native";

export type ThemeName = "rog" | "classic";

export interface ThemeColors {
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  card: string;
  cardBorder: string;
  tint: string;
  tintDark: string;
  tabIconDefault: string;
  tabIconSelected: string;
  danger: string;
  warning: string;
  success: string;
  online: string;
  offline: string;
  idle: string;
}

export interface CardAccents {
  cpu: string;
  gpu: string;
  ram: string;
  thermals: string;
  fans: string;
  disks: string;
  network: string;
  sensor: string;
}

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  cardAccents: CardAccents;
  cardRadius: number;
  buttonRadius: number;
  innerRadius: number;
  accentEdge: "left" | "top";
  accentThickness: number;
  titleCase: "upper" | "sentence";
  titleLetterSpacing: number;
  titleFontSize: number;
  sectionLabelLetterSpacing: number;
  tabularNumbers: boolean;
}

export const ROG_THEME: Theme = {
  name: "rog",
  colors: {
    text: "#FFFFFF",
    textSecondary: "#8A8A8A",
    textMuted: "#555555",
    background: "#0A0A0A",
    backgroundSecondary: "#111111",
    backgroundTertiary: "#1C1C1C",
    card: "#141414",
    cardBorder: "#252525",
    tint: "#FF1744",
    tintDark: "#D50000",
    tabIconDefault: "#505050",
    tabIconSelected: "#FF1744",
    danger: "#FF4444",
    warning: "#FFB800",
    success: "#69F0AE",
    online: "#69F0AE",
    offline: "#FF5252",
    idle: "#FFB300",
  },
  cardAccents: {
    cpu: "#FF1744",
    gpu: "#FF6D00",
    ram: "#448AFF",
    thermals: "#FF3D00",
    fans: "#FF9100",
    disks: "#00BFA5",
    network: "#40C4FF",
    sensor: "#9D50FF",
  },
  cardRadius: 4,
  buttonRadius: 4,
  innerRadius: 2,
  accentEdge: "left",
  accentThickness: 3,
  titleCase: "upper",
  titleLetterSpacing: 0.6,
  titleFontSize: 13,
  sectionLabelLetterSpacing: 1.5,
  tabularNumbers: true,
};

export const CLASSIC_THEME: Theme = {
  name: "classic",
  colors: {
    text: "#FFFFFF",
    textSecondary: "#8FA3B8",
    textMuted: "#556B85",
    background: "#0A0F1E",
    backgroundSecondary: "#121829",
    backgroundTertiary: "#1A2236",
    card: "#121829",
    cardBorder: "#1F2A42",
    tint: "#00D4FF",
    tintDark: "#0288A8",
    tabIconDefault: "#556B85",
    tabIconSelected: "#00D4FF",
    danger: "#FF6B6B",
    warning: "#FFC857",
    success: "#5BD9A6",
    online: "#5BD9A6",
    offline: "#FF6B6B",
    idle: "#FFC857",
  },
  cardAccents: {
    cpu: "#00D4FF",
    gpu: "#FF8A65",
    ram: "#7DA9FF",
    thermals: "#FF7A7A",
    fans: "#FFC857",
    disks: "#5BD9A6",
    network: "#82E0FF",
    sensor: "#B388FF",
  },
  cardRadius: 6,
  buttonRadius: 6,
  innerRadius: 4,
  accentEdge: "top",
  accentThickness: 2,
  titleCase: "sentence",
  titleLetterSpacing: 0,
  titleFontSize: 14,
  sectionLabelLetterSpacing: 0.4,
  tabularNumbers: false,
};

export const THEMES: Record<ThemeName, Theme> = {
  rog: ROG_THEME,
  classic: CLASSIC_THEME,
};

export function tabularNumsVariant(theme: Theme): TextStyle["fontVariant"] {
  return theme.tabularNumbers ? ["tabular-nums"] : undefined;
}

/**
 * Returns the appropriate border style for an accent strip.
 * In themes where accentEdge === "left", produces a left-side accent;
 * in themes where accentEdge === "top", produces a top-side accent.
 */
export function accentEdgeStyle(
  theme: Theme,
  color: string,
  thickness?: number
): {
  borderLeftWidth?: number;
  borderLeftColor?: string;
  borderTopWidth?: number;
  borderTopColor?: string;
} {
  const t = thickness ?? theme.accentThickness;
  if (theme.accentEdge === "left") {
    return { borderLeftWidth: t, borderLeftColor: color };
  }
  return { borderTopWidth: t, borderTopColor: color };
}
