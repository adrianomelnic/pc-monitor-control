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
- **Release history:** `v0.6.0` (Apr 29 2026) — CPU accuracy fix (background sampler), system tray + autostart + self-update (Windows), windowed .exe. `v0.6.1` (Apr 29 2026) — hotfix: `import threading as _threading` moved to module top-level; the `_cpu_sampler` setup at line 137 fired before the deferred import, crashing the PyInstaller windowed binary with `NameError: name '_threading' is not defined`. `v0.6.2` (Apr 29 2026) — hotfix: disk read/write speed always 0. `psutil.disk_io_counters(perdisk=True)` returns `"C:"` on Windows 5.9+ and `"sda1"` (no `/dev/`) on Linux/macOS. Old code stripped the colon → `"C"` which never matched. New code tries all plausible key formats (`"C:"`, `"C"`, `"sda1"`, raw device, mountpoint). `v0.6.3` (Apr 29 2026) — network virtual-interface filter added to agent (`_is_virtual_iface()` mirrors the app's existing NetworkCard filter); concurrent-request race condition on `_prev_time`/`_prev_net_io`/`_prev_disk_io` globals fixed with `_io_state_lock`; network speed display switched to Mbps/Gbps (OTA). `v0.6.4` (Apr 29 2026) — hotfix: disk read/write speed still 0 on Windows 10/11. Root cause: `psutil.disk_io_counters(perdisk=True)` uses the Windows Physical Disk performance counter, returning compound keys like `"0 D:"` or `"1 C:"` (disk-index + letter). None of our drive-letter candidates (`"C:"`, `"C"`, etc.) matched. New `_build_vol_to_key()` normaliser tokenises every key, extracts all drive-letter tokens, and builds a lookup table that handles all known formats: compound `"0 C:"`, plain `"C:"`, bare `"C"`, and POSIX `"sda1"`. `v0.6.5` (Apr 30 2026) — added aggregate I/O fallback in `get_disks()`: if per-disk key matching fails entirely, fall back to `disk_io_counters(perdisk=False)` total split evenly across unmatched disks; added `/disk_io_debug` endpoint (no auth) that exposes raw psutil keys and partition-to-key resolution to diagnose key-format issues. `v0.6.6` (Apr 30 2026) — **confirmed fix**: `/disk_io_debug` revealed psutil on this machine returns `"PhysicalDrive0"` / `"PhysicalDrive1"` keys with no drive letters at all. Added `_win_physdrive_to_vol_map()` that queries `wmic path Win32_LogicalDiskToPartition` (with PowerShell `Get-CimInstance` fallback) to build `{"PhysicalDrive0": ["D:"], "PhysicalDrive1": ["C:"]}` map; result cached 5 min. `_build_vol_to_key()` now uses this map to resolve `"PhysicalDrive0"` → `"D:"` so candidate matching in `get_disks()` succeeds. `v0.6.7` (Apr 30 2026) — Fixed two post-update restart bugs: (1) `_install_update()` now writes a small PowerShell launcher (`Start-Process`) invoked by the batch file instead of `start ""`, so the new exe inherits no PyInstaller env vars (`_MEIPASS`, `_MEIPASS2RTHLPTH`) from the old process tree — preventing the "Failed to load Python DLL" DLL-not-found crash on first launch after an in-place update. (2) Increased batch-file delay from 3 s to 5 s for extra AV/filesystem headroom. (3) PyInstaller spec: `runtime_tmpdir="."` on Windows — extracts the bundled archive next to the exe instead of `%TEMP%`, so Defender scans it once on first run instead of rescanning on every launch. (4) Added `/` Flask route — dark status page with version, port, and links to all API endpoints; fixes the "Not Found" error when using "Open dashboard" from the tray. (5) CI fix: `p.read_text(encoding="utf-8")` + `p.write_text(new, encoding="utf-8")` in the version-stamp step — the default CP1252 codec on Windows runners choked on UTF-8 em-dashes already present in `pc_agent.py` comments. `v0.6.8` (Apr 30 2026) — Re-tagged after CI encoding fix; GPU voltage filter broadened in mobile app: `isGpuComponent(s.component)` fallback accepts any voltage/power sensor whose `component` contains `nvidia|geforce|radeon|intel arc|\bgpu\b`, so LHM "GPU Core" voltage sensors (where the label is the function name, not "voltage") now match for NVIDIA RTX cards.
- `pc_agent.py` `_ensure_admin()` is PyInstaller-aware: when `sys.frozen` is true, it forwards `sys.argv[1:]` (skipping the exe path itself) to the elevated re-launch.
- Mobile UX:
  - `components/AddPcSheet.tsx` Step 1 — Windows/macOS tab, big "Send download link to my PC" share button, QR code of the download URL, "Copy link" / "Open in browser" fallbacks, SmartScreen/Gatekeeper warning copy.
  - `app/setup.tsx` — short 4-step screen (Download / Double-click / Find IP / Add in app). The 700-line inlined `PYTHON_AGENT` string and the old `irm | iex` / `curl | bash` UI are gone.
- **Bundled-agent legacy (Phase A of offline pairing — Task #29)** is still wired in (`assets/agent/pc_agent.py` + `metro.config.js` + `lib/agentAssets.ts` + `pnpm run sync-agent` predev/prebuild hook) but no UI references it any more. Kept in place so a future "phone hosts the binary over HTTP" task (#30) can reuse the asset pipeline without re-plumbing it.

## Home-screen Online/Offline reliability
- `xhrGet` in `context/PcsContext.tsx` runs response bodies through `safeJsonParse`, which retries with `NaN`/`±Infinity` rewritten to `null`. Python's `json.dumps` (and Flask's `jsonify`) defaults to `allow_nan=True`, so a single unreadable hardware sensor would otherwise make `/metrics` unparseable on the phone and the card would stay on "Offline / Never connected" even though the agent's HTTP log showed a 200.
- `PcsProvider.applyUpdate(id, updates)` is the single merge point for every `fetchMetrics` result (used by `pollAll`, `refreshAll`, `addPc`, `addDemoMode`, `refreshPc`). It persists via `savePcs` only on **meaningful transitions** — first successful connection (`lastSeen` undefined → defined), status change (`connecting`↔`online`↔`offline`), `os` change, or `agentVersion` change — so a steady online PC polling every 2s does not write to AsyncStorage every poll. Persisting on `online → offline` captures the latest in-memory `lastSeen` so the offline card after an app restart shows the real "Last seen" timestamp instead of one from when the PC was first added. Previously `addPc` saved BEFORE the first poll resolved and the post-poll save never happened, so a phone restart wiped `lastSeen` and the card fell back to "Never connected" forever.
- `fetchMetrics` `catch` logs the actual reason (`Network error` / `Timeout` / `Parse error` / `HTTP 4xx`) under `__DEV__` AND surfaces it in the UI: the `PC` interface has a session-only `lastError?: string` field that captures the most recent failure reason and is cleared on every successful poll. `PCCard`'s offline subtitle shows `lastError` when present (taking precedence over the generic "Never connected"), so the difference between "agent unreachable on the LAN", "agent rejected our API key", "request timed out", and "agent returned malformed JSON" is visible at a glance — no debugger required. `lastError` is stripped by `savePcs` so it never leaks into AsyncStorage.
- **Single-flight polling** in `PcsProvider` via the `inFlight` Set — every `/metrics` request goes through `pollOne(pc)`, which no-ops if a fetch is already pending for that PC. This eliminates the request burst that fires after `addPc` (StrictMode replays the setState updater + the `[pcs.length]` `useEffect` calls `pollAll` + the user's manual refresh tap), which used to stack 3–5 simultaneous `/metrics` calls against the agent. `addPc` and `addDemoMode` now call `pollOne` *outside* the `setPcs` updater so the first poll fires once instead of twice under StrictMode. The user-symptom this fixes: home card stuck on "Offline / Timeout" after Add even though the in-form "Test" button (a single XHR) succeeds and renders the CPU model — same endpoint, same payload, but Test never produces concurrent requests so it never tripped the agent's LHM thread-safety bug.
- **Agent-side LHM thread lock** (`pc_agent.py`, `_LHM_LOCK = threading.Lock()`): `LibreHardwareMonitor`'s `Computer` object holds .NET / WMI / SMBus state that is **not** thread-safe — two concurrent `_LHM_COMPUTER.Accept(_LHM_VISITOR)` calls from Flask request threads race the visitor traversal via pythonnet and both threads hang indefinitely (which the mobile timeout interpreted as a network failure). Flask's `app.run` defaults to `threaded=True`, so any client doing parallel polling (the mobile app's StrictMode burst, `curl` in a tight loop, a browser opening multiple tabs) reproduced the deadlock. Serializing the full `Accept` + walk + `Hardware` iteration behind a single process-wide lock fixes this for every client, not just the mobile app — which matters because the agent is a public local-network HTTP service that third-party scripts can hit. The mobile single-flight is the immediate-relief patch (lands on app reload, no PC-side install needed); the agent lock is the durable fix that ships with the next agent release.
- Belt-and-suspenders on the agent side: `_collect_metrics()` in `pc_agent.py` runs the response payload through `_strip_non_finite()` (recursive walk that converts NaN / ±Infinity floats to `None`) before `jsonify`, so future PyInstaller builds can't ship a /metrics body that breaks JS `JSON.parse` — and third-party clients (curl, browsers, scripts) get valid standard JSON too. The sanitiser is at the response-assembly layer so it covers every value source (LHM sensors, HWiNFO64, psutil temps, nvidia-smi, ram_info, fans, disks, network) without per-reader patches. The `pnpm sync-agent` predev/prebuild hook in `artifacts/mobile/package.json` keeps `artifacts/mobile/assets/agent/pc_agent.py` byte-identical to the canonical root `pc_agent.py`.

## System tray, autostart, and update check (Windows agent UI)
- The Windows .exe ships **windowed** (no console window) — `build/pc-agent.spec` sets `console=(sys.platform != "win32")`. The user-facing surface is a system tray icon (`pystray` + `Pillow`, registered in the spec's hidden imports + installed via the new "Install tray UI deps" CI step). macOS keeps the console window for now since there's no tray UI on that platform yet.
- Tray menu (rebuilt by `pystray` on every right-click via `lambda` text/`checked=` callbacks, so status reflects live state):
  - `PC Monitor Agent v{VERSION}` (header, disabled)
  - `Status: listening on port {PORT}` (header, disabled)
  - Live update status: "Checking…" / "Up to date (vX.Y.Z)" / "Update available: vX.Y.Z" / "Update failed: …"
  - "Open dashboard" — `webbrowser.open(http://localhost:{PORT}/)`
  - "Install update v{X}" / "Check for updates" — same menu item, label flips based on whether a newer release was detected; clicking when an update is available downloads it and self-replaces the .exe; clicking otherwise re-runs the GitHub poll on demand.
  - "Open releases page" — manual fallback if auto-install fails or the user wants to read the changelog first.
  - "Start with Windows" (checkable) — toggles `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\PCMonitorAgent`. Value points to `sys.executable` when frozen, or `pythonw <script>` when running from source (so logging in doesn't pop a console).
  - "Show log file" — opens `%LOCALAPPDATA%\PCMonitorAgent\agent.log`.
  - "Quit"
- Update check runs in a daemon thread on startup and then every hour (`UPDATE_CHECK_INTERVAL_SEC = 3600`). It hits `https://api.github.com/repos/adrianomelnic/pc-monitor-control/releases/latest`, parses `tag_name`, and compares to `AGENT_VERSION` via `_version_tuple()` (lossy semver: ignores pre-release suffixes, fine for "is the GitHub tag bigger than what's installed?"). Network errors surface as the status string instead of being silently swallowed.
- Self-update flow (`_install_update`):
  1. Download `pc-agent-windows.exe` from the latest GitHub release to `pc-agent.new` next to the running .exe (same volume so the subsequent `move /y` is atomic).
  2. Sanity-check size (>1 MB) so a 404 HTML page doesn't get installed as the new binary.
  3. Write a small `.bat` next to the .exe that `timeout /t 3` (waits for our process to exit so the .exe isn't locked), `move /y pc-agent.new pc-agent.exe`, `start "" pc-agent.exe` (relaunch detached), then `del "%~f0"` (self-delete).
  4. `subprocess.Popen` the batch with `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP`, then `os._exit(0)` so the move can succeed.
  Runs in a worker thread so the tray UI doesn't freeze during download. `_update_in_progress` re-entry guard prevents the user from double-triggering.
- Threading model: Flask runs in a daemon thread (`_run_tray_mode`'s `threading.Thread(... app.run ..., daemon=True)`); the tray icon owns the main thread because pystray's Win32 backend requires it (calling `Icon.run()` from a worker thread silently does nothing on Windows). When the user picks Quit, `icon.stop()` returns from `Icon.run()` and the process exits — Flask dies with it because it's a daemon thread.
- Logging: in windowed mode, `sys.stdout` / `sys.stderr` are `None` (the bootloader has no console to attach to), so every `print()` would raise. `_setup_file_logging()` redirects both to `%LOCALAPPDATA%\PCMonitorAgent\agent.log` with `buffering=1` (line-buffered) before the first `print` runs, so the existing log lines (`PC Agent starting on port 8765`, LHM init failures, firewall-rule additions, etc.) all end up tail-able from the tray menu.

## PC detail screen — floating bottom nav, long-press card-arrange, settings sheet (Task #43)
- **Header is name-only.** `app/pc/[id].tsx`'s top header now contains only the PC name + status dot/text + the optional "Agent vX.Y.Z" sub-row with the inline "Update to vY.Y.Z" warning pill. The old `headerRow2` action row (sliders / terminal / power / droplet) and the back arrow inside `headerRow1` were removed; their functions all moved to the floating bottom nav. `agentVersionRow`'s 44 px back-button indent was removed accordingly.
- **Floating bottom nav.** A pill positioned at `insets.bottom + 12` (rendered as a sibling of the `ScrollView` inside `pageContainer`, with `pointerEvents="box-none"` so taps fall through to scroll content where the pill isn't) holds: back · vertical divider · shell · power · settings. Shell + power are dimmed (`C.textMuted`) and `disabled` when `pc.status !== "online"`; the underlying `togglePanel` call is also gated. The active panel button gets a tinted background and `C.tint` icon. ScrollView `paddingBottom` was bumped from `32 + bottomPad` to `110 + bottomPad` so the last card clears the pill.
- **Long-press → global arrange mode.** `handleLongPress` in `renderCardContent` (built-in cards) now calls `setEditMode(true)` instead of opening the per-card inline edit. For custom cards, `SensorCard` got an optional `onLongPressOverride` prop that, when supplied, replaces the internal `setInlineEdit(true)` call — `[id].tsx` passes one that also enters arrange mode. While in `editMode`, the bottom nav swaps to a single tinted "Done" pill (`donePill` style) that exits the mode and clears `inlineEditBuiltin` / `titleInputActive`.
- **Per-card field editing in arrange mode.** Built-in cards in arrange mode get a new pencil button in `EditBar` (between the down-chevron and the custom-card-only block) that calls `setInlineEditBuiltin(card.kind)` to open the rename / reorder / hide / replace-fields panel. Custom cards continue to use the existing edit-2 button that opens the full picker modal — both kinds of cards now have field-level editing reachable without long-pressing twice.
- **Settings sheet.** `components/PCSettingsSheet.tsx` is a centered modal sheet (max width 480, max height 85%) opened by the gear button in the bottom nav. Sections: **About** (App version + PC Agent version + optional "Update available" banner); **Display** (hide-nav-in-landscape + hide-nav-in-portrait toggles); **Sensor Source** (per-PC toggle: Auto / LHM / HWiNFO64 — see below); **PC Agent** (collapsible install guide). The home-screen droplet and its `<ThemePickerModal>` modal + `themeVisible` state were removed from `app/index.tsx`; theme switching is now reachable only via the per-PC settings sheet.

## Per-PC sensor source toggle
- `PC.sensorPreference?: "auto" | "lhm" | "hwinfo64"` — persisted to AsyncStorage (not stripped by `savePcs`).
- `fetchMetrics` in `PcsContext.tsx` appends `?source={pref}` to `/metrics` when pref is not "auto".
- `pc_agent.py`: `/metrics` reads `request.args.get("source", "auto")` and passes it through to `_collect_metrics(source)` → `read_sensors(source)`.
- `read_sensors(source)`: "auto" = LHM → HWiNFO64 fallback (original); "lhm" = LHM only; "hwinfo64" = HWiNFO64 only.
- UI: `PCSettingsSheet` shows a "Sensor Source" radio list (Auto / LHM / HWiNFO64) for non-demo PCs. `pc/[id].tsx` passes `sensorPreference={pc.sensorPreference}` and `onChangeSensorPreference={(pref) => updatePc(pc.id, { sensorPreference: pref })}`.
- Use case: users whose NVIDIA RTX 3080 Ti exposes GPU voltage/power via HWiNFO64 but not via LHM's NVAPI path can switch to HWiNFO64-only.

## GPU + RAM card section-aware edit panels
- `GPUCard.tsx` exports `effectiveSectionOfGpu(key, sectionOf)`: "usage" → hero; stored override → use it; "vram" / "bar:*" → bottom; else → stats.
- `RAMCard.tsx` exports `effectiveSectionOfRam(key, sectionOf)`: "usage" → hero; stored override → use it; "bar" / "swap" / "bar:*" → bottom; else → stats.
- Both cards read `cardEdit?.sectionOf` and replace the hardcoded `isBelowKey` check with `effSection(k) === "bottom"`.
- Both cards handle `bar:` keys in `renderRightField` → compact label + pct + `MiniBar` (height 2), same as CPUCard.
- Both cards have a fallback in `belowOrder.map` for stat rows moved to Bottom: renders via `renderRightField` wrapped in a `belowSection` View.
- `BuiltinCardEditPanel` in `[id].tsx` handles `card.kind === "gpu"` and `card.kind === "ram"` with the same **Header/Hero/Stats/Bottom** layout as the CPU card (reusing `cpuSectionHeader` and the `sectionMoveBadge` styles). GPU and RAM cards now have a HEADER section with an "Add temp badge" button identical to the CPU card's — any sensor of type `temperature` added there is stored in `extraSensors` and rendered as a coloured badge in the card header via `CardBase`. `gpuTempKeys`/`ramTempKeys` are derived from `extraTempSet` and excluded from Stats/Bottom to prevent double-rendering. `moveGpuSection`/`moveRamSection` also exclude temp keys from the movable set and re-include them in `fieldOrder` so drags don't erase them. The flat `DraggableFieldList` fallback is now only reached by Thermals/Network/Storage/Disks (Fans now has its own 2-section layout — see below).

## Fans card HEADER section — pinned temp badges
- `BuiltinCardConfig` in `DashboardContext.tsx` has a `headerSensors?: string[]` field (separate from `extraSensors`) that stores temperature sensors pinned to the Fans card's title bar as coloured badges.
- `addFanHeaderSensor` / `removeFanHeaderSensor` helpers in `[id].tsx` read/write `headerSensors` via `updateBuiltinCard`.
- The `cardEdit` build block in `[id].tsx` appends sensors from `headerSensors` to the `extraTemps` array (same shape CPU/GPU/RAM use) when `card.kind === "fans"`, so `FansCard` renders them as header badges through the existing `CardBase` `extraTemps` prop.
- `BuiltinCardEditPanel` for `card.kind === "fans"` now renders a 2-section layout:
  - **HEADER** — lists each `headerSensor` as a non-draggable row with label, live °C value, and a × remove button. Empty state shows hint text. "Add temp badge" button opens `CompactSensorPicker` filtered to temperature sensors (`fanHeaderPickerMode` state, analogous to `cpuHeaderTempMode`).
  - **Sensors** — the existing flat `DraggableFieldList` for fan/extra-sensor rows, unchanged.
- `fanHeaderPickerMode` state gates the picker's `sensors` filter and `excludeLabels` (already-pinned header sensors), and routes `onSelect` to `addFanHeaderSensor` instead of `addExtraSensor`.
- The "Add temp" button that previously triggered `setCpuHeaderTempMode(true)` for fans is superseded by the new HEADER section button, which now correctly sets `fanHeaderPickerMode` instead.

## CPU card section-aware edit panel (Task #47)
- `BuiltinCardEditPanel` in `[id].tsx` detects `card.kind === "cpu"` and renders a 4-section layout instead of the flat drag list used by other cards:
  - **HEADER** — extra temperature sensors the user has added. These render as coloured badges in the card's title bar. Shows a hint text when none are added: "CPU Package temp is auto-detected. Add a temperature sensor below for extra header badges."
  - **HERO** — the "usage" row rendered non-draggably (long-press has no effect); the user can still toggle visibility, rename, or swap the sensor via the ↺ button.
  - **STATS** — draggable stat rows (voltage, wattage, freq, core counts…). Each row has a **↓ BOTTOM** move badge that immediately moves the row down to the Bottom section and rebuilds `fieldOrder`.
  - **BOTTOM** — draggable visualisation rows (perCore, cpuBar, bar:* sensors). Each has a **↑ STATS** badge that moves it up to Stats.
- Section moves update both `sectionOf: Record<string, "stats" | "bottom">` (stored in `BuiltinCardConfig`) and `fieldOrder` in a single `updateBuiltinCard` call.
- `effectiveSectionOf(key, sectionOf)` (exported from `CPUCard.tsx`) computes a key's section: "usage" → "hero"; stored override → use it; perCore/perCoreVertical/cpuBar/bar:* → "bottom"; else → "stats". `CPUCard` reads `cardEdit.sectionOf` to route rows into `rightFields` (stats) or `belowOrder` (bottom) in its render.
- `sectionOf` is passed through `cardEdit` in `renderCardContent` (`cardEdit.sectionOf = builtinCard.sectionOf`) and stored in `BuiltinCardEdit` (CardBase.tsx) and `BuiltinCardConfig` (DashboardContext.tsx).
- `renderDragRow(key, drag, isActive, extraAction?)` now accepts an optional `extraAction` node rendered between the label and the ↺ button — used by both bar-sensor rows and regular-sensor rows to inject the move badge without duplicating row layout code.
- New styles: `cpuSectionHeader`, `cpuSectionLine`, `cpuSectionEmpty`, `cpuSectionEmptyText`, `sectionMoveBadge`, `sectionMoveBadgeText`.

## CPU card bug fixes (session — four issues)
- **Eye icon / hidden-field mismatch**: `BuiltinCardEditPanel` previously built its `hidden` set from an empty `new Set<string>()` for non-thermals cards when `hiddenFields` is undefined; `CPUCard` defaults to hiding `["perCore","cpuBar","physicalCores","logicalCores"]`. The two defaults disagreed so the edit panel showed those fields as visible (eye active) while the card rendered them as hidden. Fix: added `DEFAULT_HIDDEN_FIELDS` and `getDefaultHiddenForKind()` at module scope in `[id].tsx`; both `BuiltinCardEditPanel` (hidden set) and `toggleBuiltinField` (initial `startingHidden` array) now start from those defaults when `hiddenFields` is undefined. CPUCard's own fallback is unchanged (defence-in-depth for preview/storybook usage without a card edit context).
- **Only 8 per-core bars on Intel hybrid CPUs**: LHM only exposes `"CPU Core #N"` load sensors for P-cores (e.g. 8 sensors on an i9-13900K with 24 logical cores). `pc_agent.py` now guards the LHM override with `len(lhm_per_core) >= max(cores_logical // 2, 1)` — if LHM gives fewer entries than half the logical count it keeps psutil's full per-core array, which covers all logical cores via the Windows performance counters.
- **CPU usage sensor swap ignored**: The hero `<Text>{Math.round(cpu.usageTotal)}%</Text>` in `CPUCard` reads `cpu.usageTotal` directly and never sees `extraMap["usage"]` (which is the formatted override string, not a raw number). Fix: in `[id].tsx`'s `case "cpu":` block a `cpuUsageSensor` lookup is performed alongside the existing voltage/power lookups; `augCpu.usageTotal` is overridden with the raw sensor value before `CPUCard` receives the props. This mirrors the existing voltage/power augmentation pattern.
- **CPU frequency always at rated base clock (3.50 GHz)**: `psutil.cpu_freq().current` reads the static frequency from the Windows registry and never reflects actual running speed. Added **PowerShell `(Get-CimInstance Win32_Processor).CurrentClockSpeed`** as fallback step 4 (after the LHM/HWiNFO64 clock sensor chain). WMI queries the hardware registers for this value so it varies with boost/turbo state. Also lowered the idle-core clock filter from `> 500 MHz` to `> 100 MHz` so lightly-loaded P-cores that park at ~800 MHz aren't discarded. `freqMax` falls back to `freq_current_mhz` instead of `0` when all sensor sources are absent.

## Storage card: per-drive temperature badges + editable
- `DisksCard.tsx`: each disk item now reads `extraMap["disktemp:<deviceKey>"]` (a formatted "49.0°C" string set via `sensorSource`) and `parseFloat()`s it to get an override temperature. `displayTemp` is the override if present, otherwise `disk.temperature` from the agent. The `TempBadge` renders for any disk that has either source — not just the first drive.
- `[id].tsx` edit panel: each disk row now shows a **thermometer button** (Feather `thermometer` icon) in addition to the standard swap/remove buttons. Tapping it sets `replacingBuiltinField = { kind: "disks", key: "disktemp:<deviceKey>" }` and opens the `CompactSensorPicker` filtered to temperature sensors only (`diskTempPickerMode` state). Selecting a sensor calls `updateSensorSource("disks", "disktemp:<deviceKey>", sensorLabel)` which persists the choice in `BuiltinCardConfig.sensorSource`. On the next render the existing `sensorSource → extraSensorMap` injection (lines 1476–1480) converts the live sensor value to a formatted string which `DisksCard` then parses for display. Drives where neither the agent reports a temperature nor the user has assigned one show no badge.

## GPU voltage / power sensor matching
- `artifacts/mobile/app/pc/[id].tsx` matches LHM voltage/power sensors to the GPU card by **either** label keyword OR `component` keyword (NVIDIA / GeForce / AMD / Radeon / Intel Arc / generic "gpu"). LHM names voltage sensors by their function ("GPU Core") and stores the GPU model in `component` ("NVIDIA GeForce RTX 3080 Ti"), so the previous label-only regex never matched and the GPU card always showed "—". Now any voltage sensor whose component is recognizably a GPU is picked up — the same fix applies to GPU power, where labels like "GPU Package" similarly didn't match the old `/gpu.*power/i` regex. Caveat: if LHM 0.9.4 doesn't expose voltage at all for a given NVIDIA card (consumer NVAPI restrictions on RTX 30xx/40xx), the value stays "—" — there's no agent-side workaround for missing hardware telemetry.

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

## Custom theme light mode support
- `buildCustomTheme(def, mode)` in `constants/themes.ts` now accepts a `ResolvedMode` parameter (default `"dark"`). When `mode === "light"` it generates a light-background palette (`#F5F5F5` bg, `#FFFFFF` card, `#111111` text) with the same user-chosen tint for all accents. Dark mode output is unchanged.
- `ThemeContext.resolvedMode`: built-in themes still force-dark unless `builtinDef.light` is defined; **custom themes now pass `requestedMode` directly** so the global Light/Dark/Auto setting applies to them too.
- `resolveAnyTheme` passes `resolvedMode` to `buildCustomTheme` so the live theme reflects the current mode.
- `ThemePickerModal`: mode buttons are no longer disabled when a custom theme is active; the "Custom themes are dark only." hint is removed; the mini preview thumbnail in the custom theme tile shows both a light and a dark swatch side by side (same as built-in tiles that have a light variant).
- `CreateThemeModal`: preview section now has a small Dark / Light toggle so users can see how their chosen tint looks on both backgrounds before saving.

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
