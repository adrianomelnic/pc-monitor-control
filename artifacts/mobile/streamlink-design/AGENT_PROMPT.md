# Apply the StreamLink Design System to this app

You're receiving an exported design system from another Expo / React Native
app called **StreamLink**. Your job: make this app look visually identical to
StreamLink — same dark theme, neon-green accent, Inter typography, 4px
corners, sharp focus model — **without changing what this app does**. All
existing features, screens, navigation, and data flow must keep working;
only the visual layer changes.

## Where the bundle lives

The user has dropped a folder called `streamlink-design/` somewhere in the
project (most likely the project root, or under `attached_assets/`). Find it
first:

```bash
find . -type d -name "streamlink-design" -not -path "*/node_modules/*"
```

Inside it you'll find:

- `README.md` — the full design-system spec. Read it end-to-end before
  touching code.
- `files/constants/colors.ts` — the colour palette.
- `files/hooks/useColors.ts` — the hook every component should use.
- `files/components/*.tsx` — shared components (Focusable, FocusableTextInput,
  AppActionSheet, ControllerToast, ErrorBoundary, ErrorFallback,
  KeyboardAwareScrollViewCompat).
- `files/app/_layout.reference.tsx` — reference root layout showing the font
  / splash / Stack pattern to merge into your existing `app/_layout.tsx`.

## Step-by-step instructions

### 1. Read the spec

Open `streamlink-design/README.md` and read it fully. It defines colours,
typography, spacing, layout patterns, component recipes, the focus model,
iconography, and a verification checklist. **Do not skip this step** — the
spec is the source of truth, this prompt is just the task list.

### 2. Install required dependencies

Add to the Expo project (use the versions matching the project's Expo SDK):

```
@expo-google-fonts/inter
@expo/vector-icons
expo-router
expo-splash-screen
react-native-safe-area-context
react-native-gesture-handler
```

Optional, only if not already present and you want the same provider stack:
`@tanstack/react-query`, `expo-haptics`, `expo` (for `reloadAppAsync`).

### 3. Copy the bundle files into the project

Verbatim copy:

| From | To |
| --- | --- |
| `streamlink-design/files/constants/colors.ts` | `constants/colors.ts` |
| `streamlink-design/files/hooks/useColors.ts` | `hooks/useColors.ts` |
| `streamlink-design/files/components/Focusable.tsx` | `components/Focusable.tsx` |
| `streamlink-design/files/components/FocusableTextInput.tsx` | `components/FocusableTextInput.tsx` |
| `streamlink-design/files/components/AppActionSheet.tsx` | `components/AppActionSheet.tsx` |
| `streamlink-design/files/components/ControllerToast.tsx` | `components/ControllerToast.tsx` |
| `streamlink-design/files/components/ErrorBoundary.tsx` | `components/ErrorBoundary.tsx` |
| `streamlink-design/files/components/ErrorFallback.tsx` | `components/ErrorFallback.tsx` |
| `streamlink-design/files/components/KeyboardAwareScrollViewCompat.tsx` | `components/KeyboardAwareScrollViewCompat.tsx` |

If the project uses a different path alias than `@/`, search-and-replace the
imports inside each copied file.

### 4. Provide the GamepadContext shim (if needed)

`Focusable`, `FocusableTextInput`, `AppActionSheet`, and `ControllerToast`
import from `@/context/GamepadContext` and `@/utils/sounds`. The bundle does
**not** ship those because they are tied to StreamLink's controller layer.
If this app does not need full gamepad navigation, create a no-op shim at
`context/GamepadContext.tsx` and `utils/sounds.ts` exactly as shown in
section 9 of the README. With the shim in place every component renders and
behaves correctly for touch users; the focus ring just never appears.

### 5. Wire up `app/_layout.tsx`

Merge the patterns from `_layout.reference.tsx` into your existing
`app/_layout.tsx`. Specifically:

- Load Inter weights `400 / 500 / 600 / 700` via `useFonts`.
- Spread `...Feather.font` into the same `useFonts` call (required so
  Feather glyphs render on Android).
- Call `SplashScreen.preventAutoHideAsync()` at module import.
- Call `SplashScreen.hideAsync()` from a `useEffect` once fonts are loaded
  or errored.
- Wrap the tree in `SafeAreaProvider` → `ErrorBoundary` → your data
  providers → `GestureHandlerRootView` → your app providers → routes.
- Set the root `<Stack>` `screenOptions`:
  ```ts
  { headerShown: false, contentStyle: { backgroundColor: "#0a0a0a" } }
  ```
- Keep the existing route declarations.

### 6. Update `app.json`

Set:

```json
{
  "expo": {
    "userInterfaceStyle": "dark",
    "splash": {
      "backgroundColor": "#0a0a0a"
    }
  }
}
```

Leave the rest of `app.json` (name, slug, scheme, bundle ids, icon, splash
image) alone — those belong to **this** app, not StreamLink.

### 7. Restyle every screen with the tokens

Walk through every existing screen and:

- Replace hard-coded colours with `useColors()` tokens (`background`, `card`,
  `border`, `foreground`, `mutedForeground`, `primary`, etc.).
- Replace hard-coded font weights with the `Inter_…` family strings.
- Use the spacing scale (`4 / 8 / 10 / 12 / 14 / 16 / 20 / 24`).
- Set every `borderRadius` to `4` (cards, buttons, inputs, chips). The only
  exception is action sheets, which use `12` on the top corners only.
- Use 1px `colors.border` hairlines instead of shadows.
- Wrap every interactive element in `<Focusable>` so the focus ring works.
- Replace bare `<TextInput>` with `<FocusableTextInput>`.
- Replace bottom-sheet menus with `<AppActionSheet>` (or a sheet built from
  the same recipe in README § 6.6).
- Apply `opacity: 0.5` to any disabled row / card / button.

### 8. Apply the layout patterns

Use the patterns from README § 5 for screen headers (38×38 back + centered
15 / 700 title + 38 spacer), section labels (11 / 600 / `letterSpacing: 2`,
uppercase), responsive grids (compute column count from `useWindowDimensions`),
and bottom toolbars.

### 9. Keep functionality intact

Do **not** rip out features, change navigation paths, rewrite data flow, or
modify any business logic. This is a restyling task. If you have to refactor
a component to extract its presentation, keep the props and behaviour
identical.

## Verification

Before reporting done, confirm against the checklist in README § 13:

- [ ] Background is true black `#0a0a0a` everywhere; no white flash on
      route transitions.
- [ ] Inter 400 / 500 / 600 / 700 renders (not the platform default).
- [ ] Feather icons render on Android (no missing-glyph rectangles).
- [ ] Cards have `#141414` fill + 1px `#2a2a2a` border + `radius: 4`.
- [ ] Switches show greenDim track + green thumb when on.
- [ ] Status dots render at 7×7 with the right colour; `connecting` pulses.
- [ ] Action sheets slide in from the bottom with 12px top corners.
- [ ] If a controller is plugged in, focused elements draw a 2px green ring
      flush with their corners.

When everything ticks, the app should feel like it shipped from the same
studio as StreamLink.
