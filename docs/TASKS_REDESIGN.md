# Redesign & Schedule task list — run in order

Each task is self-contained and sized for one agent session. Reference design:
the LocalCheck web app (localcheck-web.chatjess.chatgpt.site — new court page
with FEED / LOCALS / DETAILS tabs, hero court card, schedule heatmap) plus the
brand asset sheet (checkmark-bracket mark, one accent, monochrome win/loss).
Rules that hold for every task: tokens only (constants/colors.ts), reuse
ScreenHeader/SectionHeader/BrutalistButton/CourtSheet stack, DESIGN.md is
normative, typecheck must pass, note OTA vs build impact in the PR.

## Phase 0 — v2 backend: one coordinated launch release (decided 2026-07-21)
Polling architecture is GONE from the client (fetch once → scoped
`court:{id}` realtime channels → one resync on foreground → unsubscribe
off-screen; zero timers). The v2 direction is a single shared backend:
**LocalCheckProd `qkrnmyexzvaxiqfxwwfb` (us-east-2)** — the website's project,
54-court canonical catalog — replaces legacy `jzclwnzcektqhgkkdeje` (us-west-2)
for BOTH web and mobile. Sequence:
- [ ] **T0.1 v2 schema as version-controlled migrations** on LocalCheckProd:
  profiles, courts (existing), check_ins, runs, run_participants, matches,
  match_participants, friendships, planned_visits, activity_events,
  subscriptions. Constraints up front: one active check-in per user (partial
  unique index), court/time + user/time indexes, cursor-paginated
  activity_events, transactional RPCs (check_in/out, join/leave run), RLS on
  every table, Broadcast triggers scoped court/run/user, no client writes to
  protected fields.
- [ ] **T0.2 Seed fixtures**: recreate test auth accounts (controlled creds),
  import profiles + friendships, map the 6 legacy courts onto the canonical
  catalog, import useful check-ins/games/runs/planned_visits with remapped
  court ids, keep varied account/court states for realtime testing. Keep the
  legacy project read-only as reference until launch confirms, then pause it.
- [ ] **T0.3 Point mobile at LocalCheckProd** (.env + EAS env: URL +
  publishable key), verify auth, check-in/out, scoped realtime, runs, feed.
- [ ] **T0.4 Migrate client reads to v2 tables/RPCs** (services layer:
  activity_events replaces the 4-query feed reconstruction; runs/matches
  naming). One PR per service.

## Phase 1 — brand & token adoption (all OTA)
- [ ] **T1.1 Adopt the final palette from the brand sheet** (one accent;
  win/loss monochrome #F2F2F6/#52525E; sport = badge metadata, never a color
  system). Update constants/colors.ts + DESIGN.md front matter together.
- [ ] **T1.2 Typography per sheet**: display 36 / h1 22 caps / wordmark 26 /
  body 14 / label 9 caps. Map into constants/typography.ts tokens; sweep any
  screen hand-rolling sizes.
- [ ] **T1.3 App icon + splash from final mark** (build-gated; regenerate from
  assets/brand/logo-mark.svg; verify on next binary).

## Phase 2 — court page (the shared destination, web parity)
- [ ] **T2.1 Court hero card**: LIVE NOW ribbon, name + sport badge,
  distance · address, ACTIVE NOW / LOCALS stat pair, full-width CHECK IN +
  chevron. One component used by court/[id] and the court sheet peek.
- [ ] **T2.2 Tabs FEED / LOCALS / DETAILS** on court/[id] exactly like web:
  feed (check-ins + games, color-coded), locals (HERE NOW section then LOCALS
  with last check-in + elo), details (hours, surface, add-photo, map link).
- [ ] **T2.3 Retire duplicated court UI**: home court block, court sheet full
  layer, and court page share these components (single source).

## Phase 3 — schedule feature (already proven on web)
- [ ] **T3.1 Weekly heatmap**: 7-day × time-slot grid of planned_visits
  density (accent intensity), tap cell → who's coming modal. Data:
  fetchPlannedVisits per court week (FK fixed 2026-07-18).
- [ ] **T3.2 Quick input**: tap-day-then-time multi-select posting
  planned_visits; default court = local court; move POST MY TIME to bottom.
- [ ] **T3.3 Run cards**: 12-hour times (device locale), time+day left, fill
  count centered chip, drop hardcoded ALL LEVELS, RESERVE before start time →
  LOG A GAME after.

## Phase 4 — remaining screens
- [ ] **T4.1 Me page**: name top, activity stats row, tabs RECENT GAMES /
  NOTIFICATIONS / FRIENDS; real numbers; 5 matches then LocalPlus gate; fix
  UNRANKED dead space.
- [ ] **T4.2 Home**: ScreenHeader lockup ("LOCALCHECK"), court card via T2.1
  component, feed color-coded + scrollable with VIEW MORE.
- [ ] **T4.3 Explore**: section labels on one gutter, 5 nearby + VIEW MORE,
  Compete filter row alignment (sport left, LOCAL/STATE/GLOBAL right).
- [ ] **T4.4 Onboarding**: splash → auth (buttons bottom) → display name →
  preferred sport → location (zip / share / explore map). Preferred sport
  drives all sport defaults; Compete loses ALL.
- [ ] **T4.5 Privacy MVP**: hidden users grouped as one blurred "<5 / <10 /
  10+" chip in who's-here; leaderboards public-only; friends-visibility shows
  to friends; own view shows would-be rank ("#N — HIDDEN").

## Phase 5 — maps binary
- [ ] **T5.1 EAS build v1.0.4** with @rnmapbox/maps (needs
  MAPBOX_DOWNLOADS_TOKEN secret sk.* with Downloads:Read as EAS env var),
  verify native map on TestFlight: dark style, viewport courts, clustering,
  locate-me, court sheet from pins.
- [ ] **T5.2 Optional Studio style**: publish custom Mapbox style, set
  EXPO_PUBLIC_MAPBOX_STYLE_URL (no code change).
