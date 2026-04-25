import type { TextStyle } from "react-native";

export type ThemeId =
  | "streamlink"
  | "rog"
  | "classic"
  | "cyberpunk"
  | "matrix"
  | "ocean"
  | "sunset"
  | "nord"
  | "minimal";

export interface CustomThemeDef {
  id: string;
  label: string;
  tint: string;
  createdAt: number;
}

export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedMode = "light" | "dark";

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
  tintForeground: string;
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

export interface ThemeShape {
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

export interface Theme extends ThemeShape {
  id: ThemeId;
  mode: ResolvedMode;
  colors: ThemeColors;
  cardAccents: CardAccents;
}

export interface ThemeVariant {
  colors: ThemeColors;
  cardAccents: CardAccents;
}

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  shape: ThemeShape;
  dark: ThemeVariant;
  light?: ThemeVariant;
}

// ─── Color utilities ─────────────────────────────────────────────────────────

/**
 * Given any CSS hex color string (3- or 6-digit, with or without #),
 * returns "#000" or "#fff" — whichever achieves higher contrast against
 * that background — using the WCAG relative-luminance formula.
 *
 * Example usage in a theme definition:
 *   tint: "#FF6D00",
 *   tintForeground: contrastForeground("#FF6D00"),
 */
export function contrastForeground(hex: string): "#000" | "#fff" {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000" : "#fff";
}

// ─── Shape token presets ─────────────────────────────────────────────────────
const SHAPE_TACTICAL: ThemeShape = {
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

const SHAPE_SOFT: ThemeShape = {
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

const SHAPE_ROUNDED: ThemeShape = {
  cardRadius: 10,
  buttonRadius: 8,
  innerRadius: 6,
  accentEdge: "top",
  accentThickness: 2,
  titleCase: "sentence",
  titleLetterSpacing: 0,
  titleFontSize: 14,
  sectionLabelLetterSpacing: 0.3,
  tabularNumbers: false,
};

// ─── Theme definitions ───────────────────────────────────────────────────────

const STREAMLINK: ThemeDef = {
  id: "streamlink",
  label: "StreamLink",
  description: "Neon green · true black",
  shape: SHAPE_TACTICAL,
  dark: {
    colors: {
      text: "#E8E8E8",
      textSecondary: "#6B6B6B",
      textMuted: "#444444",
      background: "#0A0A0A",
      backgroundSecondary: "#141414",
      backgroundTertiary: "#1E1E1E",
      card: "#141414",
      cardBorder: "#2A2A2A",
      tint: "#44D62C",
      tintDark: "#2DA01E",
      tintForeground: contrastForeground("#44D62C"),
      tabIconDefault: "#444444",
      tabIconSelected: "#44D62C",
      danger: "#FF3B30",
      warning: "#F59E0B",
      success: "#44D62C",
      online: "#44D62C",
      offline: "#444444",
      idle: "#F59E0B",
    },
    cardAccents: {
      cpu: "#44D62C",
      gpu: "#44D62C",
      ram: "#44D62C",
      thermals: "#44D62C",
      fans: "#44D62C",
      disks: "#44D62C",
      network: "#44D62C",
      sensor: "#44D62C",
    },
  },
};

const ROG: ThemeDef = {
  id: "rog",
  label: "ROG",
  description: "Red accents · sharp edges",
  shape: SHAPE_TACTICAL,
  dark: {
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
      tintForeground: contrastForeground("#FF1744"),
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
      gpu: "#FF1744",
      ram: "#FF1744",
      thermals: "#FF1744",
      fans: "#FF1744",
      disks: "#FF1744",
      network: "#FF1744",
      sensor: "#FF1744",
    },
  },
};

const CLASSIC: ThemeDef = {
  id: "classic",
  label: "Classic",
  description: "Cyan accents · softer edges",
  shape: SHAPE_SOFT,
  dark: {
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
      tintForeground: contrastForeground("#00D4FF"),
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
      gpu: "#00D4FF",
      ram: "#00D4FF",
      thermals: "#00D4FF",
      fans: "#00D4FF",
      disks: "#00D4FF",
      network: "#00D4FF",
      sensor: "#00D4FF",
    },
  },
  light: {
    colors: {
      text: "#0A1929",
      textSecondary: "#4A5E78",
      textMuted: "#8296B0",
      background: "#F3F7FC",
      backgroundSecondary: "#E8EEF7",
      backgroundTertiary: "#DCE5F1",
      card: "#FFFFFF",
      cardBorder: "#D4DCE8",
      tint: "#0091C2",
      tintDark: "#006F94",
      tintForeground: contrastForeground("#0091C2"),
      tabIconDefault: "#8296B0",
      tabIconSelected: "#0091C2",
      danger: "#E23B3B",
      warning: "#CC8500",
      success: "#1FA371",
      online: "#1FA371",
      offline: "#E23B3B",
      idle: "#CC8500",
    },
    cardAccents: {
      cpu: "#0091C2",
      gpu: "#0091C2",
      ram: "#0091C2",
      thermals: "#0091C2",
      fans: "#0091C2",
      disks: "#0091C2",
      network: "#0091C2",
      sensor: "#0091C2",
    },
  },
};

const CYBERPUNK: ThemeDef = {
  id: "cyberpunk",
  label: "Cyberpunk",
  description: "Neon magenta · electric cyan",
  shape: SHAPE_TACTICAL,
  dark: {
    colors: {
      text: "#FFFFFF",
      textSecondary: "#A88AB8",
      textMuted: "#6A4D7A",
      background: "#0A0014",
      backgroundSecondary: "#130020",
      backgroundTertiary: "#1C0030",
      card: "#15001F",
      cardBorder: "#3B0A55",
      tint: "#FF00C8",
      tintDark: "#B80091",
      tintForeground: contrastForeground("#FF00C8"),
      tabIconDefault: "#6A4D7A",
      tabIconSelected: "#FF00C8",
      danger: "#FF2266",
      warning: "#FFD000",
      success: "#00FFB2",
      online: "#00FFB2",
      offline: "#FF2266",
      idle: "#FFD000",
    },
    cardAccents: {
      cpu: "#FF00C8",
      gpu: "#FF00C8",
      ram: "#FF00C8",
      thermals: "#FF00C8",
      fans: "#FF00C8",
      disks: "#FF00C8",
      network: "#FF00C8",
      sensor: "#FF00C8",
    },
  },
};

const MATRIX: ThemeDef = {
  id: "matrix",
  label: "Matrix",
  description: "Phosphor green on black",
  shape: SHAPE_TACTICAL,
  dark: {
    colors: {
      text: "#B8FFC8",
      textSecondary: "#4CAE63",
      textMuted: "#2A6A39",
      background: "#000000",
      backgroundSecondary: "#040A06",
      backgroundTertiary: "#081710",
      card: "#05100A",
      cardBorder: "#133A22",
      tint: "#00FF66",
      tintDark: "#00B347",
      tintForeground: contrastForeground("#00FF66"),
      tabIconDefault: "#2A6A39",
      tabIconSelected: "#00FF66",
      danger: "#FF4466",
      warning: "#D4FF00",
      success: "#00FF66",
      online: "#00FF66",
      offline: "#FF4466",
      idle: "#D4FF00",
    },
    cardAccents: {
      cpu: "#00FF66",
      gpu: "#00FF66",
      ram: "#00FF66",
      thermals: "#00FF66",
      fans: "#00FF66",
      disks: "#00FF66",
      network: "#00FF66",
      sensor: "#00FF66",
    },
  },
};

const OCEAN: ThemeDef = {
  id: "ocean",
  label: "Ocean",
  description: "Deep teal · calm blues",
  shape: SHAPE_ROUNDED,
  dark: {
    colors: {
      text: "#E6F4F6",
      textSecondary: "#7FA8B4",
      textMuted: "#4A6E78",
      background: "#061820",
      backgroundSecondary: "#0A2330",
      backgroundTertiary: "#0F3040",
      card: "#0C2A38",
      cardBorder: "#1A4456",
      tint: "#00BFA5",
      tintDark: "#008572",
      tintForeground: contrastForeground("#00BFA5"),
      tabIconDefault: "#4A6E78",
      tabIconSelected: "#00BFA5",
      danger: "#FF6B6B",
      warning: "#FFB74D",
      success: "#4DD0B0",
      online: "#4DD0B0",
      offline: "#FF6B6B",
      idle: "#FFB74D",
    },
    cardAccents: {
      cpu: "#00BFA5",
      gpu: "#00BFA5",
      ram: "#00BFA5",
      thermals: "#00BFA5",
      fans: "#00BFA5",
      disks: "#00BFA5",
      network: "#00BFA5",
      sensor: "#00BFA5",
    },
  },
  light: {
    colors: {
      text: "#0A2230",
      textSecondary: "#456774",
      textMuted: "#7C9AA5",
      background: "#F0F7F9",
      backgroundSecondary: "#E2EEF2",
      backgroundTertiary: "#D3E4EA",
      card: "#FFFFFF",
      cardBorder: "#CFDEE3",
      tint: "#00897B",
      tintDark: "#00665B",
      tintForeground: contrastForeground("#00897B"),
      tabIconDefault: "#7C9AA5",
      tabIconSelected: "#00897B",
      danger: "#D84545",
      warning: "#D68400",
      success: "#2E9E7E",
      online: "#2E9E7E",
      offline: "#D84545",
      idle: "#D68400",
    },
    cardAccents: {
      cpu: "#00897B",
      gpu: "#00897B",
      ram: "#00897B",
      thermals: "#00897B",
      fans: "#00897B",
      disks: "#00897B",
      network: "#00897B",
      sensor: "#00897B",
    },
  },
};

const SUNSET: ThemeDef = {
  id: "sunset",
  label: "Sunset",
  description: "Warm orange · pink glow",
  shape: SHAPE_ROUNDED,
  dark: {
    colors: {
      text: "#FFF3EA",
      textSecondary: "#C5A28C",
      textMuted: "#7A5E4A",
      background: "#1A0D12",
      backgroundSecondary: "#241418",
      backgroundTertiary: "#2E1B20",
      card: "#2A141B",
      cardBorder: "#4A2630",
      tint: "#FF6D00",
      tintDark: "#C75200",
      tintForeground: contrastForeground("#FF6D00"),
      tabIconDefault: "#7A5E4A",
      tabIconSelected: "#FF6D00",
      danger: "#FF3D7F",
      warning: "#FFC947",
      success: "#6DD997",
      online: "#6DD997",
      offline: "#FF3D7F",
      idle: "#FFC947",
    },
    cardAccents: {
      cpu: "#FF6D00",
      gpu: "#FF6D00",
      ram: "#FF6D00",
      thermals: "#FF6D00",
      fans: "#FF6D00",
      disks: "#FF6D00",
      network: "#FF6D00",
      sensor: "#FF6D00",
    },
  },
  light: {
    colors: {
      text: "#2A1410",
      textSecondary: "#6B473C",
      textMuted: "#A68872",
      background: "#FFF7F1",
      backgroundSecondary: "#FFEFE2",
      backgroundTertiary: "#FDE4CF",
      card: "#FFFFFF",
      cardBorder: "#F0D5BF",
      tint: "#E65100",
      tintDark: "#B04000",
      tintForeground: contrastForeground("#E65100"),
      tabIconDefault: "#A68872",
      tabIconSelected: "#E65100",
      danger: "#D81B60",
      warning: "#C47A00",
      success: "#2EA364",
      online: "#2EA364",
      offline: "#D81B60",
      idle: "#C47A00",
    },
    cardAccents: {
      cpu: "#E65100",
      gpu: "#E65100",
      ram: "#E65100",
      thermals: "#E65100",
      fans: "#E65100",
      disks: "#E65100",
      network: "#E65100",
      sensor: "#E65100",
    },
  },
};

const NORD: ThemeDef = {
  id: "nord",
  label: "Nord",
  description: "Calm arctic blues",
  shape: SHAPE_ROUNDED,
  dark: {
    colors: {
      text: "#ECEFF4",
      textSecondary: "#9FAEC5",
      textMuted: "#5E6B80",
      background: "#2E3440",
      backgroundSecondary: "#363D4A",
      backgroundTertiary: "#3B4252",
      card: "#3B4252",
      cardBorder: "#4C566A",
      tint: "#88C0D0",
      tintDark: "#5E81AC",
      tintForeground: contrastForeground("#88C0D0"),
      tabIconDefault: "#5E6B80",
      tabIconSelected: "#88C0D0",
      danger: "#BF616A",
      warning: "#EBCB8B",
      success: "#A3BE8C",
      online: "#A3BE8C",
      offline: "#BF616A",
      idle: "#EBCB8B",
    },
    cardAccents: {
      cpu: "#88C0D0",
      gpu: "#88C0D0",
      ram: "#88C0D0",
      thermals: "#88C0D0",
      fans: "#88C0D0",
      disks: "#88C0D0",
      network: "#88C0D0",
      sensor: "#88C0D0",
    },
  },
  light: {
    colors: {
      text: "#2E3440",
      textSecondary: "#4C566A",
      textMuted: "#7A8290",
      background: "#ECEFF4",
      backgroundSecondary: "#E5E9F0",
      backgroundTertiary: "#D8DEE9",
      card: "#FFFFFF",
      cardBorder: "#D8DEE9",
      tint: "#5E81AC",
      tintDark: "#3B5C82",
      tintForeground: contrastForeground("#5E81AC"),
      tabIconDefault: "#7A8290",
      tabIconSelected: "#5E81AC",
      danger: "#BF616A",
      warning: "#B88A30",
      success: "#7A9660",
      online: "#7A9660",
      offline: "#BF616A",
      idle: "#B88A30",
    },
    cardAccents: {
      cpu: "#5E81AC",
      gpu: "#5E81AC",
      ram: "#5E81AC",
      thermals: "#5E81AC",
      fans: "#5E81AC",
      disks: "#5E81AC",
      network: "#5E81AC",
      sensor: "#5E81AC",
    },
  },
};

const MINIMAL: ThemeDef = {
  id: "minimal",
  label: "Minimal",
  description: "Pure black & white",
  shape: SHAPE_SOFT,
  dark: {
    colors: {
      text: "#FFFFFF",
      textSecondary: "#9A9A9A",
      textMuted: "#5F5F5F",
      background: "#000000",
      backgroundSecondary: "#0A0A0A",
      backgroundTertiary: "#141414",
      card: "#101010",
      cardBorder: "#222222",
      tint: "#FFFFFF",
      tintDark: "#BFBFBF",
      tintForeground: contrastForeground("#FFFFFF"),
      tabIconDefault: "#5F5F5F",
      tabIconSelected: "#FFFFFF",
      danger: "#E66B6B",
      warning: "#E6C26B",
      success: "#7FE69A",
      online: "#7FE69A",
      offline: "#E66B6B",
      idle: "#E6C26B",
    },
    cardAccents: {
      cpu: "#FFFFFF",
      gpu: "#FFFFFF",
      ram: "#FFFFFF",
      thermals: "#FFFFFF",
      fans: "#FFFFFF",
      disks: "#FFFFFF",
      network: "#FFFFFF",
      sensor: "#FFFFFF",
    },
  },
  light: {
    colors: {
      text: "#000000",
      textSecondary: "#555555",
      textMuted: "#8A8A8A",
      background: "#FFFFFF",
      backgroundSecondary: "#F5F5F5",
      backgroundTertiary: "#EAEAEA",
      card: "#FFFFFF",
      cardBorder: "#DDDDDD",
      tint: "#000000",
      tintDark: "#333333",
      tintForeground: contrastForeground("#000000"),
      tabIconDefault: "#8A8A8A",
      tabIconSelected: "#000000",
      danger: "#C84040",
      warning: "#B88600",
      success: "#2A9458",
      online: "#2A9458",
      offline: "#C84040",
      idle: "#B88600",
    },
    cardAccents: {
      cpu: "#000000",
      gpu: "#000000",
      ram: "#000000",
      thermals: "#000000",
      fans: "#000000",
      disks: "#000000",
      network: "#000000",
      sensor: "#000000",
    },
  },
};

export const THEME_DEFS: Record<ThemeId, ThemeDef> = {
  streamlink: STREAMLINK,
  rog: ROG,
  classic: CLASSIC,
  cyberpunk: CYBERPUNK,
  matrix: MATRIX,
  ocean: OCEAN,
  sunset: SUNSET,
  nord: NORD,
  minimal: MINIMAL,
};

export const THEME_ORDER: ThemeId[] = [
  "streamlink",
  "rog",
  "classic",
  "cyberpunk",
  "matrix",
  "ocean",
  "sunset",
  "nord",
  "minimal",
];

export function supportsLight(themeId: ThemeId): boolean {
  return !!THEME_DEFS[themeId].light;
}

export function resolveTheme(themeId: ThemeId, mode: ResolvedMode): Theme {
  const def = THEME_DEFS[themeId];
  const variant = mode === "light" && def.light ? def.light : def.dark;
  const effectiveMode: ResolvedMode = mode === "light" && def.light ? "light" : "dark";
  return {
    id: def.id,
    mode: effectiveMode,
    colors: variant.colors,
    cardAccents: variant.cardAccents,
    ...def.shape,
  };
}

// ─── Custom theme builder ────────────────────────────────────────────────────

/**
 * Derives a slightly-darkened variant of a hex tint for tintDark.
 * Reduces lightness by ~20% in HSL space.
 */
function darkenHex(hex: string, amount = 0.22): string {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  let r = parseInt(full.slice(0, 2), 16) / 255;
  let g = parseInt(full.slice(2, 4), 16) / 255;
  let b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h2 = 0, s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h2 = ((b - r) / d + 2) / 6; break;
      case b: h2 = ((r - g) / d + 4) / 6; break;
    }
  }
  l = Math.max(0, l - amount);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p2: number, q2: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
    if (t < 1 / 2) return q2;
    if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
    return p2;
  };
  r = hue2rgb(p, q, h2 + 1 / 3);
  g = hue2rgb(p, q, h2);
  b = hue2rgb(p, q, h2 - 1 / 3);
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Builds a complete dark Theme from a CustomThemeDef.
 * Uses a neutral dark background; the tint color controls all accents.
 */
export function buildCustomTheme(def: CustomThemeDef): Theme {
  const tint = def.tint;
  const tintDark = darkenHex(tint);
  const tintForeground = contrastForeground(tint);
  return {
    id: def.id as ThemeId,
    mode: "dark",
    colors: {
      text: "#FFFFFF",
      textSecondary: "#8A8A8A",
      textMuted: "#555555",
      background: "#0A0A0A",
      backgroundSecondary: "#111111",
      backgroundTertiary: "#1C1C1C",
      card: "#141414",
      cardBorder: "#252525",
      tint,
      tintDark,
      tintForeground,
      tabIconDefault: "#505050",
      tabIconSelected: tint,
      danger: "#FF4444",
      warning: "#FFB800",
      success: "#69F0AE",
      online: "#69F0AE",
      offline: "#FF5252",
      idle: "#FFB300",
    },
    cardAccents: {
      cpu: tint,
      gpu: tint,
      ram: tint,
      thermals: tint,
      fans: tint,
      disks: tint,
      network: tint,
      sensor: tint,
    },
    ...SHAPE_TACTICAL,
  };
}

// ─── Backwards-compat exports (existing code references these) ───────────────
export type ThemeName = ThemeId;

export const ROG_THEME: Theme = resolveTheme("rog", "dark");
export const CLASSIC_THEME: Theme = resolveTheme("classic", "dark");

export const THEMES: Record<ThemeId, Theme> = {
  streamlink: resolveTheme("streamlink", "dark"),
  rog: resolveTheme("rog", "dark"),
  classic: resolveTheme("classic", "dark"),
  cyberpunk: resolveTheme("cyberpunk", "dark"),
  matrix: resolveTheme("matrix", "dark"),
  ocean: resolveTheme("ocean", "dark"),
  sunset: resolveTheme("sunset", "dark"),
  nord: resolveTheme("nord", "dark"),
  minimal: resolveTheme("minimal", "dark"),
};

const TABULAR_NUMS_ON: TextStyle["fontVariant"] = ["tabular-nums"];
const TABULAR_NUMS_OFF: TextStyle["fontVariant"] = ["proportional-nums"];

export function tabularNumsVariant(theme: Theme): TextStyle["fontVariant"] {
  return theme.tabularNumbers ? TABULAR_NUMS_ON : TABULAR_NUMS_OFF;
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
