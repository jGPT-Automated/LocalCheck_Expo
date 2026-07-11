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
