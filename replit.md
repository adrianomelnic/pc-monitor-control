# PC Monitor & Control — Mobile App

## Project Overview
iOS/Android Expo app that connects directly to PC agents over local WiFi (HTTP port 8765). Users run `pc_agent.py` on each Windows PC; the app monitors live system metrics and sends control commands.

## Key Features
- Real-time CPU, GPU, RAM, Fan, Disk, Network monitoring via HWiNFO64
- **Editable dashboard**: show/hide built-in cards, reorder them, add custom sensor cards
- **Built-in card editing**: long-press any card to rename, toggle individual fields/sensors, hide fans/disks/interfaces, add any HWiNFO64 sensor — all fields (built-in AND extra sensors) are fully reorderable with up/down arrows in a unified edit panel. Every field label is also editable (tap label in edit panel → inline TextInput).
- **Hero layouts**: GPU, CPU, and RAM cards show a big percentage number on the left with detail stats on the right (hero section). When "usage" is hidden, hero detail fields fall through to normal row rendering.
- **Temperature badges**: Extra HWiNFO64 sensors of type "temperature" auto-display as temp badges in the card header (like built-in CPU/GPU temps). Supports multiple badges (e.g. two DIMM temps on a RAM card).
- **Field ordering**: `fieldOrder?: string[]` in `BuiltinCardConfig` stores custom field order per card; `getEffectiveFieldOrder()` merges stored order with defaults + extras, deduplicates, and handles missing keys
- **Field aliases**: `fieldAliases?: Record<string, string>` in `BuiltinCardConfig` stores custom labels for any field
- Custom sensor cards: pick any HWiNFO64 sensor (temp, voltage, power, clock, fan, usage…)
- PC controls: Sleep, Lock, Restart, Shutdown, remote terminal
- Per-PC layout persisted in AsyncStorage (survives app restarts)
- **Portrait & landscape support**: `app.json` orientation set to `"default"`; dashboard uses `useWindowDimensions` to switch to 2-column `flexWrap` grid when width >= 600px (landscape on tablets/phones); home screen FlatList uses `numColumns={2}` on wide screens

## Architecture
- Direct HTTP from phone to agent on port 8765 (no server middleman)
- `AbortController + setTimeout` for fetch timeouts (no AbortSignal.timeout — Expo compat)
- 12s silent background poll; pull-to-refresh shows spinner

## New Files (Dashboard Editor)
- `context/DashboardContext.tsx` — per-PC card layout (AsyncStorage-backed)
- `components/cards/SensorCard.tsx` — custom sensor card component
- `components/SensorPickerModal.tsx` — searchable HWiNFO64 sensor picker

## PC Agent Distribution (Task #34 — single-binary install)
- **End users get a single binary** built with PyInstaller. No Python install, no `pip`, no PowerShell, no `irm | iex`. They download `pc-agent.exe` (Windows) or `pc-agent` (macOS) and double-click.
- `build/pc-agent.spec` — PyInstaller spec, onefile, console-mode, with hidden imports for psutil + flask + flask-cors and per-OS psutil submodules. On Windows the spec also bundles every DLL it finds in `vendor/` (LibreHardwareMonitor — see Task #35) and adds `pythonnet`, `clr`, `clr_loader`, `clr_loader.netfx` to hidden imports.
- `.github/workflows/build-agent.yml` — CI matrix on `windows-latest` + `macos-latest`. Triggers on `v*` tag push; uploads `pc-agent-windows.exe` and `pc-agent-macos` to a GitHub Release. Pinned `LHM_VERSION` env var controls which LibreHardwareMonitor release to bundle.
- Stable download URLs hard-coded into the mobile app (renaming the release asset would break pairing):
  - `https://github.com/adrianomelnic/pc-monitor-control/releases/latest/download/pc-agent-windows.exe` — first release `v0.1.0` published Apr 26 2026, ~13.6 MB.
  - `https://github.com/adrianomelnic/pc-monitor-control/releases/latest/download/pc-agent-macos` — first release `v0.1.0` published Apr 26 2026, ~10 MB.
- **First release pipeline (Task #39).** `v0.1.0` was cut by tagging `refs/tags/v0.1.0` on `main` via the GitHub Git Data API (local `git push` is sandboxed). CI ran ~80 s end-to-end (windows-latest + macos-latest matrix → `softprops/action-gh-release@v2` upload). To cut a new release, push a fresh `v*` tag on a green `main` and the same workflow re-fires; no manual step needed. The classic PAT used to push must include both `repo` AND `workflow` scopes (writes to `.github/workflows/` are blocked otherwise).
- `pc_agent.py` `_ensure_admin()` is PyInstaller-aware: when `sys.frozen` is true, it forwards `sys.argv[1:]` (skipping the exe path itself) to the elevated re-launch.
- Mobile UX:
  - `components/AddPcSheet.tsx` Step 1 — Windows/macOS tab, big "Send download link to my PC" share button, QR code of the download URL, "Copy link" / "Open in browser" fallbacks, SmartScreen/Gatekeeper warning copy.
  - `app/setup.tsx` — short 4-step screen (Download / Double-click / Find IP / Add in app). The 700-line inlined `PYTHON_AGENT` string and the old `irm | iex` / `curl | bash` UI are gone.
- **Bundled-agent legacy (Phase A of offline pairing — Task #29)** is still wired in (`assets/agent/pc_agent.py` + `metro.config.js` + `lib/agentAssets.ts` + `pnpm run sync-agent` predev/prebuild hook) but no UI references it any more. Kept in place so a future "phone hosts the binary over HTTP" task (#30) can reuse the asset pipeline without re-plumbing it.

## Home-screen Online/Offline reliability
- `xhrGet` in `context/PcsContext.tsx` runs response bodies through `safeJsonParse`, which retries with `NaN`/`±Infinity` rewritten to `null`. Python's `json.dumps` (and Flask's `jsonify`) defaults to `allow_nan=True`, so a single unreadable hardware sensor would otherwise make `/metrics` unparseable on the phone and the card would stay on "Offline / Never connected" even though the agent's HTTP log showed a 200.
- `PcsProvider.applyUpdate(id, updates)` is the single merge point for every `fetchMetrics` result (used by `pollAll`, `refreshAll`, `addPc`, `addDemoMode`, `refreshPc`). It persists via `savePcs` only on **meaningful transitions** — first successful connection (`lastSeen` undefined → defined), status change (`connecting`↔`online`↔`offline`), `os` change, or `agentVersion` change — so a steady online PC polling every 2s does not write to AsyncStorage every poll. Persisting on `online → offline` captures the latest in-memory `lastSeen` so the offline card after an app restart shows the real "Last seen" timestamp instead of one from when the PC was first added. Previously `addPc` saved BEFORE the first poll resolved and the post-poll save never happened, so a phone restart wiped `lastSeen` and the card fell back to "Never connected" forever.
- `fetchMetrics` `catch` logs the actual reason (`Network error` / `Timeout` / `Parse error` / `HTTP 4xx`) under `__DEV__` AND surfaces it in the UI: the `PC` interface has a session-only `lastError?: string` field that captures the most recent failure reason and is cleared on every successful poll. `PCCard`'s offline subtitle shows `lastError` when present (taking precedence over the generic "Never connected"), so the difference between "agent unreachable on the LAN", "agent rejected our API key", "request timed out", and "agent returned malformed JSON" is visible at a glance — no debugger required. `lastError` is stripped by `savePcs` so it never leaks into AsyncStorage.
- Belt-and-suspenders on the agent side: `_collect_metrics()` in `pc_agent.py` runs the response payload through `_strip_non_finite()` (recursive walk that converts NaN / ±Infinity floats to `None`) before `jsonify`, so future PyInstaller builds can't ship a /metrics body that breaks JS `JSON.parse` — and third-party clients (curl, browsers, scripts) get valid standard JSON too. The sanitiser is at the response-assembly layer so it covers every value source (LHM sensors, HWiNFO64, psutil temps, nvidia-smi, ram_info, fans, disks, network) without per-reader patches. The `pnpm sync-agent` predev/prebuild hook in `artifacts/mobile/package.json` keeps `artifacts/mobile/assets/agent/pc_agent.py` byte-identical to the canonical root `pc_agent.py`.

## Sensor Pipeline (Task #35 — drop the HWiNFO64 install)
- **Bundled LibreHardwareMonitor.** On Windows the agent reads CPU/GPU/RAM temperatures, fan RPMs, voltages, currents, power, clocks, and load via `LibreHardwareMonitorLib.dll` called through `pythonnet`. The DLL ships inside the PyInstaller binary — end users install nothing extra. CI fetches the pinned net472 LHM release (`LHM_VERSION` env var in `build-agent.yml`, currently `0.9.4`) into `vendor/`, where `pc-agent.spec` picks it up.
- **`read_lhm()` + `read_sensors()` in `pc_agent.py`.** `read_lhm()` lazy-initialises an LHM `Computer` (CPU/GPU/Memory/Motherboard/Controller/Storage enabled) and walks all hardware on every poll, mapping LHM `SensorType` strings to the same `{label,value,unit,type,component}` shape `read_hwinfo64()` already produced. `read_sensors()` tries LHM first; on any failure (DLL missing, .NET runtime broken, kernel driver refused, pythonnet not installed in dev) it latches `_LHM_FAILED=True` and silently falls through to the existing HWiNFO64 reader. The rest of the agent (and the mobile app) sees a uniform sensor stream regardless of which source was used.
- **`PYTHONNET_RUNTIME=netfx`** is set inside `_init_lhm()` before importing `clr` so pythonnet binds to the .NET Framework runtime that ships with Windows 10 1803+ (matches the net472 LHM build we bundle). The DLL directory is also prepended to `PATH` so `HidSharp.dll` and other side-by-side deps resolve.
- **`/sensor_debug` endpoint** reports which source is active (`lhm` / `hwinfo64` / `none`) plus reading counts and a few sample temps/fans — handy for CI smoke tests and user troubleshooting.
- **Mobile UI is now source-agnostic.** All HWiNFO64-specific copy is gone: `FansCard.tsx` has no diagnosis button or 5-step HWiNFO64 setup blurb (just a generic "no fan sensors detected" empty state), `SensorPickerModal.tsx` says "No sensors detected", `SensorCard.tsx` says "Sensor data unavailable on this PC", and `pc/[id].tsx`'s extra-sensor picker title is "Add Sensor". The legacy `/hwinfo_debug` endpoint is kept on the agent side for backward compatibility but no UI calls it.
- **Limitations (carried forward).** I cannot run PyInstaller, pythonnet, or LHM from this Linux container, so the actual bundling, .NET interop, and WinRing0 driver loading have to be smoke-tested on the first GitHub Actions tag push. If pythonnet 3.x's hooks under PyInstaller hooks-contrib don't cover everything the LHM bridge needs, expect a follow-up to tweak `pc-agent.spec` or pin specific package versions.

## HWiNFO64 Integration
- Shared memory format: signature `{0x12345678, 0x53695748}`
- Label encoding: `raw[1] == 0` → UTF-16-LE; else → Latin-1
- Format auto-detection: `size_reading >= 500` → LBL_BYTES=256, VAL_OFF_BASE=556
- ALL sensor types now exposed: temp, voltage, fan, current, power, clock, usage
- Sensor types 0–8 mapped to units (°C, V, RPM, A, W, MHz, %)

## Design System — StreamLink (default)
- **Default theme**: "StreamLink" — neon green `#44D62C`, true black `#0A0A0A` bg, `#141414` card, `#2A2A2A` border, `SHAPE_TACTICAL` (radius 4, accentEdge "left")
- **Typography**: Inter (via `@expo-google-fonts/inter`) — `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` used throughout; Feather icons bundled via `...Feather.font` for Android
- **Section labels**: `fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 2`
- **Sheets**: `borderTopRadius: 12`, 36×4 handle pill, tint-color top border
- **Button text**: `#000` on tint-colored (green) buttons for contrast
- **Card accents**: CPU=`#44D62C`, GPU=`#00C2FF`, RAM=`#7C6FFF`, Thermals=`#FF6B35`, Fans=`#FFD23F`, Disks=`#00E5B5`, Network=`#40C4FF`, Sensor=`#C86FFF`
- **cpuRingColor**: now uses `theme.cardAccents.cpu` (was hardcoded per theme ID)
- **Multi-theme**: 9 themes total — streamlink (default), rog, classic, cyberpunk, matrix, ocean, sunset, nord, minimal
- **app.json**: `userInterfaceStyle: "dark"`, `splash.backgroundColor: "#0a0a0a"`
- **MetricRing**: `strokeLinecap="butt"` (sharp ends)

## Design System Files
- `constants/colors.ts` — StreamLink palette (flat single-export, matches `useColors()` contract)
- `hooks/useColors.ts` — returns StreamLink palette (used by bundle components)
- `context/GamepadContext.tsx` — no-op shim (satisfies imports from bundle components)
- `utils/sounds.ts` — no-op sound shim
- `components/Focusable.tsx` — gamepad-aware pressable wrapper
- `components/FocusableTextInput.tsx` — gamepad-aware text input
- `components/ControllerToast.tsx` — toast for controller connect/disconnect

---
# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
