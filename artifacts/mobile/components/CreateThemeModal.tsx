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
  TextInput,
  View,
} from "react-native";
import { buildCustomTheme, contrastForeground, Theme } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#FF1744", "#FF6D00", "#FFD600", "#00E676", "#00BCD4",
  "#2979FF", "#AA00FF", "#FF4081", "#76FF03", "#FF6F00",
  "#18FFFF", "#651FFF", "#F50057", "#00B0FF", "#69F0AE",
  "#FF3D00", "#EEFF41", "#1DE9B6", "#40C4FF", "#E040FB",
];

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

function isValidHex(s: string): boolean {
  return HEX_RE.test(s);
}

function normHex(s: string): string {
  const trimmed = s.trim();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  return trimmed;
}

export function CreateThemeModal({ visible, onClose }: Props) {
  const { theme, addCustomTheme, setThemeId } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const C = theme.colors;

  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [hexInput, setHexInput] = useState(PRESET_COLORS[0]);
  const [hexError, setHexError] = useState(false);

  const activeTint = isValidHex(normHex(hexInput)) ? normHex(hexInput) : selectedColor;

  const previewDef = useMemo(
    () => ({ id: "__preview", label: name || "My Theme", tint: activeTint, createdAt: 0 }),
    [name, activeTint]
  );
  const previewTheme = useMemo(() => buildCustomTheme(previewDef), [previewDef]);

  const handleSelectPreset = (color: string) => {
    Haptics.selectionAsync();
    setSelectedColor(color);
    setHexInput(color);
    setHexError(false);
  };

  const handleHexChange = (text: string) => {
    setHexInput(text);
    const normalized = normHex(text);
    if (isValidHex(normalized)) {
      setSelectedColor(normalized);
      setHexError(false);
    } else {
      setHexError(text.length > 0);
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter a name for your theme.");
      return;
    }
    const normalizedHex = normHex(hexInput);
    if (!isValidHex(normalizedHex)) {
      Alert.alert("Invalid color", "Please enter a valid hex color (e.g. #FF6D00).");
      return;
    }
    const newId = addCustomTheme(trimmedName, normalizedHex);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setThemeId(newId);
    handleClose();
  };

  const handleClose = () => {
    setName("");
    setSelectedColor(PRESET_COLORS[0]);
    setHexInput(PRESET_COLORS[0]);
    setHexError(false);
    onClose();
  };

  const pc = previewTheme.colors;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Create theme</Text>
              <Text style={styles.subtitle}>
                Pick a tint color — contrast is computed automatically.
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            >
              <Feather name="x" size={18} color={C.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.groupLabel}>Theme Name</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="e.g. Ocean Blue"
              placeholderTextColor={C.textMuted}
              value={name}
              onChangeText={setName}
              autoCorrect={false}
              maxLength={32}
              returnKeyType="done"
            />

            <Text style={styles.groupLabel}>Tint Color</Text>
            <View style={styles.presetGrid}>
              {PRESET_COLORS.map((color) => {
                const isSelected = selectedColor === color && activeTint === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => handleSelectPreset(color)}
                    style={({ pressed }) => [
                      styles.swatch,
                      { backgroundColor: color },
                      isSelected && styles.swatchSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {isSelected && (
                      <Feather
                        name="check"
                        size={14}
                        color={contrastForeground(color)}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.hexRow}>
              <View style={[styles.hexSwatch, { backgroundColor: activeTint }]} />
              <TextInput
                style={[
                  styles.hexInput,
                  hexError && { borderColor: C.danger },
                ]}
                placeholder="#RRGGBB"
                placeholderTextColor={C.textMuted}
                value={hexInput}
                onChangeText={handleHexChange}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                returnKeyType="done"
              />
              {hexError && (
                <Text style={styles.hexErrorText}>Invalid hex</Text>
              )}
            </View>

            <Text style={styles.groupLabel}>Preview</Text>
            <View
              style={[
                styles.preview,
                { backgroundColor: pc.background, borderColor: pc.cardBorder },
              ]}
            >
              <View
                style={[
                  styles.previewCard,
                  { backgroundColor: pc.card, borderColor: pc.cardBorder, borderLeftColor: pc.tint, borderLeftWidth: 3 },
                ]}
              >
                <View style={styles.previewCardHeader}>
                  <Text style={[styles.previewCardTitle, { color: pc.text }]}>
                    {name.trim() || "My Theme"}
                  </Text>
                  <View style={[styles.previewBadge, { backgroundColor: pc.tint }]}>
                    <Text style={[styles.previewBadgeText, { color: pc.tintForeground }]}>
                      ACTIVE
                    </Text>
                  </View>
                </View>
                <View style={styles.previewBars}>
                  <View style={[styles.previewBarFill, { backgroundColor: pc.tint, width: "72%" }]} />
                  <View style={[styles.previewBarFill, { backgroundColor: pc.tint + "55", width: "48%" }]} />
                  <View style={[styles.previewBarFill, { backgroundColor: pc.tint + "33", width: "90%" }]} />
                </View>
              </View>
              <View style={styles.previewColorRow}>
                <View style={[styles.previewDot, { backgroundColor: pc.tint }]} />
                <Text style={[styles.previewColorLabel, { color: pc.textSecondary }]}>
                  {activeTint.toUpperCase()}
                </Text>
                <Text style={[styles.previewColorLabel, { color: pc.textMuted }]}>
                  · Button text: {pc.tintForeground === "#000" ? "Black" : "White"}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.cancelBtnText, { color: C.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: activeTint },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Feather name="check" size={14} color={contrastForeground(activeTint)} />
              <Text style={[styles.saveBtnText, { color: contrastForeground(activeTint) }]}>
                Save & Apply
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: Theme) => {
  const C = theme.colors;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    sheet: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "90%",
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
      gap: 0,
    },
    groupLabel: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: C.textMuted,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 12,
    },
    nameInput: {
      backgroundColor: C.backgroundSecondary,
      borderWidth: 1,
      borderColor: C.cardBorder,
      borderRadius: theme.buttonRadius,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: C.text,
    },
    presetGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    swatchSelected: {
      borderWidth: 2.5,
      borderColor: C.text,
    },
    hexRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 2,
    },
    hexSwatch: {
      width: 32,
      height: 32,
      borderRadius: theme.buttonRadius,
      borderWidth: 1,
      borderColor: C.cardBorder,
    },
    hexInput: {
      flex: 1,
      backgroundColor: C.backgroundSecondary,
      borderWidth: 1,
      borderColor: C.cardBorder,
      borderRadius: theme.buttonRadius,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: C.text,
      letterSpacing: 0.5,
    },
    hexErrorText: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: C.danger,
    },
    preview: {
      borderWidth: 1,
      borderRadius: theme.cardRadius,
      padding: 10,
      gap: 8,
    },
    previewCard: {
      borderRadius: theme.innerRadius,
      borderWidth: 1,
      padding: 10,
      gap: 8,
    },
    previewCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    previewCardTitle: {
      fontSize: 12,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    previewBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
    },
    previewBadgeText: {
      fontSize: 9,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.8,
    },
    previewBars: {
      gap: 5,
    },
    previewBarFill: {
      height: 4,
      borderRadius: 2,
    },
    previewColorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    previewDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    previewColorLabel: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: C.cardBorder,
      gap: 8,
    },
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: theme.buttonRadius,
    },
    cancelBtnText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: theme.buttonRadius,
    },
    saveBtnText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.3,
    },
  });
};
