# LocalCheck — Development & Deployment Guide

This document captures how the app is wired, the work done to make it
production-ready, and how to build, ship, and iterate on it.

---

## 1. Repository & source of truth

- **Repo:** `jGPT-Automated/LocalCheck_Expo` (this repo) — the single source of
  truth going forward. The old `agenticjess-star/LocalCheck_Expo` repo is
  deprecated.
- **App code:** `artifacts/mobile/` (Expo / React Native app). Other workspace
  packages live under `artifacts/`.
- **Package manager:** pnpm (workspace). The image's bundled corepack pnpm was
  broken, so setup uses a standalone pnpm install.

### How `main` was assembled (branch consolidation)

`main` was consolidated from two divergent branches that had each kept
different halves of a working app:

| Area | `hardcode-fix` | `stage3-groundwork` | Kept on `main` |
|------|----------------|---------------------|----------------|
| Home roster / "Next Run" | **Real** `useApp()` context state | Faked (`SAMPLE_PLAYERS`/`SAMPLE_RUNS`) | hardcode-fix |
| Find Courts | **Real** GPS + service layer + search | Feature dropped | hardcode-fix |
| Service layer | Full (`checkInService`, `feedService`, `gameService`, `profileService`, `scheduledGameService`, `friendshipService`) | Single `social.ts` | hardcode-fix |
| `lib/supabase.ts` storage | AsyncStorage | **SecureStore native + web localStorage fallback** | stage3 |
| Build config (`app.json` owner/android/EAS projectId, `eas.json`) | Missing | **Present** | stage3 |

Rule of thumb: **hardcode-fix supplied the real data/feature wiring; stage3
supplied the deployment plumbing.** `main` = hardcode-fix base + stage3 build
config + stage3 Supabase storage adapter.

---

## 2. Production-readiness changes

The app previously opened straight to Home with mock data. Root cause: **every
Supabase RLS policy is `authenticated`-only**, but there was no session, so
every query was silently blocked and the UI fell back to empty/mock data.

What changed:

1. **Auth-first gate** — signed-out users land on Sign In / Create Account.
   `(tabs)` only render with a Supabase session. This alone makes real data
   appear.
2. **Signup always writes to the DB** — the `handle_new_user` trigger inserts
   the profile; a client-side `upsert` fallback (allowed by
   `profiles_insert_self`) guarantees a profile row and removes the scary
   "profile provisioning failed" path.
3. **No local storage of app data** — removed AsyncStorage and all
   `localcheck:*` keys. User prefs now live on the `profiles` row
   (`local_court_id`, `preferred_sport`, `is_pro`). The Supabase **session
   token** still persists via SecureStore (required to stay logged in; this is
   standard and native-secure — it is *not* app data caching).
4. **Location-aware courts** — after GPS permission, courts load from Supabase
   nearest-first; the closest court is auto-set as the user's local court and
   saved to their profile. Falls back to LA if location is denied.
5. **No mock data** — deleted all `SAMPLE_*` arrays; user-added courts insert
   into the `courts` table.
6. **App Store readiness** — iOS location/camera/photo permission strings,
   config plugins, and `ITSAppUsesNonExemptEncryption: false` (export
   compliance) so builds don't stall.

No destructive DB migrations were made — only existing `profiles` columns were
reused.

---

## 3. Key configuration values

| Thing | Value |
|-------|-------|
| iOS bundle identifier | `com.realjess.localcheck` |
| Expo account (owner) | `agenticjess-os` |
| Expo / EAS project id | `9c906173-0258-45a9-a3fe-786cda373c66` |
| App Store Connect app id | `6786909608` |
| Apple Team id | `6HHLJVQC6W` (Individual account) |
| ASC API key id | `Y8Z8J4Q7FT` |
| ASC API key issuer id | `8b08a203-9143-441b-abad-93f361dbecab` |
| Supabase URL | `https://jzclwnzcektqhgkkdeje.supabase.co` |

### Secrets (never committed)

- **Supabase** build-time values are stored as **EAS environment variables**
  (production): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **App Store Connect API key** (`.p8`) lives at
  `artifacts/mobile/.secrets/asc_api_key.p8` — gitignored. `eas.json` references
  it by path for non-interactive submits. The key id and issuer id are non-secret
  identifiers and are safe in `eas.json`; the `.p8` private key is what must stay
  out of git.
- **Expo access token** (`EXPO_TOKEN`) is used to run EAS commands under the
  `agenticjess-os` account.

---

## 4. Build, submit, and iterate

All commands run from `artifacts/mobile/`.

### Production build (App Store / TestFlight)

```bash
eas build -p ios --profile production
```

Signing is fully managed by EAS using the ASC API key — **no Apple ID login or
weekly 2FA re-auth**. The distribution certificate + provisioning profile were
generated once via `eas credentials -p ios` and are stored on Expo's servers.

### Submit to TestFlight

```bash
eas submit -p ios --profile production --id <BUILD_ID> --non-interactive
```

`submit.production.ios` in `eas.json` carries `ascAppId` + the ASC API key
config, so this runs non-interactively.

### Fast iteration with OTA updates (EAS Update)

For JS/asset-only changes (most day-to-day work), publish an over-the-air update
instead of a full rebuild:

```bash
eas update --branch production --message "your change"
```

The change reaches the app in seconds — no rebuild, no App Store review.

> OTA only applies to builds created **after** EAS Update was configured
> (`updates.url` + `runtimeVersion` in `app.json`, channels in `eas.json`).
> Any binary built from that point forward is OTA-eligible.

### TestFlight testers

- An **internal** beta group ("Internal Testers", access to all builds) is set
  up. Internal testers must be App Store Connect users; they get every valid
  build automatically with no review.
- To add someone whose Apple ID is **not** an ASC user, either (a) invite them
  as an ASC user first (Users and Access → then add to the internal group), or
  (b) add them as an **external** tester — external testing requires a one-time
  Apple Beta App Review (~1 day) for the first build.

---

## 5. Known issues / follow-ups

- **Typecheck:** the shipping app is clean (0 errors). ~210 pre-existing errors
  remain under `artifacts/mobile/mockup-sandbox/` (a scratch/mockup area, not
  shipped) plus 1 in `elo.tsx` — inherited, not from the consolidation.
- **ASC key on EAS servers:** uploading the ASC API key to Expo (so submits need
  no local `.p8`) currently forces an Apple ID login in the CLI, so the local
  `.p8` + `eas.json` path is used instead.
- **Rotate the Supabase account access token** that was pasted in chat during
  development (Supabase → Account → Access Tokens).
