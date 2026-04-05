---
name: svg-icons
description: >-
  Add custom SVG icon files to the Expo mobile app's icon picker. Use when the
  user uploads SVG files and wants them available as selectable icons in the
  sensor/custom card icon picker. Covers installing SVG support, converting SVG
  files to React Native components, and registering them in the icon picker.
enabled: true
---

# Custom SVG Icons in Expo

This skill adds user-provided SVG files as selectable icons in the sensor card icon picker (`ThermalsCard.tsx` / `SensorCard.tsx`).

## Step 1 — Install SVG Support (once per project)

Check if already installed:
```bash
grep -r "react-native-svg" artifacts/mobile/package.json
```

If not present, install:
```bash
pnpm --filter @workspace/mobile add react-native-svg
pnpm --filter @workspace/mobile add -D react-native-svg-transformer
```

Configure Metro to handle `.svg` files. Edit (or create) `artifacts/mobile/metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
```

Add SVG type declaration so TypeScript accepts `.svg` imports. Create `artifacts/mobile/declarations.d.ts`:
```ts
declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
```

Restart the Expo workflow after these changes.

## Step 2 — Save SVG Files

Copy uploaded SVG files into:
```
artifacts/mobile/assets/icons/custom/
```

Name them with lowercase kebab-case, e.g. `water-pump.svg`, `gpu-block.svg`.

Clean up SVG files before saving:
- Remove `width` and `height` root attributes (let the component control size)
- Keep `viewBox` attribute on the root `<svg>` element
- Remove any `<title>` or `<desc>` elements if they cause issues
- Ensure paths use only `fill` or `stroke`, not both inconsistently

## Step 3 — Create the Custom Icon Registry

Create `artifacts/mobile/components/icons/CustomIcons.tsx`:
```tsx
import WaterPump from '../../assets/icons/custom/water-pump.svg';
import GpuBlock from '../../assets/icons/custom/gpu-block.svg';
// add more imports here

export type CustomIconName =
  | 'custom:water-pump'
  | 'custom:gpu-block';
  // extend as needed

const CUSTOM_ICON_MAP: Record<CustomIconName, React.FC<{ width?: number; height?: number; color?: string }>> = {
  'custom:water-pump': WaterPump,
  'custom:gpu-block': GpuBlock,
};

export function renderCustomIcon(
  name: CustomIconName,
  size: number,
  color: string
) {
  const Icon = CUSTOM_ICON_MAP[name];
  if (!Icon) return null;
  return <Icon width={size} height={size} color={color} fill={color} />;
}

export const CUSTOM_ICON_NAMES = Object.keys(CUSTOM_ICON_MAP) as CustomIconName[];
```

## Step 4 — Register in the Icon Picker

In `artifacts/mobile/components/cards/ThermalsCard.tsx`:

1. Import the registry:
```ts
import { CUSTOM_ICON_NAMES } from '../icons/CustomIcons';
```

2. Add a "Custom" category to `SENSOR_ICON_OPTIONS`:
```ts
{ label: 'Custom', icons: CUSTOM_ICON_NAMES },
```

3. Update `renderSensorIcon` to handle the `custom:` prefix:
```ts
import { renderCustomIcon, type CustomIconName } from '../icons/CustomIcons';

export function renderSensorIcon(icon: string, size: number, color: string) {
  if (icon.startsWith('custom:')) {
    return renderCustomIcon(icon as CustomIconName, size, color);
  }
  if (icon.startsWith('mci:')) {
    return <MaterialCommunityIcons name={icon.slice(4) as any} size={size} color={color} />;
  }
  return <Feather name={icon as any} size={size} color={color} />;
}
```

## Step 5 — Icon Picker Preview

The existing icon picker in `ThermalsCard.tsx` renders icons using `renderSensorIcon`, so custom icons appear automatically once registered. No changes needed to the picker UI itself.

## SVG Compatibility Notes

- React Native SVG does **not** support all SVG features. Unsupported: `<filter>`, CSS animations, `clip-path` on text, `foreignObject`.
- Supported: `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`, `<g>`, `<defs>`, `<use>`, `<mask>`, `<linearGradient>`, `<radialGradient>`.
- If an icon has complex filters or effects, simplify it in Figma/Inkscape before exporting.
- Single-color icons work best — pass `fill={color}` so they tint to match the card accent color.
- If an SVG uses `currentColor`, it will automatically inherit the `color` prop.

## Troubleshooting

| Problem | Fix |
|---|---|
| SVG renders as blank | Check `viewBox` is present on root `<svg>` |
| TypeScript error on `.svg` import | Ensure `declarations.d.ts` exists and is included in `tsconfig.json` |
| App crashes on SVG import | Unsupported SVG feature — simplify the file |
| Icon doesn't tint | Add `fill="currentColor"` to all `<path>` elements in the SVG |
| Metro doesn't pick up `.svg` | Restart the Expo workflow after editing `metro.config.js` |

## File Locations Summary

```
artifacts/mobile/
  assets/icons/custom/        ← SVG files go here
  components/icons/
    CustomIcons.tsx            ← registry + renderCustomIcon
  components/cards/
    ThermalsCard.tsx           ← add custom: prefix to renderSensorIcon + picker
  metro.config.js              ← SVG transformer config
  declarations.d.ts            ← SVG TypeScript type
```
