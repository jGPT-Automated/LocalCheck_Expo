# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project is **LocalCheck** — a street sports discovery and ELO ranking mobile app.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (ready for backend routes)
- **Database**: PostgreSQL + Drizzle ORM (provisioned, schema-ready)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with Expo Router
- **Mobile fonts**: Oswald 700 + Inter (via @expo-google-fonts)
- **Map**: react-native-maps v1.18.0 (pinned for Expo Go compatibility)
- **Mobile state**: React Context + AsyncStorage

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo mobile app (LocalCheck)
│       ├── app/
│       │   ├── (tabs)/     # Tab screens: Map, Feed, Explore, My ELO
│       │   ├── court/[id]  # Court profile
│       │   └── run/[id]    # Game run lobby
│       ├── components/     # Reusable UI components
│       ├── constants/      # Colors, typography, sample data
│       ├── context/        # AppContext (global state + AsyncStorage)
│       └── assets/images/  # AI-generated icons + placeholders
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── README.md               # Full project documentation
├── ACTIVITY_LOG.md         # Development decisions and design choices
└── ...
```

## LocalCheck App — Feature Summary

- **Home / Map**: Full-screen map with precise GPS-pinned circular court markers. List view toggle. Bottom sheet slide-up for court details. Platform-specific: react-native-maps on native, Mapbox GL on web.
  - **Circle Markers**: outline-only = confirmed court, filled orange = community court (5+ locals), dashed = pending AI verification
  - **Add Court Flow**: FAB button → GPS location drop → photo → AI verification (OpenAI GPT-4o vision) → confirmed pin added
  - **My Local Court**: tap "MY LOCAL" in bottom sheet to claim a court; 5 claims fills the pin orange
- **The Feed**: Community activity stream — check-ins, run results, new courts. Hype reactions with haptic feedback.
- **Explore**: Live courts list + city ELO leaderboard.
- **My ELO**: Animated rank display, win/loss stats, match history. Tier system: BRONZE/SILVER/GOLD/PLATINUM.
- **Court Profile**: Editorial layout, live roster, upcoming runs, check-in.
- **Game Run**: Lobby with Team A vs B columns. ELO balancing toggle. Win/loss recording.

## AI Integration

- **OpenAI via Replit AI Integrations**: Court photo verification endpoint (`POST /api/courts/verify`)
  - Env vars: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-set)
  - Uses `gpt-5-mini` with vision for image analysis
  - Returns `{ verified, confidence, reason }`

## Court Data Model

Courts now have:
- `status: "pending" | "confirmed" | "community"` — drives pin visual
- `localCount: number` — number of users who set it as their local court
- `addedBy?: string` — who added the court
- `verificationPhoto?: string` — photo URI used for AI verification

## Design System

- **Primary**: `#000000` (absolute black)
- **Background**: `#FFFFFF` (stark white)
- **Surface**: `#F4F4F4` (secondary cards)
- **Accent**: `#DFFF00` (volt green — live states, actions)
- **Fonts**: Oswald 700 (headings/stats) + Inter (body)
- **Style**: Zero border-radius, 1px solid black borders, no shadows

## Database Strategy (Modular)

Currently uses AsyncStorage for local persistence. The PostgreSQL + Drizzle ORM layer is ready. To add server-side persistence:
1. Define schemas in `lib/db/src/schema/`
2. Add routes in `artifacts/api-server/src/routes/`
3. Update `lib/api-spec/openapi.yaml` + run codegen
4. Replace AsyncStorage with React Query hooks

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native app. All screens in `app/`. Components in `components/`. State in `context/AppContext.tsx`.

- Entry: `app/_layout.tsx` — providers (SafeAreaProvider, QueryClient, AppProvider, GestureHandler, KeyboardProvider)
- Tab nav: `app/(tabs)/_layout.tsx` — NativeTabs (iOS 26) with classic Tabs fallback
- `pnpm --filter @workspace/mobile run dev` — run Expo dev server
- Maps: `react-native-maps` v1.18.0 (pinned). Platform-split via `.web.tsx` extension.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
