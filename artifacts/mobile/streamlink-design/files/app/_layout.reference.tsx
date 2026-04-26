/**
 * Reference root layout showing the StreamLink design-system boot pattern.
 *
 * Copy this into your project's `app/_layout.tsx` and wire up your own
 * providers / routes. The important pieces are:
 *
 *   1. Inter font loading (400/500/600/700) via @expo-google-fonts/inter.
 *   2. Feather icon-font registration via `...Feather.font` (REQUIRED on
 *      Android — without it every Feather glyph renders as a missing-glyph
 *      rectangle).
 *   3. preventAutoHideAsync() on import + hideAsync() once fonts are loaded.
 *   4. Root <Stack> with screenOptions.contentStyle.backgroundColor = "#0a0a0a"
 *      so route transitions never flash a white background.
 *   5. Provider order: SafeAreaProvider → ErrorBoundary → (your data layer)
 *      → GestureHandlerRootView → (your app providers).
 *
 * Pair this with app.json:
 *   "userInterfaceStyle": "dark",
 *   "splash": { "backgroundColor": "#0a0a0a", ... }
 */

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import Feather from "@expo/vector-icons/Feather";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Dark base so navigation transitions never flash a light frame.
        contentStyle: { backgroundColor: "#0a0a0a" },
      }}
    >
      {/* TODO: declare your routes here. Examples:
          <Stack.Screen name="index" />
          <Stack.Screen name="some-modal" options={{ presentation: "modal" }} />
      */}
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Required so Feather glyphs render on Android. iOS auto-registers via
    // the native target's UIAppFonts but Android does not.
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/* TODO: your providers (auth, data, theme, etc.) wrap here. */}
          <RootLayoutNav />
          {/* TODO: optional overlays such as a controller toast can go here. */}
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
