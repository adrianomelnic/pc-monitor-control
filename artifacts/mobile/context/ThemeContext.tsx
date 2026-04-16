import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Theme, ThemeName, THEMES, ROG_THEME } from "@/constants/themes";

const STORAGE_KEY = "@pcmon/theme";

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: ROG_THEME,
  themeName: "rog",
  setTheme: () => {},
  ready: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("rog");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "classic" || stored === "rog") {
          setThemeName(stored);
        }
      } catch {
        // ignore
      }
      setReady(true);
    })();
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeName], themeName, setTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
