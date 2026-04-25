import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import {
  resolveTheme,
  Theme,
  ThemeId,
  ThemeMode,
  THEME_DEFS,
  ResolvedMode,
  ROG_THEME,
} from "@/constants/themes";

const STORAGE_KEY_THEME = "@pcmon/theme";
const STORAGE_KEY_MODE = "@pcmon/theme-mode";

const VALID_IDS = Object.keys(THEME_DEFS) as ThemeId[];

function isValidId(v: string | null): v is ThemeId {
  return !!v && (VALID_IDS as string[]).includes(v);
}

function isValidMode(v: string | null): v is ThemeMode {
  return v === "light" || v === "dark" || v === "auto";
}

interface ThemeContextValue {
  theme: Theme;
  themeId: ThemeId;
  mode: ThemeMode;
  resolvedMode: ResolvedMode;
  setThemeId: (id: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
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
  themeName: "streamlink",
  setTheme: () => {},
  ready: true,
});

function resolveSystemMode(scheme: ColorSchemeName): ResolvedMode {
  return scheme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>("streamlink");
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );
  const [ready, setReady] = useState(false);

  // Load persisted prefs on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedId, storedMode] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_MODE),
        ]);
        if (isValidId(storedId)) setThemeIdState(storedId);
        if (isValidMode(storedMode)) setModeState(storedMode);
      } catch {
        // ignore
      }
      setReady(true);
    })();
  }, []);

  // Track system appearance changes for "auto" mode
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY_THEME, id).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY_MODE, m).catch(() => {});
  }, []);

  // Resolve the mode: auto follows system; light falls back to dark if theme has no light variant
  const requestedMode: ResolvedMode =
    mode === "auto" ? resolveSystemMode(systemScheme) : mode;

  const def = THEME_DEFS[themeId];
  const resolvedMode: ResolvedMode =
    requestedMode === "light" && def.light ? "light" : "dark";

  const theme = resolveTheme(themeId, resolvedMode);

  const value: ThemeContextValue = {
    theme,
    themeId,
    mode,
    resolvedMode,
    setThemeId,
    setMode,
    themeName: themeId,
    setTheme: setThemeId,
    ready,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
