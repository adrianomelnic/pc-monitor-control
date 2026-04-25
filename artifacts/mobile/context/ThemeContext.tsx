import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import {
  resolveTheme,
  buildCustomTheme,
  Theme,
  ThemeId,
  ThemeMode,
  THEME_DEFS,
  ResolvedMode,
  ROG_THEME,
  CustomThemeDef,
} from "@/constants/themes";

const STORAGE_KEY_THEME = "@pcmon/theme";
const STORAGE_KEY_MODE = "@pcmon/theme-mode";
const STORAGE_KEY_CUSTOM_THEMES = "@pcmon/custom-themes";

const BUILTIN_IDS = Object.keys(THEME_DEFS) as ThemeId[];
const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

function isBuiltinId(v: string | null): v is ThemeId {
  return !!v && (BUILTIN_IDS as string[]).includes(v);
}

function isValidCustomTheme(v: unknown): v is CustomThemeDef {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.startsWith("custom_") &&
    typeof c.label === "string" &&
    c.label.trim().length > 0 &&
    typeof c.tint === "string" &&
    HEX_RE.test(c.tint) &&
    typeof c.createdAt === "number"
  );
}

function isValidMode(v: string | null): v is ThemeMode {
  return v === "light" || v === "dark" || v === "auto";
}

interface ThemeContextValue {
  theme: Theme;
  themeId: string;
  mode: ThemeMode;
  resolvedMode: ResolvedMode;
  setThemeId: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  customThemes: CustomThemeDef[];
  addCustomTheme: (label: string, tint: string) => string;
  deleteCustomTheme: (id: string) => void;
  /** @deprecated use themeId */
  themeName: ThemeId;
  /** @deprecated use setThemeId */
  setTheme: (id: ThemeId) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: ROG_THEME,
  themeId: "streamlink",
  mode: "dark",
  resolvedMode: "dark",
  setThemeId: () => {},
  setMode: () => {},
  customThemes: [],
  addCustomTheme: () => "",
  deleteCustomTheme: () => {},
  themeName: "streamlink",
  setTheme: () => {},
  ready: true,
});

function resolveSystemMode(scheme: ColorSchemeName): ResolvedMode {
  return scheme === "light" ? "light" : "dark";
}

function resolveAnyTheme(
  themeId: string,
  resolvedMode: ResolvedMode,
  customThemes: CustomThemeDef[]
): Theme {
  if (isBuiltinId(themeId)) {
    return resolveTheme(themeId, resolvedMode);
  }
  const custom = customThemes.find((c) => c.id === themeId);
  if (custom) return buildCustomTheme(custom);
  return resolveTheme("streamlink", "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>("streamlink");
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );
  const [customThemes, setCustomThemes] = useState<CustomThemeDef[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedId, storedMode, storedCustom] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_MODE),
          AsyncStorage.getItem(STORAGE_KEY_CUSTOM_THEMES),
        ]);
        let loadedCustom: CustomThemeDef[] = [];
        if (storedCustom) {
          try {
            const parsed = JSON.parse(storedCustom);
            if (Array.isArray(parsed)) {
              loadedCustom = parsed.filter(isValidCustomTheme);
              setCustomThemes(loadedCustom);
            }
          } catch {}
        }
        const customIds = loadedCustom.map((c) => c.id);
        if (storedId && (isBuiltinId(storedId) || customIds.includes(storedId))) {
          setThemeIdState(storedId);
        }
        if (isValidMode(storedMode)) setModeState(storedMode);
      } catch {}
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY_THEME, id).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY_MODE, m).catch(() => {});
  }, []);

  const addCustomTheme = useCallback((label: string, tint: string): string => {
    const id = "custom_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const def: CustomThemeDef = { id, label, tint, createdAt: Date.now() };
    setCustomThemes((prev) => {
      const next = [...prev, def];
      AsyncStorage.setItem(STORAGE_KEY_CUSTOM_THEMES, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return id;
  }, []);

  const deleteCustomTheme = useCallback((id: string) => {
    setCustomThemes((prev) => {
      const next = prev.filter((c) => c.id !== id);
      AsyncStorage.setItem(STORAGE_KEY_CUSTOM_THEMES, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setThemeIdState((cur) => {
      if (cur === id) {
        AsyncStorage.setItem(STORAGE_KEY_THEME, "streamlink").catch(() => {});
        return "streamlink";
      }
      return cur;
    });
  }, []);

  const requestedMode: ResolvedMode =
    mode === "auto" ? resolveSystemMode(systemScheme) : mode;

  const isBuiltin = isBuiltinId(themeId);
  const builtinDef = isBuiltin ? THEME_DEFS[themeId] : null;
  const resolvedMode: ResolvedMode =
    isBuiltin && requestedMode === "light" && builtinDef?.light ? "light" : "dark";

  const theme = resolveAnyTheme(themeId, resolvedMode, customThemes);

  const value: ThemeContextValue = {
    theme,
    themeId,
    mode,
    resolvedMode,
    setThemeId,
    setMode,
    customThemes,
    addCustomTheme,
    deleteCustomTheme,
    themeName: isBuiltinId(themeId) ? themeId : "streamlink",
    setTheme: setThemeId,
    ready,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
