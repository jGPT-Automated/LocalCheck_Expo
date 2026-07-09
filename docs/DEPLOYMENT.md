# Deployment — Expo / EAS / TestFlight

How the app is built, submitted, and iterated, and how a push to GitHub reaches
your phone. All commands run from `artifacts/mobile/`.

---

## 1. The mental model

There are **two ways a change reaches an installed app**:

1. **EAS Update (OTA)** — for JS / assets / styling / logic. Publishes a new
   bundle to a *channel*; installed builds download it on next launch. **Seconds,
   no rebuild, no Apple review.** This is the day-to-day loop.
2. **EAS Build + Submit** — for anything native: new native module, iOS
   permission, SDK bump, or any `app.json`/`eas.json` build-config change. Builds
   a fresh binary and uploads it to App Store Connect → TestFlight. **Minutes;
   internal TestFlight has no review.**

Rule of thumb: **if you added/changed a native dependency or edited `app.json`
build config, you need a build. Otherwise OTA is enough.**

OTA only works on builds created *after* EAS Update was configured (`updates.url`
in `app.json`, `channel` per profile in `eas.json`). Build 3 (the first
TestFlight build) predates that, so the **next** production build is the first
OTA-eligible one.

---

## 2. Channels & profiles

`eas.json` defines build profiles, each pinned to an EAS Update channel:

| Profile | Channel | Use |
|---|---|---|
| `development` | `development` | dev client builds |
| `preview` | `preview` | internal-distribution test builds |
| `production` | `production` | App Store / TestFlight builds |

An EAS Update *branch* maps to a *channel* of the same name by default, so
`eas update --branch production` reaches production-channel (TestFlight) builds.
`appVersionSource: remote` means EAS owns the build number and auto-increments.

---

## 3. Manual commands

```bash
cd artifacts/mobile

# OTA update to TestFlight builds (fast path)
eas update --branch production --message "what changed"

# Full production build (App Store / TestFlight)
eas build -p ios --profile production

# Submit a finished build to TestFlight (non-interactive)
eas submit -p ios --profile production --id <BUILD_ID> --non-interactive
```

- **Signing:** the iOS distribution certificate + provisioning profile are stored
  on EAS (generated once via `eas credentials -p ios`). No Apple ID login, no
  weekly 2FA re-auth.
- **Submission auth:** the App Store Connect **API key is stored on EAS**, and
  `eas.json`'s `submit.production.ios` carries `appleTeamId` + `ascAppId`, so
  submit runs non-interactively with no local `.p8`.

---

## 4. CI: GitHub → TestFlight (EAS Workflows)

Workflow files live in `artifacts/mobile/.eas/workflows/`:

| File | Trigger | Does |
|---|---|---|
| `publish-ota-update.yml` | push to `main` | `eas update --branch production` (OTA to installed builds) |
| `release-ios.yml` | push a `v*` tag, or manual dispatch | `eas build` (iOS production) → `eas submit` to TestFlight |

**Prerequisites (one-time, done in the Expo dashboard):**
1. Connect the GitHub repo to the EAS project:
   https://expo.dev/accounts/agenticjess-os/projects/localcheck/github
   → disconnect the old `agenticjess-star/LocalCheck_Expo`, connect
   `jGPT-Automated/LocalCheck_Expo`.
2. **Set Base directory = `artifacts/mobile`** (monorepo — required or CI can't
   find the app).

After that, the agent loop is: **make a change → PR → merge to `main` → OTA
auto-publishes → refresh the app on the phone.** Native changes go out by tagging
a release instead.

---

## 5. TestFlight testers

- An **internal** group ("Internal Testers", auto-access to all builds) exists.
  Internal testers must be App Store Connect **users**; they get every valid
  build automatically, **no review**. Invites are accepted via the emailed link
  (there is no "redeem code" for internal testing — that box is just TestFlight's
  empty state).
- To add someone whose Apple ID isn't an ASC user: either invite them as an ASC
  user first (Users and Access), or add them as an **external** tester. External
  testing needs a one-time Apple Beta App Review (~1 day) for the first build,
  after which you get a shareable public link.
- Account holder / current internal tester: `jessharrick@icloud.com`.

---

## 6. Is this "submitted to the App Store"? — No.

Uploading a build to App Store Connect (what `eas submit` does) feeds
**TestFlight** only. It does **not** submit the app for App Store review or
public release. A "Ready to Submit" badge in App Store Connect just means it
*could* be submitted — nothing is sent to review until you explicitly create and
submit an App Store version. The app is beta-only right now.

---

## 7. How `main` was assembled + production-readiness

`main` was consolidated from two divergent branches:

| Area | `hardcode-fix` | `stage3-groundwork` | Kept on `main` |
|------|----------------|---------------------|----------------|
| Home roster / "Next Run" | **Real** `useApp()` state | Faked (`SAMPLE_*`) | hardcode-fix |
| Find Courts | **Real** GPS + services + search | dropped | hardcode-fix |
| Service layer | Full (per-domain services) | single `social.ts` | hardcode-fix |
| `lib/supabase.ts` storage | AsyncStorage | **SecureStore + web fallback** | stage3 |
| Build config (`app.json`, `eas.json`) | missing | **present** | stage3 |

Production-readiness changes made on top: auth-first gate (see AGENTS.md rule 1),
signup always writes to the DB (trigger + client upsert fallback), removed all
AsyncStorage app-data and `SAMPLE_*` mock data, location-aware court loading, and
iOS permission strings + `ITSAppUsesNonExemptEncryption: false` for export
compliance. No destructive DB migrations — only existing `profiles` columns reused.

---

## 8. Known issues / follow-ups

- **Typecheck:** shipping app is clean. ~210 pre-existing errors live under
  `artifacts/mobile/mockup-sandbox/` (not shipped) + 1 in `elo.tsx` — inherited,
  not from this work.
- **P0 data bugs** (log game, join/host run) are broken against live enums today
  — see `docs/SOURCE_OF_TRUTH.md` §3–4.
- **Rotate the Supabase account access token** pasted during setup
  (`docs/SECRETS_AND_ENV.md` §5).
