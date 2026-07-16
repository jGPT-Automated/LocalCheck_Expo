# LocalCheck — Street Sports App

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/jGPT-Automated/LocalCheck_Expo)

> Find active courts. Check in. Play. Rank up.

LocalCheck brings the raw energy of street sports to your pocket. Discover who's playing at nearby courts, check in to broadcast your presence, join scheduled game runs, post the times you're pulling up, and track your ELO ranking. Basketball + pickleball, iOS-first, live on **TestFlight** (`LocalCheck: Pickup Sports`).

**Doc index (start here each session):**

| Doc | What it is |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Agent onboarding: golden rules, repo layout, canonical repo/backend |
| [`dev_agent.md`](dev_agent.md) | Working map, skill pathways, activity log, work queue |
| [`docs/SOURCE_OF_TRUTH.md`](docs/SOURCE_OF_TRUTH.md) | Verified project status + prioritized task list |
| [`docs/PLAYBOOK_DEPLOY.md`](docs/PLAYBOOK_DEPLOY.md) | **How to ship an update to the phone** (OTA vs full build, verification gates) |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | EAS build/submit/OTA reference detail |
| [`docs/SECRETS_AND_ENV.md`](docs/SECRETS_AND_ENV.md) | Every secret/env var, where it lives, how to rotate |
| [`DESIGN.md`](DESIGN.md) | Design system snapshot (tokens, components, motion, voice) |

---

## Design Direction

**Dark editorial brutalism** — inspired by Nike SNKRS and Victory Journal.

- Dark backgrounds (`#0D0D10`) with high-contrast white text
- Orange accent (`#FF5500`) for live states, actions, and selections
- Massive Oswald typography for stats and headings
- Hard edges — minimal border-radius (`2–8px` for subtle rounding)
- 1px borders (`#28282F`) define the grid; no drop shadows
- Clean, information-dense UI with zero decorative fluff

### Design Tokens

```css
--color-primary:    #FFFFFF
--color-background: #0D0D10
--color-surface:    #151519
--color-surfaceHigh:#1E1E26
--color-card:       #151519
--color-border:     #28282F
--color-text:       #F2F2F6
--color-textSec:    #9A9AAA
--color-muted:      #72728A
--color-accent:     #FF5500    /* Orange — live, active, selected */
--color-win:        #00E87A    /* Green — wins, friend badges */
--color-loss:       #FF3B5C    /* Red — losses */
--font-heading:     Oswald 700 (all caps, tight tracking)
--font-body:        Inter 400/500/600/700
--radius:           2–8px
```

Full component/motion/voice detail: [`DESIGN.md`](DESIGN.md).

---

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| **Auth** | `/auth` | Sign in / create account (email + Apple Sign-In). Auth-first: no session ⇒ this screen |
| **Home** | `/(tabs)/` | Your **local court** hub — hero, WHO'S HERE roster, next run, check in/out. FIND A COURT state when no local court set |
| **Schedule** | `/(tabs)/schedule` | "Pulling up" board — post planned court times, see who's coming, per court per day. Hosted runs below |
| **Compete** | `/(tabs)/compete` | Leaderboard + Log Game form (dual-tab) |
| **Explore** | `/(tabs)/explore` | Court discovery: nearby list, search, sport filters, MAP toggle. Tapping a court opens the full-screen court sheet |
| **Me / ELO** | `/(tabs)/elo` | Brutalist stat dashboard — rank, win/loss, recent matches |
| **Court Profile** | `/court/[id]` | Editorial spread: roster, upcoming runs, check-in, set/clear local court |
| **Game Run** | `/run/[id]` | Run lobby — RSVP (`going`), capacity-checked joins |
| **Player Profile** | `/player/[id]` | Player detail with head-to-head stats, add friend, match history |
| **Friends** | `/friends` | Friend list (Supabase `friendships`) |
| **Settings** | `/settings` | Visibility, LocalPlus, preferences, sport preferences, account |
| **Onboarding** | `/onboarding` | Username / sport / location steps — **rebuild pending** (closed PR #7; see SOURCE_OF_TRUTH) |

---

## Key User Flows

### Check In to a Court
1. From **Home** (local court) or **Explore** → court card / full-screen court sheet
2. Tap **CHECK IN** → calls the `switch_active_checkin` RPC, which atomically checks you out of any other court first
3. Roster updates; a public check-in generates a `feed_posts` row via DB trigger
4. Check-ins auto-expire server-side after 45 minutes (pg_cron job `auto-checkout-stale-checkins`)

### Join a Game Run
1. **Schedule** tab or **Court Profile** → run card
2. Tap **JOIN** → RSVP `going` written to `scheduled_game_participants` (capacity-checked)
3. Host a run via the header "+" or HOST A RUN — host auto-RSVPs

### Log a Game Result
1. Open **Compete** tab → **Log Game**
2. Form order: **Court** → **Sport** → **Opponent** → **Score** → **Notes**
3. Submit calls the `log_game` RPC — atomic game + participants insert, server-side Elo (K=32), wins/losses update, `game_result` feed entry
4. Ties rejected client-side; real success/failure UI (no silent failures)

### Track ELO
- **Me** tab shows your current rank, win/loss counter, win rate
- Recent match history with viewer-perspective scores
- Tier system: BRONZE → SILVER → GOLD → PLATINUM (based on ELO range)

### Pull Up (planned presence)
1. **Schedule** tab → **+ I'LL BE THERE** — pick court / day / time chips + optional note
2. Everyone's planned times show grouped by court per day (7-day window)
3. The full-screen court sheet shows a PULLING UP TODAY section

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile Framework** | Expo SDK 54 (React Native) with Expo Router |
| **Navigation** | Expo Router file-based routing + Classic Tabs (iOS uses SF Symbols, Android/web uses Feather icons) |
| **Backend** | **Supabase** (`jzclwnzcektqhgkkdeje`): Postgres + Auth + RLS. The only backend |
| **Data layer** | `services/*` (one file per domain) → Supabase; RPCs `log_game` + `switch_active_checkin` for atomic writes |
| **State Management** | React Context (`AuthContext` session, `AppContext` app state, 30s polling) |
| **Session persistence** | `expo-secure-store` (native) / localStorage (web) — the **only** client-persisted state |
| **Fonts** | Oswald (headings/stats) + Inter (body) via `@expo-google-fonts` |
| **Icons** | `@expo/vector-icons` (Feather) + SF Symbols (iOS) |
| **Maps** | `react-native-maps` (redesign in progress — see work queue) |
| **Haptics** | `expo-haptics` |
| **CI/CD** | EAS Workflows: push to `main` → OTA update; `v*` tag → build + TestFlight submit |

> **Removed by design (2026-07):** AsyncStorage app-data caching, mock/sample
> data, the Express API dependency, and client-side Elo math. Don't reintroduce
> them. `lib/db` (Drizzle), `artifacts/api-server`, and
> `artifacts/mobile/mockup-sandbox/` are Replit-era leftovers kept for
> reference only — **never ship from `mockup-sandbox/`**.

---

## Backend (Supabase)

- **Tables:** `profiles`, `courts` (~5.7k seeded — intentional), `check_ins`,
  `games` + `game_participants`, `scheduled_games` + participants,
  `friendships`, `feed_posts` (+likes), `planned_visits`, `push_tokens`,
  `subscriptions`.
- **RPCs that MUST be used instead of raw writes:**
  - `switch_active_checkin(p_court_id, p_visibility, p_note)` — atomic check-in switch
  - `log_game(p_court_id, p_opponent_id, p_my_side, p_score_a, p_score_b, p_winner_side, p_notes)` — game + Elo K=32
- **Enums are lowercase**: `winner_side`/`team_side` = `a`/`b`; run status =
  `scheduled`/`cancelled`/`completed`; RSVP = `going`/`waitlist`/`declined`.
- `profiles.is_pro` is **trigger-derived** from `subscriptions` — never write it from the client.
- All user-id FKs reference `public.profiles(id)` (2026-07-10 migration) so PostgREST embeds work.
- **RLS is authenticated-only** on every table: no session ⇒ empty results ⇒ UI looks broken.
- Schema baseline: [`docs/supabase/baseline_snapshot.sql`](docs/supabase/baseline_snapshot.sql);
  new changes go through Supabase migrations (in-repo copies under `docs/supabase/migrations/`).

---

## Project Structure

```
artifacts/
  mobile/                 # THE APP — run all expo/eas commands here
    app/
      (tabs)/
        index.tsx         # Home — local court hub
        schedule.tsx      # Pulling-up board + runs
        compete.tsx       # Leaderboard + Log Game
        explore.tsx       # Court discovery (list/search/map)
        elo.tsx           # Me — ELO dashboard
        _layout.tsx       # Tab navigation (ClassicTabLayout only)
      auth.tsx            # Sign in / create account
      onboarding.tsx      # (rebuild pending — see SOURCE_OF_TRUTH)
      court/[id].tsx      # Court profile
      run/[id].tsx        # Run lobby
      player/[id].tsx     # Player profile + head-to-head
      friends.tsx         # Friends list
      settings.tsx        # Settings
      _layout.tsx         # Root layout + providers (auth gate)
    components/           # HomeScreen, CourtsScreen, MapScreen, CourtBottomSheet, …
    services/             # Supabase data layer: courtService, checkInService,
                          # gameService, profileService, feedService,
                          # scheduledGameService, friendService, plannedVisitService
    context/
      AuthContext.tsx     # Supabase session + profile provisioning
      AppContext.tsx      # Global app state (courts, presence, feed, runs, friends)
    lib/supabase.ts       # Supabase client + SecureStore session adapter
    constants/            # colors.ts (tokens), typography.ts, data.ts (types)
    .eas/workflows/       # CI/CD: publish-ota-update.yml, release-ios.yml
    mockup-sandbox/       # scratch area — NOT the app, never ship from here
  api-server/             # legacy Express server (not used by the app)

docs/                     # all project docs (see index at top)
lib/                      # legacy Replit workspace packages (db, api-spec, …)
.agents/skills/           # per-repo skills (UI/UX, RN architecture, Supabase, deployment)
```

---

## State Architecture

`AuthContext` owns the Supabase session (SecureStore-persisted) and profile
provisioning. `AppContext` is the app-state source of truth — **all data comes
from Supabase via `services/*`; nothing app-level is cached on device.**

### Core State (AppContext)

| Key | Backed by | Description |
|-----|-----------|-------------|
| `courts` | `courts` / `courts_with_stats` | Court list with live counts |
| `localCourtId` | `profiles.local_court_id` | Your local court — authoritative from the profile row |
| `checkedInCourtId` | `check_ins` (active row) | Where you're currently checked in |
| `activePlayers` / `localPlayers` | `check_ins` + `profiles` | WHO'S HERE roster + locals for the local court |
| `feed` | `check_ins`/`games`/`scheduled_games` | Activity feed (reconstructed; `feed_posts` read-path pending — plan 008) |
| `runs` | `scheduled_games` (+participants) | Upcoming runs, RSVP-scoped |
| `friends` | `friendships` | Accepted friends |
| `plannedVisits` | `planned_visits` | Pulling-up board (7-day window) |

Refresh model today: 30-second polling + refresh-on-tab-focus + refresh after
own actions. **Known architectural gap:** five surfaces refresh court/presence
data independently, so another user's check-in doesn't propagate live —
the fix (single keyed server-state layer + Supabase Realtime) is the top
work-queue item. See `dev_agent.md` §Work queue.

### Key Actions

- `checkIn(courtId, visibility, note?)` / `checkOut()` — via `switch_active_checkin` RPC
- `setLocalCourt(courtId)` / explicit clear ("REMOVE MY LOCAL COURT") — never auto-assigned
- `logGame(payload)` — via `log_game` RPC (validation + real error surfacing)
- `joinRun(runId)` / `createRun(form)` — RSVP `going`, capacity-checked
- `addPlannedVisit(...)` / `removePlannedVisit(id)` — pulling-up board
- `addFriend(playerId)` / `removeFriend(playerId)` — `friendships` writes (pending-request flow not yet built)

---

## Data Model

Authoritative schema lives in Supabase — see
[`docs/supabase/baseline_snapshot.sql`](docs/supabase/baseline_snapshot.sql).
The UI types below (in `constants/data.ts`) map onto it.

### Player (UI type)

```typescript
interface Player {
  id: string;            // = profiles.id (= auth.users.id)
  name: string;
  elo: number;           // profiles.elo_rating — server-computed via log_game
  tier: "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "UNRANKED";
  avatar: string;        // Initials displayed in square avatar
  wins: number;
  losses: number;
  checkIns: number;
  sport?: CourtSport;
  courtId?: string;      // local court
  memberSince: string;
  visibility?: "public" | "friends" | "private";
  isLocalPlus?: boolean; // = profiles.is_pro (trigger-derived — read-only on client)
  friendIds?: string[];
}
```

### Court (UI type)

```typescript
interface Court {
  id: string;
  name: string;
  sport: CourtSport;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
  activeCount: number;   // live players checked in
  maxCapacity: number;
  status: "pending" | "confirmed" | "community";
  localCount: number;    // users who claimed this as their Local
  addedBy?: string;
  verificationPhoto?: string;
}
```

- Public court states are being redesigned toward **New / Active / Quiet** with
  a "Live now" overlay (see the map workstream) — current statuses above still
  drive markers today.

### ELO Tier System

| ELO Range | Tier |
|-----------|------|
| 1900+ | PLATINUM |
| 1700–1899 | GOLD |
| 1500–1699 | SILVER |
| < 1500 | BRONZE |

Players need 5 games before receiving a rank (shows "UNRANKED" state).
Elo is computed **server-side** by `log_game` (K=32, expected-score formula) —
never compute or write Elo client-side.

---

## Compete Screen (Leaderboard + Log Game)

The Compete screen has two tabs: **Leaderboard** and **Log Game**.

### Leaderboard

- **Scope tabs**: GLOBAL | REGIONAL | LOCAL
  - Default: **LOCAL** (filters to players at your `localCourtId`)
  - If no local court set, LOCAL falls back to showing all players
  - REGIONAL currently has no geographic filter (P2-5 — implement or remove)
- **Sport tabs**: ALL | BB | PB — defaults to your `preferredSport` (or ALL)
- **Player rows**: Rank #, avatar, name, tier, sport, W-L record, ELO —
  clickable → `/player/[id]`; green FRIEND badge for connections
- **Your rank** shows at bottom with visibility status — your row is publicly
  visible only when `visibility === "public"` and LocalPlus is active

### Log Game Form

Form order (top to bottom): **Court** → **Sport** → **Opponent** → **Score** → **Notes**.
Defaults to `preferredCourtId` (falls back to `localCourtId`) and `preferredSport`.
Submit calls the `log_game` RPC; ties are rejected; success/failure is surfaced for real.

---

## Player Profile Screen (`/player/[id]`)

- **Header**: Large avatar, name, tier badge, ELO, sport
- **Stats**: Wins, losses, win rate, check-ins
- **Head-to-Head**: real shared-games query vs. current user (wins/losses, last played)
- **Add Friend**: add/remove from your friend network (`friendships`)
- **Recent Matches**: latest results with viewer-perspective scores

---

## Settings Screen (`/settings`)

Current section order (top → bottom): **Profile Visibility** → **Subscription
(LocalPlus)** → **Preferences** (push/haptics/dark-mode toggles — currently
local-state only, P1-3) → **Sport Preferences** (preferred sport + court) →
**Account** (log out) → danger zone (delete account — stub, P1-5).

> **Planned reorg:** the settings that define your experience — **preferred
> sport and local court — move to the top**; LocalPlus UI hidden for MVP;
> dead toggles wired or removed. See work queue.

---

## Navigation (Tab Bar)

The app uses **ClassicTabLayout** on all platforms (iOS, Android, Web). NativeTabs was disabled because it creates a floating pill navigation bar on iOS that doesn't match the design system.

- **iOS**: SF Symbols icons + `BlurView` background + orange active tint
- **Android/Web**: Feather icons + solid dark background + orange active tint
- Full-width bar, no floating elements
- Tabs: Home | Schedule | Compete | Explore | Me

---

## Running the App

```bash
# From repo root — workspace needs pnpm ≥ 10
pnpm install

# Env (first time): copy artifacts/mobile/.env.example → .env, fill Supabase
# values (see docs/SECRETS_AND_ENV.md)

# macOS gotcha after a fresh install: copy lightningcss.darwin-arm64.node from
# node_modules/.pnpm/lightningcss-darwin-arm64@*/... into
# node_modules/.pnpm/lightningcss@*/node_modules/lightningcss/

# Start the Expo dev server (from artifacts/mobile)
cd artifacts/mobile && npx expo start        # press w for web preview

# Typecheck the mobile app (clean; ignore mockup-sandbox/* + elo.tsx pre-existing)
pnpm --filter @workspace/mobile run typecheck
```

Native modules in use (Apple Sign-In, SecureStore, Location) **do not run in
plain Expo Go** — use a development build, TestFlight, or web for quick checks.

### Shipping a change

Read [`docs/PLAYBOOK_DEPLOY.md`](docs/PLAYBOOK_DEPLOY.md). Short version:
JS-only → merge to `main` → OTA update reaches installed TestFlight builds on
next launch. Native/config change → `v*` tag → EAS build + TestFlight submit.
**Every deploy trigger needs Jesse's explicit go-ahead.**

---

## Activity Log

See `ACTIVITY_LOG.md` and the activity log in `dev_agent.md` for the full
record of development decisions and design choices. Keep both current — they
are the onboarding surface for every future agent.

---

## Agent Onboarding Notes

When working on this codebase, keep the following in mind (deeper rules in
[`AGENTS.md`](AGENTS.md) §4 — read that first):

1. **Design system is dark** — backgrounds are `#0D0D10`, not white. Accent is `#FF5500` (orange). Check `constants/colors.ts` and `DESIGN.md` before adding new UI.

2. **Tab bar is ClassicTabLayout only** — Do not re-enable `NativeTabs`. The `TabLayout` export in `app/(tabs)/_layout.tsx` always returns `<ClassicTabLayout />`. Intentional.

3. **Sport labels are "BB" and "PB"** — In the UI, always display "BB" for BASKETBALL and "PB" for PICKLEBALL. Full names are internal data only.

4. **Compete defaults are LOCAL scope + preferredSport** — Don't change these defaults without explicit user request.

5. **Social data lives in Supabase** — friendships, check-ins, games, runs are all real tables behind authenticated-only RLS. There is no local social state to sync.

6. **Preferences are nullable** — `preferredSport` and `preferredCourtId` can be `null`. The UI must handle "no preference set" gracefully.

7. **Log Game form order is fixed** — Court → Sport → Opponent → Score → Notes. Don't reorder without checking.

8. **No mock/sample data, anywhere** — removed app-wide in 2026-07 (plans 001–007). If a screen looks empty, fix the query/session, don't fabricate content. The only client-persisted state is the Supabase session token.

9. **Silent-catch gotcha** — the service layer swallows Supabase errors (`catch { /* best-effort */ }`). "No error thrown" is not proof a write worked: verify against the live DB (Supabase MCP) before claiming a fix.

10. **Prefer RPCs over raw inserts** — `log_game` and `switch_active_checkin` exist server-side and do the atomic multi-table writes + Elo. Never write `profiles.is_pro` from the client (trigger-derived from `subscriptions`).

11. **TypeScript project references** — Run `pnpm run typecheck` from root to build the full dependency graph. Running `tsc` inside a single package may fail if its dependencies haven't been built.

12. **Deploys** — follow [`docs/PLAYBOOK_DEPLOY.md`](docs/PLAYBOOK_DEPLOY.md); deploy triggers (merge to main, `v*` tags) need Jesse's explicit go-ahead.
