# LocalCheck — Pickup Sports Network

> Find active courts. Check in. Play. Rank up.

LocalCheck is a React Native / Expo mobile app for pickup sports. It helps players find nearby courts, see who is currently checked in, schedule or join runs, log games, track Elo, and build a local sports graph around friends and regulars.

The app is iOS-first and currently distributed through TestFlight. The canonical product is the Expo app in `artifacts/mobile/`, backed by the live Supabase project `jzclwnzcektqhgkkdeje`.

---

## 1. Who this README is for

This README is intentionally both a product brief and a technical guide:

- **Consumer / investor overview:** what LocalCheck is, who it serves, why it matters, and how the core loops work.
- **Developer / agent onboarding:** where code lives, how data flows, how to run the app, and what rules prevent silent backend failures.
- **Internal reference:** canonical docs, deployment paths, known risks, and the historical-context folder for old decisions and archived audit material.

For the active task list and verified backend status, start with `docs/SOURCE_OF_TRUTH.md` after reading this file.

---

## 2. Product overview

### The problem

Pickup sports are hyper-local, social, and time-sensitive, but the current discovery loop is mostly offline:

- You do not know whether a court is active until you physically arrive.
- Regulars, visitors, and friends are hard to coordinate unless everyone is already in the same group chat.
- Game results and skill levels are informal, fragmented, and rarely portable across courts.
- Scheduling a run usually happens outside the place where players discover the court.

### The LocalCheck answer

LocalCheck turns courts into live social spaces:

1. **Find courts nearby.** The map and Explore tab show court locations, sports, capacity, and activity.
2. **Check in.** Players broadcast presence at a court with visibility controls.
3. **See who is playing.** Court rosters show active players, friends, and locals.
4. **Join or host runs.** Scheduled games create lightweight pickup coordination around a court and time.
5. **Log results.** Game logs feed rankings and personal history.
6. **Track reputation.** Elo, wins/losses, tiers, friends, and local leaderboards make the pickup graph legible.

### Positioning

LocalCheck is not just a court directory. It is a local sports presence layer: a way to know what is happening at nearby courts right now, who is there, and how your own game is progressing over time.

### Core audience

- Pickup basketball, pickleball, tennis, soccer, and volleyball players.
- Players who move between public courts, gyms, parks, and neighborhood spots.
- Competitive casual players who care about finding good games and tracking progress.
- Local organizers who want a lightweight way to host recurring runs.

---

## 3. Core user journeys

### First-run onboarding

1. User lands on the visual auth screen.
2. User signs in with Apple or email/password.
3. New users are routed through onboarding if their profile is missing a preferred sport.
4. Onboarding prompts for:
   - username / display name,
   - preferred sport,
   - location permission,
   - map handoff.
5. The app opens the map focused around nearby courts.

Relevant files:

- `artifacts/mobile/app/auth.tsx`
- `artifacts/mobile/app/onboarding.tsx`
- `artifacts/mobile/app/_layout.tsx`
- `artifacts/mobile/context/AuthContext.tsx`
- `artifacts/mobile/services/profileService.ts`

### Find and check in at a court

1. Open **Home / Map**.
2. Browse nearby courts and live player counts.
3. Tap a court marker to inspect the court.
4. Check in with a profile visibility setting.
5. Active roster and feed surfaces update from Supabase-backed data.

### Join or host a run

1. Open **Schedule** or a **Court Detail** page.
2. View upcoming scheduled runs.
3. Join an existing run or host a new run.
4. Participants and court context drive coordination.

Current caveat: the live schema supports this, but create/join enum values need fixes before this is fully reliable. See `docs/SOURCE_OF_TRUTH.md` P0 items.

### Log a game and track Elo

1. Open **Compete**.
2. Select court, sport, opponent, score, and notes.
3. Submit a result.
4. Elo, wins/losses, feed activity, and match history should update.

Current caveat: the live database already has a correct `log_game(...)` RPC, but the client still needs to be wired to it. See `docs/SOURCE_OF_TRUTH.md` P0-1 and P0-2.

### Follow friends and compare players

1. Open leaderboard or player profile.
2. View player stats and match history.
3. Add/remove friends.
4. Friend badges and social context appear across the app.

Current caveat: basic accepted friendships work, but pending friend requests and real head-to-head queries remain follow-up work.

---

## 4. Screen map

| Area          | Route / file              | Product role                                         | Backend status                                        |
| ------------- | ------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Auth          | `app/auth.tsx`            | Sign in / create account with Apple or email         | Real Supabase Auth                                    |
| Onboarding    | `app/onboarding.tsx`      | Username, sport, location prompt, map handoff        | Writes profile fields                                 |
| Home / Map    | `app/(tabs)/index.tsx`    | Nearby courts, live map, check-in entry              | Real reads                                            |
| Explore       | `app/(tabs)/explore.tsx`  | Court discovery and search                           | Real reads                                            |
| Compete       | `app/(tabs)/compete.tsx`  | Leaderboard + log game form                          | Leaderboard real; log-game write path needs RPC fix   |
| Schedule      | `app/(tabs)/schedule.tsx` | Upcoming runs                                        | Reads real runs; create/join need fixes               |
| Me / Elo      | `app/(tabs)/elo.tsx`      | Player stats and match history                       | Reads real profile/games; game write path incomplete  |
| Feed          | `app/(tabs)/feed.tsx`     | Activity stream, hidden from tab bar                 | Reconstructed from services; feed table is half-wired |
| Court Detail  | `app/court/[id].tsx`      | Court profile, roster, upcoming runs                 | Real reads                                            |
| Run Detail    | `app/run/[id].tsx`        | Scheduled run lobby                                  | Partial                                               |
| Player Detail | `app/player/[id].tsx`     | Profile, stats, match history, H2H                   | Partial; H2H currently not real                       |
| Friends       | `app/friends.tsx`         | Friend list                                          | Real accepted friendships                             |
| Settings      | `app/settings.tsx`        | Preferences, visibility, subscription/settings stubs | Mixed; see source of truth                            |

---

## 5. Design direction

LocalCheck uses **dark editorial brutalism**: court-map utility with a sports-media feel.

### Visual principles

- Dark background, high-contrast white type, orange action states.
- Oswald headings for stats, scoreboards, and large sport/editorial moments.
- Inter body text for forms, labels, and readable UI density.
- Hard-edged cards and panels; minimal radius.
- 1px borders as layout structure, not decoration.
- Live activity is expressed with orange, green, roster counts, and map/presence motifs.

### Design tokens

Defined in `artifacts/mobile/constants/colors.ts` and `artifacts/mobile/constants/typography.ts`.

```css
--color-background: #0d0d10;
--color-surface: #151519;
--color-card: #151519;
--color-border: #28282f;
--color-text: #f2f2f6;
--color-text-sec: #9a9aaa;
--color-muted: #72728a;
--color-accent: #ff5500; /* live / selected / primary action */
--color-win: #00e87a;
--color-loss: #ff3b5c;
--font-heading: Oswald;
--font-body: Inter;
```

### UI north star

The product should feel like opening a live local scoreboard for your neighborhood courts: immediate, competitive, local, and social.

---

## 6. Current technical architecture

### Stack

| Layer            | Current technology                                                        |
| ---------------- | ------------------------------------------------------------------------- |
| Mobile framework | Expo / React Native                                                       |
| Routing          | Expo Router file-based routes                                             |
| Auth             | Supabase Auth, email/password, Apple Sign-In                              |
| Session storage  | `expo-secure-store` on native, web fallback in `lib/supabase.ts`          |
| Backend          | Supabase project `jzclwnzcektqhgkkdeje`                                   |
| Database         | Postgres with RLS, views, triggers, and RPCs                              |
| Data access      | Per-domain Supabase service files under `artifacts/mobile/services/`      |
| State            | React Context (`AuthContext`, `AppContext`) over Supabase-backed services |
| Maps             | `react-native-maps` native + web map component split                      |
| Location         | `expo-location`                                                           |
| Haptics          | `expo-haptics`                                                            |
| Fonts            | `@expo-google-fonts/inter`, `@expo-google-fonts/oswald`                   |
| Build/deploy     | EAS Build, EAS Submit, EAS Update, EAS Workflows                          |

### Important correction from old docs

Older docs described LocalCheck as an AsyncStorage-first app with Drizzle/Postgres prepared for later. That is no longer accurate.

Current reality:

- The shipping app is auth-first.
- App data is Supabase-backed.
- RLS requires authenticated users.
- The only client-persisted state that should remain is the Supabase session token via SecureStore/web fallback.
- The old Drizzle/API-server packages are legacy scaffolding, not the canonical backend.

---

## 7. Repository layout

```text
artifacts/mobile/                 # Canonical Expo app; run Expo/EAS commands here
  app/                            # Expo Router screens
    (tabs)/                       # Main tab screens
    auth.tsx                      # Auth entry screen
    onboarding.tsx                # First-run onboarding flow
    court/[id].tsx                # Court detail
    player/[id].tsx               # Player detail
    run/[id].tsx                  # Run detail
    friends.tsx                   # Friends screen
    settings.tsx                  # Settings screen
  components/                     # Shared RN components
  constants/                      # Colors, typography, domain types
  context/                        # AuthContext and AppContext
  lib/supabase.ts                 # Supabase client + session adapter
  services/                       # Supabase data layer by domain
  app.json                        # Expo config
  eas.json                        # EAS build/submit profiles
  .eas/workflows/                 # EAS Workflows CI/CD

docs/
  SOURCE_OF_TRUTH.md              # Verified project state + prioritized task list
  DEPLOYMENT.md                   # Expo/EAS/TestFlight workflow
  SECRETS_AND_ENV.md              # Env/secrets guide
  supabase/baseline_snapshot.sql  # Reverse-engineered live DB baseline
  historical-context/             # Archived stale docs/resources; not authoritative

lib/                              # Legacy/generated monorepo packages; not canonical backend
artifacts/api-server/             # Legacy Express API scaffold; not the live backend
```

Do not ship from `artifacts/mobile/mockup-sandbox/`. It is a scratch/mockup area with many pre-existing type errors and is not part of the production app.

---

## 8. Backend and data model mental model

### Canonical backend

- Supabase project: `jzclwnzcektqhgkkdeje`
- Auth: Supabase Auth
- DB: Postgres with RLS enabled
- Baseline schema reference: `docs/supabase/baseline_snapshot.sql`

### Key tables and concepts

| Domain    | Tables / views / functions                       | Notes                                                                                                |
| --------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Profiles  | `profiles`, `subscriptions`                      | `profiles.is_pro` is trigger-derived from `subscriptions`; do not write it directly from the client. |
| Courts    | `courts`, `courts_with_stats`                    | Court discovery and stats.                                                                           |
| Check-ins | `check_ins`, `switch_active_checkin(...)`        | Use RPC for atomic active check-in switching.                                                        |
| Games     | `games`, `game_participants`, `log_game(...)`    | Use RPC for game writes and Elo updates.                                                             |
| Runs      | `scheduled_games`, `scheduled_game_participants` | Enum values must match live lowercase schema.                                                        |
| Social    | `friendships`                                    | Accepted friendships work; pending flow remains.                                                     |
| Feed      | `feed_posts` plus reconstructed service feeds    | Some DB triggers write feed rows that the client does not fully consume yet.                         |

### Non-negotiable backend rules

1. **Auth-first:** RLS is `authenticated`-only. A signed-out user sees auth, not tabs.
2. **No client writes to `profiles.is_pro`:** write subscription state to `subscriptions` when IAP exists.
3. **Use RPCs for atomic writes:** `log_game(...)` and `switch_active_checkin(...)` already exist server-side.
4. **Enum casing is lowercase:** use `a`/`b`, `scheduled`, `going`/`waitlist`/`declined`, etc.
5. **Do not trust swallowed errors:** many service methods catch and suppress Supabase errors. Verify row writes.
6. **No app-data AsyncStorage caching:** session persistence is OK; sample/local app data is not.
7. **Schema history is incomplete:** live schema exists in Supabase; future schema changes should use migrations.

---

## 9. App state architecture

### AuthContext

`artifacts/mobile/context/AuthContext.tsx`

Owns:

- current Supabase session,
- current auth user,
- current profile row,
- auth loading state,
- email/password sign-in and sign-up,
- Apple Sign-In,
- sign-out,
- profile refresh after profile writes.

The profile row is guaranteed through the DB trigger plus a client fallback insert.

### AppContext

`artifacts/mobile/context/AppContext.tsx`

Owns derived app-level state and action wrappers, including:

- current user as app `Player`,
- nearby courts,
- local court,
- checked-in court,
- runs,
- feed,
- matches,
- friends,
- preferred sport/court,
- local and active players,
- refresh actions for court state, feed, runs, matches, and friends.

AppContext should reflect Supabase as the source of truth. Optimistic updates are acceptable only when followed by real persistence and refresh.

### Service layer

`artifacts/mobile/services/`

One service file per domain:

- `courtService.ts`
- `checkInService.ts`
- `gameService.ts`
- `scheduledGameService.ts`
- `profileService.ts`
- `friendshipService.ts`
- `feedService.ts`

When changing service writes, prefer explicit errors or logging during verification. The absence of a thrown error does not prove a write worked.

---

## 10. Local development

### Prerequisites

- Node / pnpm environment from the repo image.
- Expo tooling through `npx expo` / EAS CLI as needed.
- `artifacts/mobile/.env` created from `.env.example` with Supabase and Mapbox public values.

### Install and run

```bash
cd artifacts/mobile
pnpm install
npx expo start
```

Native modules in use, including Apple Sign-In, SecureStore, and Location, do not fully run in plain Expo Go. Use a development build or Expo web where supported.

### Typecheck

```bash
cd artifacts/mobile
pnpm typecheck
```

Known caveat: `artifacts/mobile/mockup-sandbox/` has many inherited type errors and is not shipped. `docs/DEPLOYMENT.md` and `AGENTS.md` document this.

For focused agent checks that exclude pre-existing sandbox errors, use a temporary tsconfig and remove it afterward:

```bash
cat > artifacts/mobile/tsconfig.agent-check.json <<'JSON'
{
  "extends": "./tsconfig.json",
  "exclude": ["mockup-sandbox", "app/(tabs)/elo.tsx"]
}
JSON
pnpm --dir artifacts/mobile exec tsc -p tsconfig.agent-check.json --noEmit
rm artifacts/mobile/tsconfig.agent-check.json
```

---

## 11. Deployment and release model

All Expo/EAS commands run from `artifacts/mobile/`.

### Fast path: OTA update

Use for JS, styling, assets, and app logic changes:

```bash
cd artifacts/mobile
eas update --branch production --message "what changed"
```

Merged changes to `main` can publish OTA through the EAS workflow if the installed binary is OTA-eligible.

### Full build: TestFlight binary

Use when changing native modules, permissions, SDK versions, `app.json`, or `eas.json`:

```bash
cd artifacts/mobile
eas build -p ios --profile production
eas submit -p ios --profile production --id <BUILD_ID> --non-interactive
```

See `docs/DEPLOYMENT.md` for channels, build profiles, workflow triggers, TestFlight tester setup, and App Store Connect details.

---

## 12. Environment and secrets

Runtime public values are `EXPO_PUBLIC_*` and are embedded in the JS bundle:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_MAPBOX_TOKEN`

Secrets such as Expo tokens, App Store Connect keys, Supabase account tokens, and service-role credentials must never be committed.

See `docs/SECRETS_AND_ENV.md` for where values live, how to rotate them, and what is safe to document.

---

## 13. Current product status and priorities

The authoritative status table and task list live in `docs/SOURCE_OF_TRUTH.md`.

High-level status:

- Auth, sessions, profile provisioning, court discovery, home/map reads, explore reads, leaderboard reads, court detail reads, friends reads, and settings preference persistence are real.
- Game logging, run creation/joining, head-to-head stats, pending friend requests, push notifications, LocalPlus/IAP, and delete account need follow-up work.
- The highest-priority fixes are the P0 Supabase write-path issues listed in `docs/SOURCE_OF_TRUTH.md`.

Do not re-derive priorities from archived docs or old audits. Update `docs/SOURCE_OF_TRUTH.md` when verified status changes.

---

## 14. Historical context folder

Stale docs and resources were moved to `docs/historical-context/`.

That folder includes:

- the old AsyncStorage/Drizzle-era README,
- old Replit workspace notes,
- stale backend status docs,
- previous activity/session logs,
- pasted audits and uploaded screenshots/resources.

These files may capture decision points and prior conversations, but they are not current instructions. Prefer current docs in this order:

1. `AGENTS.md`
2. `README.md`
3. `docs/SOURCE_OF_TRUTH.md`
4. `docs/DEPLOYMENT.md`
5. `docs/SECRETS_AND_ENV.md`
6. `docs/supabase/baseline_snapshot.sql`

---

## 15. Agent and developer rules of engagement

Before making code changes:

1. Read `AGENTS.md`.
2. Read `docs/SOURCE_OF_TRUTH.md` for current task priority.
3. If touching backend behavior, inspect `docs/supabase/baseline_snapshot.sql`.
4. If touching deployment, read `docs/DEPLOYMENT.md`.
5. If touching secrets/env, read `docs/SECRETS_AND_ENV.md`.

While making changes:

- Keep Expo/EAS commands scoped to `artifacts/mobile/`.
- Do not use `artifacts/mobile/mockup-sandbox/` as app code.
- Do not introduce mock/sample app data as production fallback.
- Do not add AsyncStorage app-data caching.
- Do not write `profiles.is_pro` from the client.
- Prefer server RPCs over multi-step client writes for games/check-ins.
- Avoid silent catch blocks for new write paths; verify writes landed.
- Cite/update living docs rather than creating duplicate status docs.

After making changes:

- Run relevant formatting/type checks.
- For Supabase writes, verify actual rows or RPC behavior against the live project when credentials/tools are available.
- Update `docs/SOURCE_OF_TRUTH.md` when a task is shipped or a new verified gap is found.

---

## 16. Quick links

| Need                          | Go to                                      |
| ----------------------------- | ------------------------------------------ |
| Current status and priorities | `docs/SOURCE_OF_TRUTH.md`                  |
| Run/build/submit/deploy       | `docs/DEPLOYMENT.md`                       |
| Secrets/env setup             | `docs/SECRETS_AND_ENV.md`                  |
| Live DB schema baseline       | `docs/supabase/baseline_snapshot.sql`      |
| App source                    | `artifacts/mobile/`                        |
| Screens/routes                | `artifacts/mobile/app/`                    |
| Data services                 | `artifacts/mobile/services/`               |
| Auth/session/profile state    | `artifacts/mobile/context/AuthContext.tsx` |
| App state/actions             | `artifacts/mobile/context/AppContext.tsx`  |
| Archived stale docs/resources | `docs/historical-context/`                 |
