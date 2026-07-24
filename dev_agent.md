# dev_agent.md — LocalCheck working knowledge base & jump index

> Living doc for any dev agent (Claude, Codex, Devin) working on LocalCheck.
> Read `AGENTS.md` first (rules + canonical repo/backend), then this file for
> the working map, skill pathways, and activity log. Update the log every session.

## What we're building (product truth)

Pickup-sports presence app: **sign up → explicitly pick your local court → see
who's there live → check in → log games (real Elo) → local leaderboard.**
Basketball + pickleball. iOS-first via TestFlight (`LocalCheck: Pickup Sports`
in App Store Connect). ~25–35 real testers waiting. The ~5,700 seeded courts
are INTENTIONAL (high-traffic, young-demo zip codes) — never "clean them up."
Growth loop: log a game with someone → they install → they set a court.
No ads. LocalPlus (paid) gates history depth + leaderboard visibility later —
hidden for MVP.

## Repo map (what actually matters)

```
artifacts/mobile/            ← THE APP (Expo Router, RN 0.8x, Expo SDK 54)
  app/                       routes: (tabs)/ home·schedule·compete·explore·me,
                             auth.tsx, onboarding.tsx (PR #7), court/[id], run/[id],
                             player/[id], friends, settings
  components/                HomeScreen, CourtsScreen (Explore), MapScreen,
                             CourtBottomSheet, BrutalistButton, …
  context/AppContext.tsx     global state: courts, localCourtId (authoritative from
                             profiles.local_court_id), check-ins, feed, runs, friends;
                             30s polling
  context/AuthContext.tsx    Supabase session + profile provisioning (SecureStore
                             native / localStorage web — INTENTIONAL, keep)
  services/                  courtService, checkInService, gameService, profileService,
                             feedService, scheduledGameService, friendService
  lib/supabase.ts            client init (env: EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY)
docs/SOURCE_OF_TRUTH.md      canonical state doc · docs/supabase/ schema notes
.agents/skills/              per-repo skills (see Skill pathways below)
```

Design language: **dark editorial brutalism** — `#FF5500` accent on `#0D0D10`,
Oswald (headings) + Inter (body), all-caps labels, 1px borders, sharp corners.
This is the brand; generated palettes do not override it.

## Backend (Supabase LocalCheckProd `qkrnmyexzvaxiqfxwwfb` — legacy `jzclwnzcektqhgkkdeje` retired 2026-07)

- Tables: profiles, courts (5.7k), check_ins, games + game_participants,
  scheduled_games + participants, friendships, feed_posts (+likes), push_tokens.
- **RPCs that MUST be used instead of raw writes:**
  - `switch_active_checkin(p_court_id, p_visibility, p_note)` → atomic check-in
    switch (wired in PR #9)
  - `log_game(p_court_id, p_opponent_id, p_my_side, p_score_a, p_score_b,
    p_winner_side, p_notes)` → authoritative game + Elo K=32 (NOT yet wired — PR 3)
- `profiles.is_pro` is trigger-derived from `subscriptions` — never client-write.
- Enums are lowercase (`game_side` a/b, sports lowercase).
- **2026-07-10 migration `repoint_user_fks_to_profiles_for_postgrest_embeds`:**
  all user-id FKs now reference `public.profiles(id)` (was `auth.users`) so
  PostgREST `profiles(...)` embeds work. This unbroke ALL social reads.
- Known debt: account deletion blocked by ON DELETE RESTRICT (needs product
  decision); 3 summary views are SECURITY DEFINER (flagged by advisor, fix with
  the map work); email confirmations OFF (intentional during testing).

## Codebase gotchas (hard-won)

- Services swallow errors (`catch { /* best-effort */ }`) — never trust "no
  error thrown"; verify against live DB (Supabase MCP) before claiming a fix.
- The pnpm lockfile excludes non-Linux binaries (Replit artifact): on macOS,
  place `lightningcss.darwin-arm64.node` into
  `node_modules/.pnpm/lightningcss@1.31.1/…/lightningcss/` after any fresh install.
- Typecheck: `pnpm --filter @workspace/mobile run typecheck` — ignore
  pre-existing `mockup-sandbox` errors.
- Web preview works: `npx expo start --web` from `artifacts/mobile` (env in
  local `.env`). Good for full-flow QA with scratch accounts (email confirm off;
  QA account: claudeqa1@localcheck.dev).
- Map/Explore currently use TWO court sources (legacy Express `/api/courts` +
  Supabase) — unification is the map workstream (see queue).
- Build 3 on TestFlight predates EAS Update — OTA reaches it only AFTER the
  next binary ships. EAS Workflows: OTA on push to main, build+submit on tag.

## Skill pathways (read/run these for the matching work)

| Work | Skill / resource |
|---|---|
| Any UI/UX change | **Read `DESIGN.md` first** (spec-format: front-matter tokens are normative; validate edits with `npx -p @google/design.md designmd lint DESIGN.md`). Then `.agents/skills/ui-ux-pro-max` — RUN the engine: `python3 scripts/search.py "<query>" --design-system` and `--stack react-native`; pre-delivery checklist inside |
| Logo / brand asset swap | `DESIGN.md` §"Brand assets & logo swap" — one table says which file to replace and whether it's OTA or build-gated. In-app logo ONLY via `components/brand/LogoMark.tsx` |
| Bottom sheets / drawers | Reuse `components/sheet/CourtSheetHost.tsx` stack (@gorhom/bottom-sheet). Do NOT use expo-router formSheet detents — shipped broken on both platforms (2026-07-17), removed 2026-07-18 |
| Curated design refs | github.com/stars/jGPT-Automated/lists/design (impeccable, awesome-design-md, open-design, design.md spec, emilkowalski/skills, SwiftUI-Animations, swift-ios-skills, motion-primitives, cult-ui) |
| Native-feel Expo UI | `.agents/skills/building-native-ui` (+ its references/: animations, tabs, sheets, icons, search) — conventions: safe areas via `contentInsetAdjustmentBehavior`, boxShadow not legacy shadows, formSheet presentation |
| Animation/interaction polish | emilkowalski/skills → apple-design: springs over durations (damping 1.0 resp 0.3–0.4s; 0.8 for momentum), interruptibility, velocity handoff, haptics on commit |
| iOS design judgment | `.agents/skills/mobile-ios-design` (HIG) |
| RN architecture | `.agents/skills/react-native-architecture` |
| DB/queries/RLS | `.agents/skills/supabase-postgres-best-practices` (rule files in references/) |
| Builds/TestFlight/store | `.agents/skills/expo-deployment` (references/testflight.md, app-store-metadata.md) |

## Activity log

- **2026-07-07** — Devin: PR #2 (Supabase wiring, court schema fix), PR #3 (EAS config,
  seeds, docs), repo consolidated to single main. Build 3 → TestFlight, internal testing live.
- **2026-07-09** — Live audit (Claude chat): found unused `log_game` /
  `switch_active_checkin` RPCs, enum mismatches, seeded-data-only games; created
  SOURCE_OF_TRUTH + baseline snapshot; `push_tokens` table created.
- **2026-07-10 (Claude Code session)** —
  - **DB migration**: repointed 9 user FKs auth.users→profiles → fixed the 400s
    killing who's-here/games/runs/friends/feed. Presence verified live (web + TestFlight).
  - **PR #8**: no silent local-court assignment + explicit clear ("REMOVE MY LOCAL COURT").
  - **PR #9**: check-in via `switch_active_checkin`, stale-court refresh fix
    (switch-court repro), `.maybeSingle()` 406 fix, no silent write failures.
  - **PR #7 (Codex) reviewed**: onboarding is court-assignment-safe; flagged
    (a) all 15 existing users will one-time onboard (preferred_sport null),
    (b) username-collision errors swallowed on onboarding step.
  - Workspace docs live in `/Users/JesseH/Documents/LocalCheck_Testflight/`
    (ROADMAP.md, FIXLIST.md, findings/).

- **2026-07-15 (Claude Code session)** —
  - **Deploy pipeline repaired.** Root-caused both broken EAS workflows from live
    worker logs: EAS default pnpm <10 can't read our lockfile/workspace overrides.
    Merged PR #16 (pnpm pin + OTA channel routing, schema-validated), released
    **v1.0.3 → build 1.0.0 (6) on TestFlight** (tag created via `gh api` — local
    git pushes unauthorized). OTA's second failure diagnosed (workers default
    Node 18, Metro needs ≥20.19.4) → `node: '20.19.4'` pin.
  - **Docs:** new `docs/PLAYBOOK_DEPLOY.md` (deploy procedure + verification
    gates), new `DESIGN.md` (design-system snapshot), README corrected to
    current architecture (kept comprehensive per Jesse's explicit preference).
  - Queue-time gotcha recorded: free-tier EAS runs can sit 30–90 min
    "searching for a worker" — not a config failure.
  - Next agreed focus (Jesse): **MVP three-pillar push** — live presence
    everywhere, map redesign (separate Sonnet thread), real game loop; plus
    Explore court-sheet rebuild to spec, notifications scaffold, Me-page
    activity/pending, Settings reorg (sport+local court to top).

- **2026-07-18 (Claude Code session — design & drawer sprint)** —
  - **Court drawer rebuilt (3rd time, now standard components):** the sprint-2
    native formSheet route rendered blank on device and a dead-end full page on
    web. Replaced with `@gorhom/bottom-sheet` 5.2.14 (JS-only over reanimated
    4.1 + RNGH 2.28 already in the binary → OTA-safe): `CourtSheetProvider`
    hosts one `BottomSheetModal` at root; open anywhere via
    `useCourtSheet().openCourtSheet({courtId})`. Snap 46%/92%, backdrop-tap +
    swipe-down dismiss, tap-the-hint expands (mouse affordance). Verified live
    on web preview incl. realtime counts. `app/court-sheet.tsx` deleted.
  - **Brand pass:** adopted Jesse's court-frame mark (navy/cream/orange, from
    LocalCheck.pdf drafts). New `assets/brand/logo-mark.png` (+ .svg source),
    new `assets/images/icon.png` + `splash-icon.png` (replaces the green
    basketball-Saturn "spaceship"; needs a tagged build to reach devices),
    splash bg → #0D0D10, `components/brand/LogoMark.tsx` = single in-app
    logo entry point. Auth screen: back button removed, logo + tagline added.
    In-app boot screen (AuthGate) shows the mark (OTA).
  - **Consistency:** new `ScreenHeader`/`SectionHeader` components; Explore,
    Compete, Schedule headers now render through them (Home still custom).
  - **DESIGN.md rewritten to the google-labs-code/design.md spec** (YAML
    tokens + canonical sections; lints 0 errors).
  - **Found + diagnosed live bug:** `planned_visits.user_id` FK still points
    at auth.users → every `fetchPlannedVisits` fails (schedule's pulling-up
    silently empty). Migration written to
    `docs/supabase/migrations/20260718_repoint_planned_visits_user_fk_to_profiles.sql`
    — NOT applied (session permission layer blocked live DDL; needs go-ahead).
  - Note: `@gorhom/bottom-sheet` added to `artifacts/mobile` deps; most deps
    oddly live in devDependencies (Replit artifact) — works, left as-is.

## Work queue (agreed order)

1. ~~Presence backend (FK migration)~~ ✅ · ~~PR 1 local court~~ ✅ (#8) · ~~PR 2 check-in loop~~ ✅ (#9)
2. **PR 3 — real game loop**: wire `log_game` RPC into Compete's Log Game;
   validate scores, no ties, surface errors, refresh profile/history/leaderboard;
   kill Run Detail's client-only ±15 path. Then game shows on Me page.
3. **Schedule tab**: make create/join runs work end-to-end (UI + `scheduled_games`).
4. **Compete split**: filter leaderboard by preferred sport (single Elo for now).
5. **Home + court-detail redesign** (Jesse has UI notes: court detail loses
   fake stats — ratings/%full; add Active Locals, Total Locals, days active,
   map icon, Open/schedule times; hide unknown detail rows instead of "—").
6. **Map/Explore rework**: read
   `LocalCheck_Testflight/findings/iOS App Repository Review - chatgpt thread.md`
   FIRST (full read), verify claims against code, then: single Supabase court
   source, viewport RPCs (`courts_in_view` etc., SECURITY INVOKER), zoom-tiered
   markers (state/city/court), no LA fallback, locate-me button.
7. QR code on Me tab (add friend / pick opponent fast). 8. Settings that persist.
9. Compliance pass (account deletion, legal links, hide LocalPlus UI) → external testers.
