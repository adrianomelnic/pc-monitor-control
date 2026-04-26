# StreamLink Design System

A self-contained export of the StreamLink Expo / React Native design system.
Drop this bundle into another Expo project and the receiving agent can make
that app look visually identical to StreamLink — same dark theme, neon-green
accent, Inter typography, 4px corner radius, controller-friendly focus model.

> Only the **visual / interaction** design transfers. None of StreamLink's
> domain logic (game streaming, Steam API, host pairing, NVENC, etc.) is
> included.

---

## 1. Visual identity at a glance

| Aspect | Value |
| --- | --- |
| Background | True black (`#0a0a0a`) — never grey, never tinted |
| Accent | Neon green `#44D62C` for primary actions, focus, online status |
| Surfaces | `#141414` cards on `#0a0a0a` background |
| Borders | 1px `#2a2a2a` hairlines — preferred over shadows on dark UI |
| Corner radius | `4` everywhere (cards, buttons, inputs, chips) |
| Typography | Inter (400 / 500 / 600 / 700) |
| Iconography | `@expo/vector-icons` Feather, line-style only |
| Disabled state | `opacity: 0.5`, no other change |
| Focus model | Spatial D-pad / controller navigation, 2px green focus ring |

The look is intentionally restrained: dark, flat, sharp corners, single accent
colour. The neon green should appear sparingly so it always reads as "this is
interactive / active / online".

---

## 2. Color palette

All tokens live in `files/constants/colors.ts` and are read through the
`useColors()` hook in `files/hooks/useColors.ts`. The palette is **dark only**;
`useColorScheme()` is consulted but there is no light counterpart shipped.

| Token | Hex | Use |
| --- | --- | --- |
| `background` | `#0a0a0a` | Root screen background, splash, Stack `contentStyle` |
| `foreground` | `#e8e8e8` | Primary text on background |
| `card` | `#141414` | Card / sheet / panel surfaces |
| `cardForeground` | `#e8e8e8` | Text inside cards |
| `primary` | `#44D62C` | Primary buttons, focus ring, key indicators |
| `primaryForeground` | `#000000` | Text on primary buttons |
| `secondary` | `#1a1a1a` | Secondary buttons, switch off-track |
| `secondaryForeground` | `#e8e8e8` | Text on secondary surfaces |
| `muted` | `#1e1e1e` | Quiet panel surfaces, input fill |
| `mutedForeground` | `#6b6b6b` | Captions, subtitles, disabled-feel labels |
| `accent` | `#44D62C` | Same as primary; second alias for highlight uses |
| `accentForeground` | `#000000` | Text on accent surfaces |
| `destructive` | `#ff3b30` | Destructive button bg, error text |
| `destructiveForeground` | `#ffffff` | Text on destructive surfaces |
| `border` | `#2a2a2a` | All 1px hairlines, card borders, dividers |
| `input` | `#1e1e1e` | TextInput background |
| `online` | `#44D62C` | Status dots: connected / online |
| `offline` | `#444444` | Status dots: offline |
| `connecting` | `#f59e0b` | Status dots: pending (paired with pulse animation) |
| `hudBg` | `rgba(0,0,0,0.75)` | Overlays, in-stream HUD |
| `hudText` | `#44D62C` | HUD label text |
| `green` | `#44D62C` | Same hex as primary; semantic alias |
| `greenDim` | `#1a3d12` | Switch on-track, subtle highlight wash |
| `greenGlow` | `rgba(68,214,44,0.15)` | Soft glow halo behind focus / activation |
| `radius` | `4` | Universal corner radius (number, not a colour) |

Always read colours via `useColors()` rather than importing `colors` directly,
so callers stay honest about the dark-mode contract.

---

## 3. Typography

Family: **Inter** (loaded via `@expo-google-fonts/inter`). Four weights:

| Weight | Family string |
| --- | --- |
| Regular | `Inter_400Regular` |
| Medium | `Inter_500Medium` |
| SemiBold | `Inter_600SemiBold` |
| Bold | `Inter_700Bold` |

### Common scale

| Size | Weight | Usage |
| --- | --- | --- |
| 22 | Bold | App / brand wordmark, `letterSpacing: 3` |
| 20 | Bold | Empty-state titles, large screen headers, `letterSpacing: 0.5` |
| 16 | SemiBold | Action-sheet primary options, prominent inline text |
| 15 | Bold | Centered screen-header title, `letterSpacing: 0.3` |
| 15 | Medium | Setting-row labels, input value text |
| 14 | Regular / SemiBold | Body copy, secondary buttons |
| 13 | SemiBold | Chip text, small button labels |
| 13 | Medium / Regular | Body, helper text, dashed-border CTA |
| 12 | Regular / Medium | Subtitles, supporting text under labels |
| 11 | SemiBold | All-caps section labels — `letterSpacing: 2`, uppercase |

### Letter-spacing rules

- Brand wordmark: `letterSpacing: 3`.
- All-caps section labels (the small `SETTINGS`, `HOSTS` style banners):
  `letterSpacing: 2`, weight 600.
- Centered screen-header titles: `letterSpacing: 0.3`.
- Empty-state titles: `letterSpacing: 0.5`.
- Toast / pill labels: `letterSpacing: 0.4`.
- Body text: no letter-spacing.

### Disabled text

Wrap the row, not the text, in `opacity: 0.5`. Don't tint the colour.

---

## 4. Spacing scale

| Step | Used for |
| --- | --- |
| 4 | Hairline gaps, tiny vertical adjustments |
| 6 | Inline gap between status dot and label |
| 8 | Icon-to-label gap, chip-to-chip gap, fine padding |
| 10 | Compact button padding, secondary gaps |
| 12 | Card-to-card gap, row gap inside groups |
| 14 | Vertical row padding inside cards |
| 16 | Card horizontal padding, screen padding on mobile |
| 20 | Screen edge padding when content needs more breathing room |
| 24 | Section break above an all-caps label (`paddingTop: 24`) |

The 4px baseline holds: every value is divisible by 2 and most by 4.

---

## 5. Layout patterns

### 5.1 Screen header

```
┌────────────────────────────────────────────────────┐
│  [38×38 back]    Centered Title (15 / 700)    [38] │
└────────────────────────────────────────────────────┘
                     1px border-bottom
```

```ts
header: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 16,
  paddingBottom: 12,
  borderBottomWidth: 1,
  gap: 12,
},
headerTitle: {
  flex: 1,
  textAlign: "center",
  fontSize: 15,
  fontFamily: "Inter_700Bold",
  letterSpacing: 0.3,
},
iconBtn: {
  width: 38,
  height: 38,
  borderRadius: 4,
  alignItems: "center",
  justifyContent: "center",
},
```

The right-side spacer is a 38×38 empty `View` so the title stays optically
centered when only a back button exists on the left.

### 5.2 Section labels

All-caps banners that introduce a card group:

```ts
sectionHeader: {
  fontSize: 11,
  fontFamily: "Inter_600SemiBold",
  letterSpacing: 2,
  paddingHorizontal: 20,
  paddingTop: 24,
  paddingBottom: 8,
  textTransform: "uppercase",
  color: colors.mutedForeground,
},
```

### 5.3 Cards

Cards are the workhorse surface: `#141414` fill, 1px `#2a2a2a` border,
`radius: 4`, no shadow.

```ts
card: {
  marginHorizontal: 16,
  borderRadius: 4,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.card,
  overflow: "hidden",
},
```

### 5.4 Responsive grids

- Host / device cards: 1 column on phones, 2 on tablets portrait, 3 on tablets
  landscape. Compute via the `useWindowDimensions()` hook and the breakpoints
  `< 600` / `< 900` / otherwise.
- Tile grids (game library, app library): 2 columns on small phones, 3–4 on
  large phones, 5–6 on tablets portrait, 7–8 on tablets landscape. Drive the
  count from `Math.floor(width / TARGET_TILE_WIDTH)` clamped to the range.
- Grid gap: `10–12` between tiles, matching the card border weight.

### 5.5 Bottom toolbar

A persistent 1-row bar pinned to the bottom of certain screens. Pattern:

- `flexDirection: "row"`, evenly spaced focusable buttons.
- 1px top border in `colors.border`.
- `paddingHorizontal: 16`, `paddingVertical: 12`, plus `insets.bottom` from
  `useSafeAreaInsets()`.
- Icon (Feather, 18) above 11px SemiBold all-caps label, both colour-shifted
  to `colors.green` when the button represents the active screen.

### 5.6 Modal presentation via Expo Router

Use `presentation: "modal"` on the route declaration so secondary screens
(e.g. add-host, pair) slide up over the current stack with the dark Stack
`contentStyle` continuing through.

```tsx
<Stack.Screen name="some-modal" options={{ presentation: "modal" }} />
```

---

## 6. Component recipes

### 6.1 Buttons

Primary (solid green, dark text):

```ts
primaryBtn: {
  flexDirection: "row", alignItems: "center", justifyContent: "center",
  gap: 6,
  paddingHorizontal: 20, paddingVertical: 12,
  borderRadius: 4,
  backgroundColor: colors.primary,
},
primaryBtnText: {
  fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground,
},
```

Secondary (transparent fill, dashed or solid border):

```ts
secondaryBtn: {
  flexDirection: "row", alignItems: "center", justifyContent: "center",
  gap: 8,
  paddingVertical: 14,
  borderRadius: 4,
  borderWidth: 1, borderColor: colors.border,
  borderStyle: "dashed", // omit for a solid border variant
},
secondaryBtnText: {
  fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground,
},
```

Destructive (use sparingly, only for irreversible actions):

```ts
destructiveBtn: {
  ...primaryBtn,
  backgroundColor: colors.destructive,
},
destructiveBtnText: {
  ...primaryBtnText, color: colors.destructiveForeground,
},
```

Wrap every button in `<Focusable>` so a controller can step to it.

### 6.2 Cards

See § 5.3. For pressable cards (e.g. host tile):

```tsx
<Focusable focusId={`host-${id}`} group="hosts" onPress={open}>
  <View style={styles.card}>{/* ... */}</View>
</Focusable>
```

### 6.3 Inputs

```ts
input: {
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.input,
  borderRadius: 4,
  paddingHorizontal: 12, paddingVertical: 10,
  fontSize: 15, fontFamily: "Inter_500Medium",
  color: colors.foreground,
},
```

Use `<FocusableTextInput>` instead of bare `<TextInput>` so controller users
can A-press the field to open the soft keyboard and B-press to dismiss it.

### 6.4 Custom switches

The native `<Switch>` is themed via `trackColor` and `thumbColor`:

```tsx
<Switch
  value={value}
  onValueChange={onValueChange}
  trackColor={{ false: colors.secondary, true: colors.greenDim }}
  thumbColor={value ? colors.green : colors.mutedForeground}
/>
```

Wrap the entire row (icon + label + switch) in a `<Focusable>` whose `onPress`
toggles the value, so D-pad + A also works.

### 6.5 Status dots

A 7×7 circle in card headers / list rows:

```ts
statusDot: { width: 7, height: 7, borderRadius: 4 },
```

Colour mapping: `online → colors.online`, `offline → colors.offline`,
`connecting → colors.connecting`. While `connecting`, run an `Animated.loop`
that ramps `opacity` between `1` and `0.3` over 600 ms each direction with
`useNativeDriver: true`. See `app/index.tsx > StatusDot` for the full
pattern.

### 6.6 Action sheets

Bottom-aligned, slide-up modal with 12px top corners. The shipped
`AppActionSheet.tsx` is a complete template:

- `BorderTopLeftRadius / BorderTopRightRadius: 12` (the only place radius is
  not 4).
- `borderTopWidth / borderLeftWidth / borderRightWidth: 1` in `colors.border`.
- Background `#141414`.
- 36×4 grey "handle" pill centered at the top.
- Title block (15 / 700, `letterSpacing: 0.3`) + optional subtitle (12 / 400,
  `colors.mutedForeground`).
- Hairline divider (`StyleSheet.hairlineWidth`) between rows.
- Each row is a `<Focusable>` with `paddingHorizontal: 20`, `paddingVertical:
  16`, label in 16 / 600.
- Final "Cancel" row in `colors.mutedForeground`.
- Animations: spring slide on Y (0 ↔ 300, tension 80, friction 12) + 200 ms
  backdrop opacity fade.

---

## 7. Iconography

Single library: `@expo/vector-icons` → `Feather` family only. Sizes:

| Size | Use |
| --- | --- |
| 14 | Inline indicators next to small text (toast, pill) |
| 16 | Inline icons in setting rows / list rows |
| 18 | Bottom toolbar buttons, secondary navigation |
| 20 | Header buttons, modal close |
| 24 | Modal action affordances |
| 28 | Decorative / empty-state hero icons |

Always pass an explicit `color` from the palette — never rely on the default.

> Android requires the Feather TTF be registered with React Native's font
> manager. Spread `...Feather.font` into your `useFonts()` call (see the
> reference `_layout.tsx`). Without it every glyph renders as a missing
> rectangle.

---

## 8. Disabled state convention

Apply `opacity: 0.5` to the entire interactive container (the row, the card,
the button) and keep colours unchanged. Don't substitute a "disabled colour"
token — there isn't one.

```ts
<View style={[styles.row, disabled && { opacity: 0.5 }]}>{/* ... */}</View>
```

---

## 9. Controller / focus model

StreamLink is built for controllers. The shipped `Focusable` and
`FocusableTextInput` components register with a `GamepadContext` that the
shipped components import from `@/context/GamepadContext`.

> **Important:** the bundle does **not** ship a `GamepadContext`
> implementation, since that is StreamLink-specific and tied to the
> Moonlight gamepad layer. If your target app does not need full
> controller support, the simplest path is to ship a tiny shim at
> `context/GamepadContext.tsx` that exports no-op stubs:
>
> ```ts
> import React from "react";
>
> export type GamepadDirection = "up" | "down" | "left" | "right";
> export type FocusableEntry = {
>   id: string;
>   group?: string;
>   rect: { x: number; y: number; w: number; h: number };
>   onActivate: () => void;
>   onContext: () => void;
>   onSecondary: () => void;
>   ensureVisible: () => void;
>   setFocused: (v: boolean) => void;
>   route?: string;
>   edgeOverrides?: Partial<
>     Record<GamepadDirection, string | (() => string | null | undefined)>
>   >;
> };
>
> const noop = () => () => {};
> const ctx = {
>   register: (_e: Omit<FocusableEntry, "route">) => () => {},
>   controllerConnected: false,
>   controllerName: null as string | null,
>   controllerKind: null as string | null,
>   navigationSounds: false,
>   setKeyboardCaptureActive: (_v: boolean) => {},
>   pushBackHandler: (_h: () => boolean) => () => {},
>   pushFocusScope: (_g: string) => () => {},
> };
> export function useGamepad() { return ctx; }
> export function useFocusScroll() { return null as null | {
>   scrollRef: React.RefObject<unknown>;
>   topInset: number;
>   bottomInset: number;
>   horizontal?: boolean;
> }; }
> export function useGamepadBackHandler(_h: () => boolean, _enabled: boolean) {}
> export function scrollNodeIntoView(
>   _handle: number | null, _ref: unknown, _top: number, _bottom: number, _h?: boolean,
> ) {}
> ```
>
> With this shim the components render and behave correctly for touch users;
> the focus ring simply never appears (because `controllerConnected` is
> always `false`). When you later add real controller support, replace the
> shim with a full implementation modelled on StreamLink's.
>
> Likewise, `Focusable` imports `@/utils/sounds` for navigation sound
> effects (`Sounds.playActivate()`). Stub it as
> `export const playActivate = () => {};` if you don't need sounds.

The 2px green focus ring is drawn by `Focusable` itself when the controller
is connected and the element is focused. The ring's outer radius is
`ringRadius + 2` so its inner curve sits flush with the child's corners.

---

## 10. File-by-file inventory

Everything in `files/` is ready to copy verbatim into the corresponding folder
of the target Expo project. The components assume the standard Expo Router
layout with `@/` aliased to the project root in `tsconfig.json`'s
`compilerOptions.paths`.

| Source path in this bundle | Target path in your project |
| --- | --- |
| `files/constants/colors.ts` | `constants/colors.ts` |
| `files/hooks/useColors.ts` | `hooks/useColors.ts` |
| `files/components/Focusable.tsx` | `components/Focusable.tsx` |
| `files/components/FocusableTextInput.tsx` | `components/FocusableTextInput.tsx` |
| `files/components/AppActionSheet.tsx` | `components/AppActionSheet.tsx` |
| `files/components/ControllerToast.tsx` | `components/ControllerToast.tsx` |
| `files/components/ErrorBoundary.tsx` | `components/ErrorBoundary.tsx` |
| `files/components/ErrorFallback.tsx` | `components/ErrorFallback.tsx` |
| `files/components/KeyboardAwareScrollViewCompat.tsx` | `components/KeyboardAwareScrollViewCompat.tsx` |
| `files/app/_layout.reference.tsx` | merge into your existing `app/_layout.tsx` |

If your project's path alias is not `@/`, adjust the imports inside each
copied file accordingly.

`AppActionSheet.tsx` is somewhat StreamLink-specific (its variants assume
"running app" semantics). Treat it as a styling reference even if you do not
keep its API verbatim — the slide-up animation, handle, divider weights, row
padding, and Cancel-row pattern transfer to any sheet you build.

---

## 11. Required dependencies

Install these in the target Expo project (use the matching Expo SDK versions):

- `@expo-google-fonts/inter` — Inter 400 / 500 / 600 / 700
- `@expo/vector-icons` — Feather glyph set
- `expo-router` — file-based routing + Stack
- `expo-splash-screen` — controlled splash hide after fonts load
- `react-native-safe-area-context` — `useSafeAreaInsets`, `SafeAreaProvider`
- `react-native-gesture-handler` — `GestureHandlerRootView` (modal sheet
  gestures)

Optional, only if you also want the StreamLink data-layer / overlay stack:

- `@tanstack/react-query` — for `QueryClientProvider`
- `expo` — `reloadAppAsync` is used in `ErrorFallback.tsx`
- `expo-haptics` — only if you want the same haptic feedback on toggles

---

## 12. Things to replace with your own brand

This bundle is intentionally **brand-free**. None of the following StreamLink
assets are included; supply your own:

- App display name (do not call your app StreamLink).
- App icon PNGs (`assets/images/icon.png`, adaptive icon, etc.).
- Splash artwork. The splash background can stay `#0a0a0a` if you want
  StreamLink's exact look, but the splash image is yours.
- App scheme and bundle / package identifier in `app.json`.
- Any wordmark text (StreamLink uses an all-caps wordmark in 22 / 700 with
  `letterSpacing: 3` — feel free to mirror the styling for your own brand
  word).

Domain-specific copy ("Searching for PCs on your network", etc.) is also
StreamLink's; replace with your app's own copy.

---

## 13. Verification checklist

After integrating, the target app should pass:

- [ ] Background everywhere is true black `#0a0a0a` (no white flash on route
      transitions).
- [ ] Inter 400 / 500 / 600 / 700 is rendering (not the platform default).
- [ ] Feather icons render on **Android** (no missing-glyph rectangles).
- [ ] Cards have `#141414` fill + 1px `#2a2a2a` border + `radius: 4`.
- [ ] Switches show greenDim track + green thumb when on, secondary track +
      mutedForeground thumb when off.
- [ ] Status dots are 7×7 with the right colour, and the `connecting` state
      pulses opacity smoothly.
- [ ] Action sheets slide in from the bottom with 12px top corners and a
      36×4 handle pill.
- [ ] All-caps section labels render at 11 / 600 with `letterSpacing: 2`.
- [ ] Disabled rows show as `opacity: 0.5` without a colour change.
- [ ] If a controller is plugged in, focused elements draw a 2px green ring
      flush with their outer corners.
