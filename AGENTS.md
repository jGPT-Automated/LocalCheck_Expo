# AGENTS.md — LocalCheck agent onboarding & context

**Read this first, every session.** It is the single entry point for any agent
(or human) working on LocalCheck. It links out to the deeper docs and states the
rules that keep changes from silently breaking against the live backend.

> This file and the docs it points to are **living documents**. When something
> ships or a new gotcha is found, update the relevant file — don't spawn a new
> one. Duplication is the enemy here.

---

## 1. What LocalCheck is

A React Native / Expo mobile app for pickup sports: find nearby courts, check in,
see who's playing, log games (with Elo), schedule/join "runs", and track friends.
iOS-first, distributed via TestFlight today.

- **Canonical repo:** `jGPT-Automated/LocalCheck_Expo` @ `main` (this repo). The
  old `agenticjess-star/*` repos are **deprecated — do not touch them.**
- **Canonical backend:** Supabase project `jzclwnzcektqhgkkdeje` (Postgres +
  Auth + RLS). There is no other backend.
- **App code lives in a monorepo subfolder:** `artifacts/mobile/`. All Expo/EAS
  commands run from there.

---

## 2. Repo layout (what matters)

```
artifacts/mobile/            ← the Expo app (run all eas/expo commands here)
  app/                       ← screens (expo-router; file-based routing)
    (tabs)/                  ← main tab screens (home, explore, compete, me, schedule)
    auth.tsx                 ← sign in / create account (auth-first gate)
    court/ player/ run/      ← detail routes
  services/                  ← Supabase data layer (one file per domain)
  context/                   ← AuthContext (session) + AppContext (app state)
  lib/supabase.ts            ← Supabase client + SecureStore session adapter
  app.json                   ← Expo config (bundle id, permissions, updates.url)
  eas.json                   ← EAS build + submit profiles
  .eas/workflows/            ← EAS Workflows CI/CD (OTA on push, build on tag)
docs/                        ← all project docs (see index below)
```

- **Do NOT ship from `artifacts/mobile/mockup-sandbox/`** — it's a scratch/mockup
  area with ~210 pre-existing typecheck errors and is not part of the app.

---

## 3. Quick start (local)

```bash
cd artifacts/mobile
# Env: copy .env.example -> .env and fill Supabase values (see docs/SECRETS_AND_ENV.md)
pnpm install            # workspace uses pnpm; the image's corepack pnpm is broken
npx expo start          # dev server (press w for web, or scan QR with a dev build)
pnpm typecheck          # app is clean; ignore mockup-sandbox/* + elo.tsx (pre-existing)
```

Native modules in use (Apple Sign-In, SecureStore, Location) **do not run in
plain Expo Go** — use a development build or Expo web for quick checks.

---

## 4. Golden rules (break these and things fail *silently*)

These come from verifying the code against the live database. See
`docs/SOURCE_OF_TRUTH.md` §3 for the receipts.

1. **RLS is `authenticated`-only.** Every table's row-level-security policy
   requires a logged-in session. No session ⇒ every query returns empty and the
   UI looks "broken"/mocked. The app is auth-first by design: no session ⇒ land
   on `auth.tsx`; tabs only render with a session. Don't undo this.
2. **Never write `profiles.is_pro` from the client.** It is derived by a DB
   trigger from the `subscriptions` table. Write to `subscriptions`; let the
   trigger set `is_pro`.
3. **Prefer the existing RPCs over raw inserts** for games and check-ins:
   `log_game(...)` and `switch_active_checkin(...)` already exist server-side,
   are correct, and do the atomic multi-table writes + Elo. Full defs in
   `docs/supabase/baseline_snapshot.sql`.
4. **Enum casing is lowercase.** `winner_side`/`team_side` are `a`/`b` (not
   `A`/`B`); `scheduled_games.status` is `scheduled` (not `open`); RSVP is
   `going`/`waitlist`/`declined` (not `team_a`/`team_b`). The current client
   sends the wrong values in a few places — see the P0 tasks.
5. **Silent-catch gotcha.** The service layer is full of
   `catch { /* best-effort */ }` blocks that swallow Supabase errors. "No error
   thrown" is **not** proof a write worked. After a data change, verify the row
   actually landed (query the live DB via the Supabase MCP, or check in-app).
6. **No mock/sample data, no AsyncStorage app-data caching.** Both were removed.
   The only client-persisted state is the Supabase session token (via
   SecureStore) — that's required and stays.
7. **Schema is not in migrations.** The live schema/triggers/RPCs exist only in
   Supabase. `docs/supabase/baseline_snapshot.sql` is the reverse-engineered
   baseline. For new schema changes use Supabase migrations so history exists.

---

## 5. What to work on

The prioritized, verified task list (P0 broken-today → P3 polish) lives in
**`docs/SOURCE_OF_TRUTH.md`**. Start there. It is kept current against the live
source and database. Do not re-derive scope from memory or old audits.

---

## 6. Deploying your change (how it reaches the phone)

Two paths — pick based on what you changed:

| You changed… | Path | How |
|---|---|---|
| JS / styling / assets / logic only | **OTA (seconds)** | push to `main` → `Publish OTA update` workflow runs `eas update` → installed TestFlight build refreshes on next launch |
| Native module, permission, SDK bump, `app.json`/`eas.json` build config | **Full build (minutes)** | tag a version (`git tag v1.0.1 && git push --tags`) → `Release iOS` workflow builds + submits to TestFlight |

Full details, manual commands, and TestFlight tester setup are in
**`docs/DEPLOYMENT.md`**. Credentials/secrets needed are in
**`docs/SECRETS_AND_ENV.md`**.

---

## 7. Doc index

- `docs/SOURCE_OF_TRUTH.md` — project status + prioritized task list (**start here for work**)
- `docs/DEPLOYMENT.md` — Expo/EAS build, submit, OTA, TestFlight, CI workflows
- `docs/SECRETS_AND_ENV.md` — every secret/env var, where it lives, how to rotate
- `docs/supabase/baseline_snapshot.sql` — reverse-engineered DB schema/triggers/RPCs
