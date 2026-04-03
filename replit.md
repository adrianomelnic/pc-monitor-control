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

## Architecture
- Direct HTTP from phone to agent on port 8765 (no server middleman)
- `AbortController + setTimeout` for fetch timeouts (no AbortSignal.timeout — Expo compat)
- 12s silent background poll; pull-to-refresh shows spinner

## New Files (Dashboard Editor)
- `context/DashboardContext.tsx` — per-PC card layout (AsyncStorage-backed)
- `components/cards/SensorCard.tsx` — custom sensor card component
- `components/SensorPickerModal.tsx` — searchable HWiNFO64 sensor picker

## HWiNFO64 Integration
- Shared memory format: signature `{0x12345678, 0x53695748}`
- Label encoding: `raw[1] == 0` → UTF-16-LE; else → Latin-1
- Format auto-detection: `size_reading >= 500` → LBL_BYTES=256, VAL_OFF_BASE=556
- ALL sensor types now exposed: temp, voltage, fan, current, power, clock, usage
- Sensor types 0–8 mapped to units (°C, V, RPM, A, W, MHz, %)

## Colors
CPU=#00D4FF, GPU=#34D399, RAM=#A78BFA, Fans=#FB923C, Disk=#2DD4BF, Network=#60A5FA

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
