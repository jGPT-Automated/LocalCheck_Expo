# LocalCheck — Activity Log

A running record of development decisions, design choices, and implementation notes.

---

## Session 3 — UI Fixes, Preferences, Leaderboard Clickability

**Date:** June 20, 2026
**Status:** Complete — all 6 tasks finished

### What Changed

**Bottom nav fix (T001):**
- Disabled `NativeTabs` entirely — `TabLayout` always returns `<ClassicTabLayout />`
- Full-width bar with orange active tint on all platforms (iOS, Android, Web)
- iOS uses SF Symbols + `BlurView` background; Android/Web uses Feather icons

**Sport/Court preferences (T002):**
- Added `preferredSport` and `preferredCourtId` to `AppContext`
- Persisted to `AsyncStorage` with keys `localcheck:preferredSport` and `localcheck:preferredCourtId`
- Added `setPreferredSport()`, `setPreferredCourtId()` async setters
- Preferences are nullable (tap to set, tap again to clear)

**Settings UI (T003):**
- New "SPORT PREFERENCES" section in Settings
- BB / PB pill toggles for preferred sport
- Court pills for all saved courts (tap to select/clear)
- Added below the Profile section, above Preferences

**Compete screen updates (T004):**
- Leaderboard players are now clickable — navigate to `/player/[id]` on tap
- Friend badge (green "FRIEND" label) shown on leaderboard rows for friends
- Scope renamed: "MY LOCAL" → "LOCAL", added "REGIONAL" (3 scopes: GLOBAL/REGIONAL/LOCAL)
- Default scope: LOCAL (was GLOBAL)
- Default sport filter: `preferredSport` (was ALL)
- Sport label: "BB" / "PB" (was "Ball" / "PB")
- Header subtitle shows local court name when LOCAL scope is active

**Log Game form reorganization (T005):**
- New order: Court → Sport → Opponent → Score → Notes
- Default court: `preferredCourtId` (fallback to `localCourtId`)
- Default sport: `preferredSport`
- Opponent dropdown: all players (no visibility filter)

**README update (T006):**
- Complete rewrite of README with all recent features documented
- Added architecture section for `AppContext` state model
- Added compete screen documentation (scope, filters, defaults, clickability)
- Added player profile screen documentation
- Added settings screen documentation
- Added navigation section (ClassicTabLayout decision)
- Added "Agent Onboarding Notes" section (10 rules for future development)
- Updated design tokens to reflect dark theme + orange accent

---

## Session 2 — Design Elevation + Mapbox Integration

**Date:** March 29, 2026  
**Status:** Complete — production-ready design pass

### What Changed

**Design direction:** Evolved from raw brutalism to "brutal modernism + futuristic" — same B&W/volt palette but now precision-engineered. Every screen feels intentional.

**Mapbox integration:**
- Web: Full `mapbox-gl` v3 implementation via CDN in `MapScreen.web.tsx`. Dark v11 style with custom volt-green marker DOM elements, sport-colored pulse dots, hover scale effects, and fly-to animation on court selection.
- Native: `react-native-maps` v1.18.0 (Expo Go compatible) + Mapbox Dark V11 `UrlTile` layer via token URL.
- Fallback: Clear "MAPBOX KEY NEEDED" state with instructions when token isn't set.
- Env var: `EXPO_PUBLIC_MAPBOX_TOKEN` — user needs to fill in from mapbox.com.

**New components:**
- `LivePulse` — animated pulsing dot for live indicators
- `StatBlock` — reusable stat/label block for data displays

**Color system expanded:**
- `surfaceDark: #0D0D0F` — for map/dark areas
- `card: #111116`, `border: #1C1C22` — dark card treatments
- `win: #00E87A`, `loss: #FF3B5C` — neon win/loss indicators
- `mutedDark: #444455` — for text on dark backgrounds

**Sports parity:** Basketball + Pickleball equally represented. Courts, runs, feed items, and leaderboard all support sport-specific color coding (`getSportColor`, `SPORT_ICONS`).

**ELO screen upgrade:**
- Black hero with massive animated counter (RAF-based, integer steps, eased)
- Tier progress bar animated via Animated.Value
- Win (neon green) / Loss (neon red) color-coded stats

**Feed upgrade:**
- Sport filter tabs (ALL / BASKETBALL / PICKLEBALL)
- Sport-colored accent line on each card
- Win/Loss result badges with color coding

**Explore upgrade:**
- "LIVE NOW" section with sport-colored left border bars
- Sport filter tabs mirroring Feed

### Technical Notes

- ELO counter animation uses `requestAnimationFrame` with manual easing (cubic ease-out) instead of Animated API to avoid floating-point rendering on web
- Mapbox markers are raw DOM elements inside `mapboxgl.Marker` — no React rendering overhead, maximum performance
- `CourtBottomSheet` uses spring animation for the slide-up and backdrop fade-in simultaneously

---

## Session 1 — Initial Build

**Date:** March 29, 2026  
**Status:** First build complete

---

### Project Kickoff

**Brief:** Build a mobile app called LocalCheck — a street sports discovery and reputation tracker inspired by the Nike High-Contrast design system. Users find active courts, check in, join game runs, and track ELO rankings.

**Design inspiration:** Nike SNKRS, Victory Journal  
**Device:** Mobile (iOS primary, Android + Web supported)  
**Design direction:** Stark editorial brutalism — heavy B&W, massive type, volt green accents

---

### Decision: Database Strategy — Frontend-First, Modular Backend

**Decision:** Build the first version with AsyncStorage (local device persistence) rather than a live database.

**Rationale:**
- The monorepo already includes a PostgreSQL + Drizzle ORM setup (`lib/db/`) and an Express API server (`artifacts/api-server/`)
- For a portfolio piece and initial build, local-first is faster to ship and easier to demo
- The architecture is explicitly modular — AsyncStorage can be swapped for real API calls by replacing context methods with React Query hooks without touching any UI code
- No risk of database connectivity issues during demos

**Future path:** When adding multiplayer/persistence, define schemas in `lib/db/src/schema/`, add Express routes, update the OpenAPI spec, run codegen, and replace `AsyncStorage` calls.

---

### Decision: Font Selection — Oswald + Inter

**Decision:** Use Oswald 700 Bold for all headings/stats and Inter for body text.

**Rationale:**
- Oswald is a condensed, high-impact grotesque that nails the brutalist editorial aesthetic from the design brief
- Pre-built Expo Google Fonts package (`@expo-google-fonts/oswald`) — no manual hosting needed
- Inter pairs cleanly with Oswald without competing; widely used in production mobile apps
- The design spec explicitly called for "Oswald, 700, 32–96px, all caps, tight letter spacing"

---

### Decision: Map Library — `react-native-maps` v1.18.0 (pinned)

**Decision:** Pin `react-native-maps` to exactly `1.18.0`.

**Rationale:**
- This is the only version currently compatible with Expo Go (per Expo documentation)
- Other versions cause crashes or compatibility errors in the Expo Go preview environment
- The app uses `PROVIDER_DEFAULT` (Apple Maps on iOS, Google Maps on Android) to avoid requiring a Maps API key for the initial build

**Note:** react-native-maps is NOT added to `app.json` plugins — doing so crashes the app in Expo Go.

---

### Decision: Tab Navigation — NativeTabs with Liquid Glass Fallback

**Decision:** Use `NativeTabs` from `expo-router/unstable-native-tabs` with an `isLiquidGlassAvailable()` check, falling back to classic `Tabs` with `BlurView`.

**Rationale:**
- iOS 26 supports liquid glass native tab bars — a major visual wow factor
- The fallback ensures Android, older iOS, and web all work correctly
- The tab bar uses a 2px solid black top border on non-iOS platforms to match the brutalist grid aesthetic

---

### Decision: Image Generation — AI-Generated Assets

**Decision:** Generate all placeholder/demo images via AI image generation rather than using stock photography or placeholder images.

**Assets generated:**
- `icon.png` — Minimalist athletic app icon: black bg, white checkmark/location pin hybrid, volt yellow accent
- `splash-icon.png` — Black splash with basketball silhouette + volt green accent ring
- `court-placeholder.png` — Aerial urban basketball court, B&W editorial style
- `player-placeholder.png` — Street basketball action shot, B&W editorial

**Rationale:** Aligns with the high-contrast monochromatic aesthetic. Avoids stock photo licensing concerns.

---

### Architecture Overview

**Context provider (`AppContext`):** Single source of truth for:
- `currentUser` — the logged-in player's stats/ELO
- `courts` — list of courts with live player counts
- `checkedInCourtId` — which court the user is currently checked into
- `runs` — scheduled game runs
- `feed` — community activity stream
- `matches` — ELO match history

**State persistence:** All mutable state uses `AsyncStorage` with per-key namespaced storage (`localcheck:<key>`). State is hydrated from storage on mount.

**Routing:** Expo Router file-based. Screens live in `app/`. Dynamic routes use `[id]` patterns. The tab group uses `(tabs)/` to group without affecting URLs.

---

### Component Design Principles

- **BrutalistButton:** Single reusable button with 4 variants (primary/accent/outline/ghost). Zero border-radius. All caps Oswald labels. Haptic feedback on press.
- **PlayerAvatar:** Square (not circular) avatar with initials. Reflects the "hard edges, no shadows" design rule.
- **CourtMarker:** Square map markers — black with white text. Selected state flips to volt green background + black text.
- **CourtBottomSheet:** Animated slide-up sheet (0.2s ease-out). Takes ~40% screen height. Contains stats, roster, and action buttons.
- **FeedCard:** Full-bleed image cards (300px) with dark overlay metadata bar at bottom.
- **MatchRow:** 1px border top/bottom. Color-coded WIN (green) / LOSS (red). ELO delta right-aligned.

---

### ELO Tier System

| ELO Range | Tier |
|-----------|------|
| 1900+ | PLATINUM |
| 1700–1899 | GOLD |
| 1500–1699 | SILVER |
| < 1500 | BRONZE |

Players need 5 games before receiving a rank (shows "UNRANKED. PLAY 5 MORE GAMES." state).

---

### Libraries Used

| Package | Version | Purpose |
|---------|---------|---------|
| `@expo-google-fonts/oswald` | ^0.4.2 | Oswald headings font |
| `@expo-google-fonts/inter` | pre-installed | Body text font |
| `react-native-maps` | 1.18.0 (pinned) | Court map display |
| `expo-haptics` | pre-installed | Haptic feedback on check-in |
| `@react-native-async-storage/async-storage` | installed | Local state persistence |
| `expo-blur` | pre-installed | Tab bar blur (iOS) |
| `expo-glass-effect` | pre-installed | Liquid glass tab detection |
| `@tanstack/react-query` | pre-installed | Server state (future use) |
| `react-native-safe-area-context` | pre-installed | Safe area insets |
| `react-native-gesture-handler` | pre-installed | Gesture support |

---

### Web Platform Handling

Per Expo skill guidelines, web-specific insets are applied:
- 67px top padding for header content (status bar)
- 34px bottom padding for nav bar
- Tab bar height set to 84px on web (50px + 34px)

Platform-specific code uses `Platform.OS === "web"` checks rather than trying to make all code universal.

---

### Next Steps (Future Sessions)

1. **Backend persistence** — Define Drizzle schemas for users, courts, check-ins, runs, feed items
2. **Real-time updates** — WebSocket or SSE for live player count updates on map markers
3. **Authentication** — Replit Auth integration for real user accounts
4. **Court photo uploads** — Camera integration to let users upload court photos
5. **Push notifications** — Alert when a friend checks into a nearby court
6. **Advanced ELO** — Proper Elo algorithm (K-factor based on game count + opponent delta)
7. **Host a Run** — Form for scheduling a game run at a specific court + time

---

## Session 4 — Deploy pipeline repair: TestFlight unblocked

**Date:** July 15, 2026
**Status:** Build path ✅ verified live · OTA path fix in flight

### What Changed

**Root cause of both broken EAS workflows (verified from worker logs, not guessed):**
- Every OTA publish since Jul 13 and both v1.0.1/v1.0.2 releases died at
  `pnpm install --frozen-lockfile`: EAS workers default to pnpm <10, which
  can't read this repo's `lockfileVersion: 9.0` lockfile
  (`ERR_PNPM_NO_LOCKFILE`) or its `pnpm-workspace.yaml` overrides — a pnpm-10
  feature (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`). Long "1h21m failures" were
  ~1h20m of free-tier queue ("searching for a worker") + seconds of real run.

**Fixes:**
- Merged PR #16 (Codex): pins `defaults.tools.pnpm: '10.13.1'` in both
  workflows, adds `packageManager` to root package.json, switches OTA job
  from `branch:` to `channel: production` + `environment: production`.
  Validated every key against the live EAS workflow JSON schema pre-merge.
- **v1.0.3 released**: tag created via GitHub API (local git pushes as an
  unauthorized user — gotcha recorded in playbook). Both jobs green —
  build 1.0.0 (6) built in ~5.5 min AND submitted to TestFlight (the step
  that killed v1.0.1/v1.0.2). Confirmed installed on Jesse's phone.
  **First OTA-eligible build.**
- OTA workflow's remaining failure diagnosed from its next live run: update
  workers default to Node 18; Metro 0.83 needs ≥20.19.4
  (`configs.toReversed is not a function`). Fix: pin
  `node: '20.19.4'` in `defaults.tools` (this commit).

**Docs:**
- New `docs/PLAYBOOK_DEPLOY.md` — full deploy procedure with verification
  gates, gotchas, forbidden actions (Devin-playbook format).
- New `DESIGN.md` — design-system snapshot (tokens from code, components,
  motion standards, do/don'ts).
- `README.md` — corrected to current architecture (Supabase, no AsyncStorage
  /sample data, real flows, doc index, DeepWiki badge) while keeping full depth.

### Environment notes
- Fresh local setup: `pnpm install --frozen-lockfile` clean on pnpm 10.33;
  lightningcss darwin binary copy still required (documented in README).
- App typecheck: 0 errors outside mockup-sandbox/elo.tsx pre-existing noise.

### Next
1. Verify OTA workflow green after the Node pin lands (this push triggers it).
2. Branch cleanup (9 merged/stale remotes).
3. MVP push: live court presence everywhere (Realtime + keyed queries),
   Explore court sheet rebuilt to spec, game loop verified end-to-end,
   notification scaffold, Me-page activity. Map redesign in parallel thread.

---

## Session 5 — MVP burn-down sprint 1: drawer, live counts everywhere, feed, log-game UX

**Date:** July 16, 2026

- **docs/TASKS.md created** — the active MVP burn-down (T1–T16, prioritized from
  Jesse's direction). Statuses live there; this log carries the narrative.
- **T2 drawer**: CourtBottomSheet rebuilt as a gesture drawer — PanResponder,
  snap points peek(~40%)/full/closed, interruptible springs with velocity
  handoff, check-in-from-peek expands to full, Modal render so actions can't
  hide behind the tab bar. Peek shows name/sport/distance (new
  `Court.distanceKm` from fetchNearbyCourts GPS math), live ON COURT/LOCALS/
  VISITS, CHECK IN, swipe-up affordance.
- **T3**: Log Game submit hidden behind tab bar — root cause was the `padding`
  shorthand ordered after `paddingBottom` (resets it); now tab-bar-aware.
- **T4**: MapScreen + MapScreen.web markers/cards/list wired to live
  `useCourtCounts` overlays (same pattern as Explore).
- **T6**: LOG GAME button on player profiles; deep link
  `/(tabs)/compete?tab=log&opponentId=<id>` preselects the opponent.
- **T8**: feed now shows CHECKED OUT and GAME results ("X DEF. Y 21–15",
  winner tinted Colors.win) alongside check-ins; fixed the no-op feed sort;
  prefixed feed IDs to avoid duplicate React keys.
- Executed with 3 scoped subagents (T3+T6, T4, T8) in parallel while the
  drawer rebuild (T2) was done directly. Combined tree typechecks clean.
- **Coordination note:** a parallel session created
  `feature/mapbox-explore-redesign` and switched this checkout onto it; this
  sprint's commit lands on that branch AND is cherry-picked to main (temp
  worktree) so OTA ships without disturbing the map work.

---

## Session 6 — Sprint 2: native sheets everywhere, schedule fixes, map cleanup

**Date:** July 17, 2026

**Lesson enforced this sprint (Jesse feedback): use the repo skills and native
platform patterns — don't hand-roll.** The PanResponder drawer from sprint 1
didn't track drags on device (tap-only). Per
`.agents/skills/building-native-ui` (form-sheet reference) and the pattern
already working in AddCourtModal (`presentationStyle="pageSheet"`), the
convention is now: ALL sheets are native.

- **Court drawer v2** — new `app/court-sheet.tsx` route presented as
  `formSheet`, detents `[0.45, 1.0]`, native grabber: OS-level drag/snap/
  dismiss physics. Peek layer (45%): name, distance, live stats, CHECK IN.
  Full: WHO'S HERE avatars + **LOCALS list** (usernames + last check-in per
  player — new `fetchLocalsWithLastCheckIn`, PostgREST per-parent embed,
  verified against prod) + pulling-up + runs. Old CourtBottomSheet deleted;
  Explore + both MapScreens push the route.
- **Create-run / plan-visit modals rebuilt** (native pageSheet): court field
  defaults to local court, ✕ to clear → debounced typeahead; symmetric
  7-day grid; equal-width time/max-player cells.
- **"NO RUNS SCHEDULED" bug fixed**: day strip was calendar-week (Sun–Sat,
  includes past days) while data fetches [today,+7d]. Strip is now rolling
  next-7-days; runs fetch from start-of-today (AppContext).
- **Map cleanup**: dark-tile flash fixed (shouldReplaceMapContent + dark
  loading canvas on native; dark container bg on web); "+" FAB to true
  bottom-right above all overlays; search bar full-width with controls moved
  below it; zoom badge unstacked from the FAB.
- **Feed color coding**: chips + 3px left border per type (check-in accent,
  checkout muted, game win-green, runs neutral).
- Working tree consolidated back onto `main` (Sonnet map session stopped by
  Jesse; its `feature/mapbox-explore-redesign` branch is abandoned — only
  contains sprint-1 content already on main).
- Executed with 2 scoped subagents (modals; map+feed) in parallel with the
  sheet/schedule work. Typecheck clean.

**Still open for MVP** (docs/TASKS.md): T7 game-loop e2e verify, T9 privacy
pass, T10 weekly availability calendar, T12 settings reorg, fixed-page
layouts (no whole-page scroll), court profile page LOCALS list parity.

---

## Session 7 — Drawer rebuilt on standard components, brand pass, DESIGN.md spec

**Date:** July 18, 2026

- **Court drawer v3** — sprint-2's native formSheet detents shipped broken
  (blank sheet on device, dead-end full page on web). Rebuilt on
  `@gorhom/bottom-sheet` 5.2.14 (standard component; JS-only over
  reanimated/gesture-handler already in the binary → ships OTA):
  `components/sheet/CourtSheetHost.tsx` hosts one BottomSheetModal at root,
  `useCourtSheet().openCourtSheet({courtId})` opens it from Explore + both
  MapScreens. Peek 46% / full 92%, backdrop + swipe dismiss, tappable
  swipe-hint expands. Verified end-to-end on web preview with live presence.
  `app/court-sheet.tsx` and its Stack.Screen registration deleted.
- **Brand** — Jesse's chosen court-frame mark implemented (SVG source +
  rasterized): `assets/brand/logo-mark.(svg|png)`, new app icon + splash
  (replaces green basketball-Saturn); icon/splash need a tagged build.
  `components/brand/LogoMark.tsx` is the only in-app logo entry point —
  swap procedure documented in DESIGN.md §Brand assets. Auth screen: back
  button removed (it's the front door), logo + "KNOW WHO'S RUNNING." tagline.
  AuthGate boot screen branded (OTA-visible).
- **Consistency** — `components/ScreenHeader.tsx` (ScreenHeader +
  SectionHeader); Explore/Compete/Schedule headers de-duplicated onto it.
- **DESIGN.md** — rewritten to the google-labs-code/design.md format
  (front-matter tokens, canonical sections, lint passes 0 errors via
  `npx -p @google/design.md designmd lint DESIGN.md`).
- **Live bug found:** `planned_visits.user_id` FK → auth.users breaks all
  PostgREST profile embeds (fetchPlannedVisits fails on every poll, swallowed).
  Fix staged at `docs/supabase/migrations/20260718_repoint_planned_visits_user_fk_to_profiles.sql`,
  awaiting go-ahead to apply (permission layer blocked live DDL this session).
- Web preview runs from `.claude/launch.json` (root of ~/Projects) via the
  desktop-app browser pane; expo start --web --port 8082.

**Still open:** apply the planned_visits migration; Home header onto
ScreenHeader + PDF-note fixes (Compete alignment, Explore section spacing,
schedule card tier outlines); QA the new sheet on TestFlight after next OTA.

---

## Session 8 — Supabase polling-storm fix, brand v2, maps rewrite (PR)

**Date:** July 19, 2026

**Incident:** project data plane overloaded → auth 522s. Root cause: web
previews running the app signed-OUT still polled 6+ reads every 30s
(AppProvider mounted outside the auth gate, no in-flight/foreground guards)
× supabase-js ≥2.102 auto-retrying failed GETs 4×. ~22k planned_visits
requests/day matched the dashboard exactly.

**Fix (this PR):**
- Data providers (App/CourtPresence/CourtSheet) now mount ONLY with a session
  (`DataProviders` in app/_layout.tsx) — signed out ⇒ zero Supabase traffic.
- Poll loop: 30s→60s, skips when backgrounded/hidden tab, skips if previous
  batch in flight; presence fallback poll 60s→120s.
- onAuthStateChange callback made synchronous (Supabase-documented deadlock).
- Auth screen never renders raw error objects (humanizeAuthError).

**Also in this PR (previously unsaved work):** court drawer on
@gorhom/bottom-sheet; neutral-grey palette + Kanit; checkmark-bracket logo +
icon/splash + modular LogoMark/auth-graphic; ScreenHeader/SectionHeader
adopted on Explore/Compete/Schedule; auth screen rework; maps rewrite to
@rnmapbox/maps + viewport Supabase fetch (fetchCourtsInBounds — also fixes
"nearby" showing wrong-state courts); react-native-maps removed;
runtimeVersion → fingerprint policy (OTA can't reach binaries lacking the
native module); planned_visits FK migration applied; docs/TASKS_REDESIGN.md
is the ordered queue for the web-parity redesign + schedule feature.

**Open:** Supabase auth may need a dashboard "Restart project"; EAS build
v1.0.4 needs MAPBOX_DOWNLOADS_TOKEN secret before tagging.

## Session 9 — Realtime consistency pass + Home/Schedule redesign (PR #19)

**Date:** July 24, 2026

**Goal:** make live updates consistent everywhere (acting device = instant,
watching screens = ~1s, everyone else = foreground resync), close Codex's
review of PR #17, implement the new Home + Schedule design mocks.

**Realtime/consistency (branch stacked on PR #17 → PR #19):**
- runs-live channel (runs + run_participants + planned_visits → debounced
  refetch): a join on one device now shows on other devices' run page /
  Schedule / NEXT RUN without foregrounding. planned_visits added to the
  supabase_realtime publication (applied live + migration file).
- One presence store: AppContext's duplicate activePlayers/localPlayers
  removed; check-in/out pushes a refresh into CourtPresenceContext so all
  surfaces on the acting device converge instantly.
- Map/Explore counts: no more one filtered channel per court (250 markers =
  250 subs). Scoped channels only for roster-watched courts; one shared
  check_ins stream routes events by court_id.
- updateProfileFields returns verified success; setLocalCourt rolls back
  optimistic state on failure (was silently reverting on relaunch).
- humanizeAuthError wired into all three auth handlers; Mapbox init guarded
  when token missing (list fallback); viewport fetches sequenced (both maps).

**Design:** Home rebuilt to mock 5 (brand lockup header, hero stat card with
ACTIVE NOW / LOCALS / RUNS THIS WK / ACTIVE THIS WK, smart-avatar WHO'S HERE
with +N hidden chip for RLS-hidden check-ins, NEXT RUN strip, timeline feed);
Schedule rebuilt to mock 6 (per-court weekly heatmap, 2h slots 6AM–10PM,
week paging over a 14-day window, tap-a-slot who's-coming card, Scheduled
Runs cards, CREATE RUN / MY TIMES pinned).

**Verified:** tsc clean; signed-in browser smoke test against LocalCheckProd
(real auth flow, seeded check-ins/run/visits via SQL, screenshots of every
state incl. the +1 hidden private check-in and heatmap slot detail; QA data
cleaned up after). Codex re-review P2s all fixed same session (14-day
pickers, 6AM slot, run cap 300, publication baseline migration).

**Open:** EAS env vars unverifiable from this session — before the v1.0.4
build confirm EXPO_PUBLIC_SUPABASE_URL/KEY point at qkrnmyexzvaxiqfxwwfb and
Mapbox tokens are set. Two-device physical test is the final gate. Test
account smoke.claude.0724@gmail.com can be deleted.
