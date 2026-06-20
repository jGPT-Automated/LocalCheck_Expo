# LocalCheck — Street Sports App

> Find active courts. Check in. Play. Rank up.

LocalCheck brings the raw energy of street sports to your pocket. Discover who's playing at nearby courts, check in to broadcast your presence, join scheduled game runs, and track your ELO ranking in real-time.

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

---

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| **Home / Map** | `/(tabs)/` | Full-screen map with brutalist court markers and live player counts |
| **Schedule** | `/(tabs)/schedule` | Court schedules and availability |
| **Compete** | `/(tabs)/compete` | Leaderboard + Log Game form (dual-tab) |
| **Explore** | `/(tabs)/explore` | Live courts list + city ELO leaderboard |
| **Me / ELO** | `/(tabs)/elo` | Brutalist stat dashboard — rank, win/loss, recent matches |
| **Court Profile** | `/court/[id]` | Editorial spread: conditions, roster, upcoming runs, check-in |
| **Game Run** | `/run/[id]` | Matchmaking lobby — team A vs B, ELO balancing, RSVP |
| **Player Profile** | `/player/[id]` | Player detail with head-to-head stats, add friend, match history |
| **Settings** | `/settings` | Visibility, LocalPlus, sport preferences, notifications |
| **The Feed** | `/(tabs)/feed` | Reverse-chronological community activity (hidden from tab bar) |

---

## Key User Flows

### Check In to a Court
1. Open **Map** tab → tap a court marker (shows player count)
2. Bottom sheet slides up with court details, live roster
3. Tap **CHECK IN** → status updates, avatar added to roster, feed event generated
4. Haptic feedback confirms action

### Join a Game Run
1. Open **Court Profile** → scroll to **Upcoming Runs**
2. Tap a run card → **Game Run** lobby loads
3. Tap an open slot on Team A or B → slot fills with your avatar + ELO
4. When ready, record WIN / LOSS to update ELO

### Track ELO
- **Me** tab shows your current rank number (animated odometer-style on load)
- Win/Loss counter, win rate percentage
- Recent match history with ELO deltas (+15, -10, etc.)
- Tier system: BRONZE → SILVER → GOLD → PLATINUM (based on ELO range)

### View Player Profile
1. Open **Compete** tab → **Leaderboard**
2. Tap any player row → **Player Profile** opens
3. See head-to-head stats, match history, and option to add as friend
4. Friend badges appear on leaderboard rows for players you're connected to

### Log a Game Result
1. Open **Compete** tab → **Log Game**
2. Form defaults to your preferred court and sport
3. Order: **Court** → **Sport** → **Opponent** → **Score** → **Notes**
4. Submit to record match and update ELO

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile Framework** | Expo (React Native) with Expo Router |
| **Navigation** | Expo Router file-based routing + Classic Tabs (iOS uses SF Symbols, Android/web uses Feather icons) |
| **State Management** | React Context + AsyncStorage (persistent local state) |
| **Fonts** | Oswald (headings/stats) + Inter (body) via `@expo-google-fonts` |
| **Icons** | `@expo/vector-icons` (Feather) + SF Symbols (iOS) |
| **Maps** | `react-native-maps` v1.18.0 (Expo Go compatible) |
| **Haptics** | `expo-haptics` |
| **Persistence** | `@react-native-async-storage/async-storage` |
| **API Layer** | Express 5 (shared monorepo API server, ready for backend expansion) |
| **Database** | PostgreSQL + Drizzle ORM (provisioned, schema-ready for persistence) |

---

## Database Strategy (Modular by Design)

The app is built **frontend-first with AsyncStorage** for the initial build. The database layer is completely modular:

- `lib/db/` contains the Drizzle ORM setup with PostgreSQL connection
- `lib/api-spec/openapi.yaml` is the OpenAPI contract for future API endpoints
- When ready to add server-side persistence, simply:
  1. Define tables in `lib/db/src/schema/`
  2. Add API endpoints to `artifacts/api-server/src/routes/`
  3. Update `lib/api-spec/openapi.yaml` and run codegen
  4. Replace AsyncStorage calls with React Query hooks from `@workspace/api-client-react`

This approach means **zero migration pain** — the backend is a plug-in, not a dependency.

---

## Project Structure

```
artifacts/
  mobile/               # Expo mobile app
    app/
      (tabs)/
        index.tsx       # Map screen
        feed.tsx        # Community feed (hidden from tab bar)
        schedule.tsx    # Court schedules
        compete.tsx     # Leaderboard + Log Game form
        explore.tsx     # Live courts list
        elo.tsx         # ELO dashboard (Me tab)
        _layout.tsx     # Tab navigation (ClassicTabLayout only)
      court/[id].tsx    # Court profile
      run/[id].tsx      # Game run lobby
      player/[id].tsx   # Player profile with head-to-head stats
      settings.tsx      # Settings: visibility, preferences, LocalPlus
      _layout.tsx       # Root layout + providers
    components/         # Reusable UI components
    constants/
      colors.ts         # Design tokens (dark theme)
      typography.ts     # Font families + sizes
      data.ts           # Types + sample data (players, courts, runs, matches, feed)
    context/
      AppContext.tsx    # Global app state (friends, preferences, persistence)
    assets/images/      # Icons + placeholders (AI-generated)
  api-server/           # Express API (ready for backend routes)

lib/
  db/                   # Drizzle ORM + PostgreSQL
  api-spec/             # OpenAPI spec (source of truth)
  api-client-react/     # Generated React Query hooks
  api-zod/              # Generated Zod validators
```

---

## State Architecture (AppContext)

`AppContext` is the single source of truth. All mutable state persists to `AsyncStorage` with `localcheck:*` namespaced keys.

### Core State

| Key | Type | AsyncStorage Key | Description |
|-----|------|------------------|-------------|
| `currentUser` | `Player` | `localcheck:currentUser` | Logged-in player (defaults to Marcus J. sample) |
| `courts` | `Court[]` | `localcheck:courts` | All courts with live counts |
| `checkedInCourtId` | `string \| null` | `localcheck:checkedInCourtId` | Current check-in location |
| `localCourtId` | `string \| null` | `localcheck:localCourtId` | User's "Local" court (drives LOCAL scope filter) |
| `runs` | `GameRun[]` | — | Scheduled game runs (in-memory for demo) |
| `feed` | `FeedItem[]` | `localcheck:feed` | Community activity stream |
| `matches` | `MatchResult[]` | `localcheck:matches` | User's match history |

### Preferences & Social

| Key | Type | AsyncStorage Key | Description |
|-----|------|------------------|-------------|
| `isLocalPlus` | `boolean` | `localcheck:isLocalPlus` | Premium subscription flag |
| `visibility` | `"public" \| "friends" \| "private"` | `localcheck:visibility` | Profile visibility setting |
| `friendIds` | `string[]` | `localcheck:friendIds` | List of friend player IDs |
| `preferredSport` | `CourtSport \| null` | `localcheck:preferredSport` | Default sport filter (BB / PB) |
| `preferredCourtId` | `string \| null` | `localcheck:preferredCourtId` | Default court for log game |

### Actions

- `checkIn(courtId)`, `checkOut()` — manage active presence
- `visitCourt(courtId)` — track last visited
- `setLocalCourt(courtId)` — claim a court as your "Local" (updates `localCount` + status)
- `setVisibility(v)`, `setIsLocalPlus(v)` — profile settings
- `setPreferredSport(sport)`, `setPreferredCourtId(courtId)` — preference settings
- `addFriend(playerId)`, `removeFriend(playerId)`, `isFriend(id)`, `getFriendsList()` — social graph
- `joinRun(runId, team)`, `recordResult(runId, winner)` — game run management
- `addMatchResult(result)` — manual match logging
- `hypeItem(feedId)` — community engagement

---

## Data Model

### Player

```typescript
interface Player {
  id: string;
  name: string;
  elo: number;
  tier: "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "UNRANKED";
  avatar: string;        // Initials displayed in square avatar
  wins: number;
  losses: number;
  checkIns: number;
  sport?: CourtSport;    // Primary sport
  courtId?: string;      // Primary court
  memberSince: string;   // ISO date
  visibility?: "public" | "friends" | "private";
  isLocalPlus?: boolean;
  friendIds?: string[];  // Bidirectional friend network
}
```

### Court

```typescript
interface Court {
  id: string;
  name: string;
  sport: CourtSport;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
  activeCount: number;   // Live players checked in
  maxCapacity: number;
  status: "pending" | "confirmed" | "community";
  localCount: number;      // Users who claimed this as their Local
  addedBy?: string;
  verificationPhoto?: string;
}
```

- `status: "pending"` — dashed outline marker (AI verification needed)
- `status: "confirmed"` — outline-only marker
- `status: "community"` — filled orange marker (5+ locals)

### ELO Tier System

| ELO Range | Tier |
|-----------|------|
| 1900+ | PLATINUM |
| 1700–1899 | GOLD |
| 1500–1699 | SILVER |
| < 1500 | BRONZE |

Players need 5 games before receiving a rank (shows "UNRANKED" state).

---

## Compete Screen (Leaderboard + Log Game)

The Compete screen has two tabs: **Leaderboard** and **Log Game**.

### Leaderboard

- **Scope tabs**: GLOBAL | REGIONAL | LOCAL
  - Default: **LOCAL** (filters to players at your `localCourtId`)
  - If no local court set, LOCAL falls back to showing all players
- **Sport tabs**: ALL | BB | PB
  - Default: user's `preferredSport` (or ALL if unset)
  - "BB" = Basketball, "PB" = Pickleball
- **Player rows**: Rank #, avatar, name, tier, sport, W-L record, ELO
  - **Clickable**: tapping any row navigates to `/player/[id]`
  - **Friend badge**: green "FRIEND" label appears for players in your `friendIds`
- **Your rank**: shown at bottom with visibility status ("#4 — HIDDEN" if not LocalPlus)
- Only `public` + `isLocalPlus` players appear on leaderboard

### Log Game Form

Form order (top to bottom):
1. **Court** — dropdown of all courts; defaults to `preferredCourtId` (falls back to `localCourtId`)
2. **Sport** — BB / PB toggle; defaults to `preferredSport`
3. **Opponent** — dropdown of all players
4. **Score** — Your score / Opponent score
5. **Notes** — optional text input

Submit records the match and updates ELO.

---

## Player Profile Screen (`/player/[id]`)

Tapping a player from the leaderboard opens their profile:

- **Header**: Large avatar, name, tier badge, ELO, sport
- **Stats**: Wins, losses, win rate, check-ins
- **Head-to-Head**: Match history vs. current user (wins/losses, last played)
- **Add Friend**: button to add/remove from your friend network
- **Recent Matches**: last 5 match results with ELO deltas

---

## Settings Screen (`/settings`)

### Profile Section
- Visibility toggle (PUBLIC / FRIENDS / PRIVATE)
- LocalPlus upgrade modal ($4.99/mo — full history, public visibility, advanced stats)
- Rank display toggle (show/hide on leaderboard)

### Sport Preferences Section
- **Preferred Sport**: BB / PB toggle pills (tap to set, tap again to clear)
- **Preferred Court**: pills for each saved court (tap to select, tap again to clear)

### Preferences Section
- Push notifications toggle
- Haptic feedback toggle
- Dark mode toggle

### Account Section
- Log out
- Delete account

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
# Install dependencies
pnpm install

# Start the Expo dev server
pnpm --filter @workspace/mobile run dev

# Typecheck the mobile app
pnpm --filter @workspace/mobile run typecheck

# Typecheck all workspace packages
pnpm run typecheck
```

Scan the QR code in the Replit URL bar with **Expo Go** to preview on your physical device.

---

## Activity Log

See `ACTIVITY_LOG.md` for a full record of development decisions and design choices.

---

## Agent Onboarding Notes

When working on this codebase, keep the following in mind:

1. **Design system is dark** — backgrounds are `#0D0D10`, not white. Accent is `#FF5500` (orange), not volt green. Check `constants/colors.ts` before adding new UI.

2. **Tab bar is ClassicTabLayout only** — Do not re-enable `NativeTabs`. The `TabLayout` export in `app/(tabs)/_layout.tsx` always returns `<ClassicTabLayout />`. This is intentional for consistent styling.

3. **Sport labels are "BB" and "PB"** — In the UI, always display "BB" for BASKETBALL and "PB" for PICKLEBALL. The full names are internal data only.

4. **Compete defaults are LOCAL scope + preferredSport** — The leaderboard defaults to LOCAL scope (filtered by `localCourtId`) and the user's `preferredSport`. Do not change these defaults without explicit user request.

5. **Friend system is bidirectional** — `friendIds` lives on the `Player` object and is synced to AsyncStorage. `addFriend` updates both `friendIds` state and `currentUser.friendIds`. Use `isFriend()` and `getFriendsList()` for UI checks.

6. **Preferences are nullable** — `preferredSport` and `preferredCourtId` can be `null`. The UI should handle "no preference set" gracefully (fall back to ALL / no default).

7. **Log Game form order is fixed** — Court → Sport → Opponent → Score → Notes. This order was chosen for user flow. Don't reorder without checking.

8. **Only public + LocalPlus players appear on leaderboard** — The `leaderboardPlayers` filter checks `p.visibility === "public" && p.isLocalPlus`. The `allPlayersFiltered` list (used for opponent selection) has no visibility filter.

9. **Sample data is the source of truth for demo** — `SAMPLE_PLAYERS`, `SAMPLE_COURTS`, `SAMPLE_RUNS`, `SAMPLE_FEED`, `SAMPLE_MATCHES` in `constants/data.ts` define all demo content. Player IDs `p1`–`p8` are the demo roster.

10. **TypeScript project references** — Run `pnpm run typecheck` from root to build the full dependency graph. Running `tsc` inside a single package may fail if its dependencies haven't been built.
