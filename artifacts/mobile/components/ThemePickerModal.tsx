import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ResolvedMode,
  Theme,
  ThemeId,
  ThemeMode,
  THEME_DEFS,
  THEME_ORDER,
  resolveTheme,
  supportsLight,
} from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";
import { CreateThemeModal } from "@/components/CreateThemeModal";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ThemePickerModal({ visible, onClose }: Props) {
  const { theme, themeId, mode, setThemeId, setMode, customThemes, deleteCustomTheme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const C = theme.colors;
  const [createVisible, setCreateVisible] = useState(false);

  const renderMiniPreview = (id: ThemeId, m: ResolvedMode) => {
    const preview = resolveTheme(id, m);
    const pc = preview.colors;
    return (
      <View
        key={m}
        style={[
          styles.themePreview,
          { backgroundColor: pc.background, borderColor: pc.cardBorder },
        ]}
      >
        <View
          style={[
            styles.themePreviewCard,
            { backgroundColor: pc.card, borderColor: pc.cardBorder },
            preview.accentEdge === "left"
              ? { borderLeftWidth: 2, borderLeftColor: pc.tint }
              : { borderTopWidth: 2, borderTopColor: pc.tint },
          ]}
        >
          <View
            style={[
              styles.themePreviewBar,
              { backgroundColor: pc.tint, width: 14 },
            ]}
          />
          <View
            style={[
              styles.themePreviewBar,
              { backgroundColor: pc.tint + "55", width: 22 },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderCustomMiniPreview = (tint: string) => {
    return (
      <View
        style={[
          styles.themePreview,
          { backgroundColor: "#0A0A0A", borderColor: "#252525", flex: 1 },
        ]}
      >
        <View
          style={[
            styles.themePreviewCard,
            { backgroundColor: "#141414", borderColor: "#252525", borderLeftWidth: 2, borderLeftColor: tint },
          ]}
        >
          <View style={[styles.themePreviewBar, { backgroundColor: tint, width: 14 }]} />
          <View style={[styles.themePreviewBar, { backgroundColor: tint + "55", width: 22 }]} />
        </View>
      </View>
    );
  };

  const renderThemeTile = (id: ThemeId) => {
    const def = THEME_DEFS[id];
    const selected = themeId === id;
    const hasLight = supportsLight(id);

    return (
      <Pressable
        key={id}
        onPress={() => {
          if (themeId !== id) {
            Haptics.selectionAsync();
            setThemeId(id);
          }
        }}
        style={({ pressed }) => [
          styles.themeTile,
          {
            borderColor: selected ? C.tint : C.cardBorder,
            backgroundColor: selected ? C.tint + "12" : C.backgroundTertiary,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.themePreviewRow}>
          {hasLight ? renderMiniPreview(id, "light") : null}
          {renderMiniPreview(id, "dark")}
        </View>
        <View style={styles.themeTileInfo}>
          <View style={styles.themeTileLabelRow}>
            <Text
              style={[
                styles.themeTileLabel,
                { color: selected ? C.tint : C.text },
              ]}
              numberOfLines={1}
            >
              {def.label}
            </Text>
            {selected ? (
              <Feather name="check-circle" size={14} color={C.tint} />
            ) : null}
          </View>
          <Text style={styles.themeTileSub} numberOfLines={1}>
            {def.description}
          </Text>
          {!hasLight ? (
            <View style={styles.themeTileBadge}>
              <Feather name="moon" size={9} color={C.textSecondary} />
              <Text style={styles.themeTileBadgeText}>Dark only</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderCustomTile = (def: { id: string; label: string; tint: string; createdAt: number }) => {
    const selected = themeId === def.id;
    return (
      <Pressable
        key={def.id}
        onPress={() => {
          if (themeId !== def.id) {
            Haptics.selectionAsync();
            setThemeId(def.id);
          }
        }}
        style={({ pressed }) => [
          styles.themeTile,
          {
            borderColor: selected ? def.tint : C.cardBorder,
            backgroundColor: selected ? def.tint + "12" : C.backgroundTertiary,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.themePreviewRow}>
          {renderCustomMiniPreview(def.tint)}
        </View>
        <View style={styles.themeTileInfo}>
          <View style={styles.themeTileLabelRow}>
            <Text
              style={[styles.themeTileLabel, { color: selected ? def.tint : C.text }]}
              numberOfLines={1}
            >
              {def.label}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {selected ? <Feather name="check-circle" size={14} color={def.tint} /> : null}
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Delete theme",
                    `Delete "${def.label}"? This cannot be undone.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          deleteCustomTheme(def.id);
                        },
                      },
                    ]
                  );
                }}
                hitSlop={8}
              >
                <Feather name="trash-2" size={13} color={C.textMuted} />
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <View style={[styles.customTintDot, { backgroundColor: def.tint }]} />
            <Text style={styles.themeTileSub} numberOfLines={1}>
              {def.tint.toUpperCase()} · Dark only
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderModeButton = (
    m: ThemeMode,
    label: string,
    iconName: keyof typeof Feather.glyphMap,
  ) => {
    const selected = mode === m;
    const isCustomActive = !Object.keys(THEME_DEFS).includes(themeId);
    const activeThemeHasLight = isCustomActive ? false : supportsLight(themeId as ThemeId);
    const disabled = m === "light" && !activeThemeHasLight;

    return (
      <Pressable
        key={m}
        disabled={disabled}
        onPress={() => {
          if (mode !== m) {
            Haptics.selectionAsync();
            setMode(m);
          }
        }}
        style={({ pressed }) => [
          styles.modeButton,
          {
            borderColor: selected ? C.tint : C.cardBorder,
            backgroundColor: selected ? C.tint + "18" : "transparent",
            opacity: disabled ? 0.4 : 1,
          },
          pressed && !disabled && { opacity: 0.85 },
        ]}
      >
        <Feather
          name={iconName}
          size={14}
          color={selected ? C.tint : C.textSecondary}
        />
        <Text
          style={[
            styles.modeButtonText,
            { color: selected ? C.tint : C.textSecondary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const isCustomActive = !Object.keys(THEME_DEFS).includes(themeId);

  return (
    <>
      <Modal
        visible={visible && !createVisible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Appearance</Text>
                <Text style={styles.subtitle}>
                  Choose a theme and preferred mode. Changes apply instantly.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="x" size={18} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.groupLabel}>Theme</Text>
              <View style={styles.grid}>
                {THEME_ORDER.map((id) => renderThemeTile(id))}
              </View>

              {customThemes.length > 0 && (
                <>
                  <Text style={styles.groupLabel}>Custom</Text>
                  <View style={styles.grid}>
                    {customThemes.map((def) => renderCustomTile(def))}
                  </View>
                </>
              )}

              <Pressable
                onPress={() => setCreateVisible(true)}
                style={({ pressed }) => [
                  styles.createBtn,
                  { borderColor: C.tint + "55", backgroundColor: C.tint + "0A" },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Feather name="plus" size={15} color={C.tint} />
                <Text style={[styles.createBtnText, { color: C.tint }]}>
                  Create theme
                </Text>
              </Pressable>

              <Text style={[styles.groupLabel, { marginTop: 16 }]}>Mode</Text>
              <View style={styles.modeRow}>
                {renderModeButton("light", "Light", "sun")}
                {renderModeButton("dark", "Dark", "moon")}
                {renderModeButton("auto", "Auto", "smartphone")}
              </View>
              {!isCustomActive && !supportsLight(themeId as ThemeId) ? (
                <Text style={styles.modeHint}>
                  {THEME_DEFS[themeId as ThemeId].label} is a dark-only theme.
                </Text>
              ) : isCustomActive ? (
                <Text style={styles.modeHint}>
                  Custom themes are dark only.
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <CreateThemeModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
      />
    </>
  );
}

const createStyles = (theme: Theme) => {
  const C = theme.colors;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    sheet: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "85%",
      backgroundColor: C.card,
      borderRadius: theme.cardRadius,
      borderWidth: 1,
      borderColor: C.cardBorder,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.cardBorder,
      gap: 12,
    },
    title: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: C.text,
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: C.textSecondary,
      marginTop: 4,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: theme.buttonRadius,
      backgroundColor: C.backgroundTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      padding: 14,
    },
    groupLabel: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: C.textMuted,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    themeTile: {
      width: "48.5%",
      flexDirection: "column",
      borderWidth: 1,
      borderRadius: theme.buttonRadius,
      padding: 8,
      gap: 8,
    },
    themePreviewRow: {
      flexDirection: "row",
      gap: 6,
    },
    themePreview: {
      flex: 1,
      height: 54,
      borderRadius: theme.innerRadius,
      borderWidth: 1,
      padding: 6,
      justifyContent: "center",
    },
    themePreviewCard: {
      borderRadius: theme.innerRadius,
      borderWidth: 1,
      paddingVertical: 6,
      paddingHorizontal: 8,
      gap: 4,
    },
    themePreviewBar: {
      height: 3,
      borderRadius: 1,
    },
    themeTileInfo: {
      gap: 2,
    },
    themeTileLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    themeTileLabel: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      flexShrink: 1,
    },
    themeTileSub: {
      fontSize: 10,
      fontFamily: "Inter_400Regular",
      color: C.textSecondary,
    },
    themeTileBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 4,
    },
    themeTileBadgeText: {
      fontSize: 9,
      fontFamily: "Inter_600SemiBold",
      color: C.textSecondary,
      letterSpacing: 0.3,
    },
    customTintDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderRadius: theme.buttonRadius,
      paddingVertical: 11,
      marginBottom: 4,
    },
    createBtnText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 0.3,
    },
    modeRow: {
      flexDirection: "row",
      gap: 8,
    },
    modeButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderRadius: theme.buttonRadius,
      paddingVertical: 10,
    },
    modeButtonText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 0.5,
    },
    modeHint: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 8,
      fontStyle: "italic",
    },
  });
};
