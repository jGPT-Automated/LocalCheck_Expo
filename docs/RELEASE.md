# Release and rollback

Four paths. The two previews are automatic; builds and production updates are
started by hand. Nothing builds or ships to players on merge (D22).

| Path | Trigger | Cost | Use for |
|------|---------|------|---------|
| PR preview (Expo Go) | Opening or pushing a PR to `main` (`.github/workflows/expo-pr-preview.yml`) | EAS Update only | Every change. Jesse scans the QR on the PR. |
| Web preview (browser) | Any push to any branch (Vercel project `localcheck-app-preview`, linked to this repo) | Free | A second "device": sign in as another account to test two-player flows (challenges, reviews); quick look before a PR. Link: the Vercel bot / deployment list for the branch. Real Supabase data. No map token, purchases or native features on web. |
| Production OTA | `Publish production OTA` from the EAS dashboard (`.eas/workflows/publish-production-ota.yml`) | EAS Update only | JavaScript/asset changes compatible with the installed build. |
| TestFlight build | `Release iOS to TestFlight`, "Run workflow" in GitHub Actions (`.github/workflows/release-ios.yml`) | **One of the plan's monthly iOS builds** | Native changes, the review build. Jesse starts it, no one else (D22). |

**Protect the build quota.** Agents never start a build, OTA, or submission.
They say when a change needs a build and why, and Jesse decides.

## Before merge (only Jesse merges)

1. CI is green on the pull request (`quality` and `docs updated`) and review
   conversations are resolved. GitHub does not enforce this today: `main` has
   no branch protection (`docs/GITHUB.md`), so Jesse checks it before merging.
2. The PR says whether the change is JavaScript-only, native, or backend.
3. Jesse has previewed it in Expo Go.
4. Any database change is already applied, verified, and recorded (see
   `docs/SUPABASE.md`), and works with the installed build.

## Expo Go previews: what they can and can't show

PR previews run in Expo Go on SDK 54, so:

- No dev-build-only libraries (`@expo/ui`, SDK 55+ APIs). Reanimated 4,
  gesture-handler, `@gorhom/bottom-sheet`, expo-haptics and expo-camera are
  fine.
- The Explore map shows a nearby-court list instead of Mapbox.
- In-app purchases need a TestFlight build (sandbox account).

## Native changes waiting for the next build

The next TestFlight build picks these up; until then the installed build keeps
the old behavior:

- One camera permission string covering player QR codes and court photos
  (`app.config.js`).
- `expo-image-picker` removed (it was unused).
- Auto check-in (D35): `expo-task-manager` added; the "Always" location
  purpose string; the `location` background mode
  (`isIosBackgroundLocationEnabled`), which expo-location requires before it
  starts geofencing. expo-task-manager also adds the `fetch` mode (unused,
  harmless). Geofencing can only be tested on a real build, never in Expo Go.
  App Review notes must say background location is used only for opt-in auto
  check-in at the player's one local court.
- Privacy manifest declares Precise Location (linked to the user, app
  functionality, not tracking): a check-in records the player at a court.
  The App Store Connect privacy answers must match.

Runtime version policy is `appVersion`. Auto check-in adds a native module
(`expo-task-manager`), so its PR bumps the app version to **1.0.4**: OTAs for
1.0.4 only reach builds that have the module, and the 1.0.3 build on phones
keeps getting 1.0.3 updates only. Never publish 1.0.4 JavaScript to the 1.0.3
build.

## Production OTA

Run `Publish production OTA` after merge when the change is JavaScript-only.
It runs `pnpm check` first. If an OTA is bad, republish the last known-good
update to the `production` channel from EAS Update.

## TestFlight build

`Release iOS to TestFlight` builds the `production` profile and submits it to
App Store Connect. The step waits for the EAS build and the auto-submit instead
of exiting when the job is queued, so a green check means EAS finished both
(last seen working: run 19, Sep 14, build 33). Apple's processing in App Store
Connect happens after that and is not covered by the check. EAS owns signing;
build numbers increment remotely (`appVersionSource: remote`).

State on 2026-10-14: the workflow was disabled in GitHub on Oct 3 and enabled
again on Oct 14 (GitHub API). The newest iOS build is 1.0.3 (33), Sep 14 (EAS
build list); none has run in October. Runs 20–25 (Sep 15–30) failed: September's
build quota ran out, then the `ios/` folder (removed by #61) broke the build.

After a build:

1. Wait for App Store Connect processing; note the build number.
2. Install it from TestFlight and run the native checks in `docs/TESTING.md`
   (camera, notifications, Apple Sign-In, purchases in sandbox).
3. For App Review: attach both LocalPlus subscriptions (Monthly, Yearly) to
   the version, fill in the reviewer account and notes, privacy answers,
   screenshots, and the support / privacy / terms URLs
   (`https://localchecksports.com/support`, `/privacy`, `/terms`; support
   email `localchecksports@gmail.com`). Account deletion is in Settings.

## Edge Functions

None is waiting for deploy (Supabase function list, 2026-10-14). The
`send-notification` change that passes `data.category` (action buttons) and
`data.collapse_id` (the posted notice replaces the arrival notice) was deployed
as version 5 on Oct 12, before #67 merged; the push text it carries is "Auto
checked out" with I'm still here (D52, D53), not the older "You've been checked
out" with Check back in / Got it (D38). Build 33 has no auto check-in, so it
shows these pushes without buttons; tapping opens the court page.

## Backend order

Apply additive database changes before the client that depends on them. Edge
Functions and migrations are separate production actions: merging their
source deploys nothing.

## PR #84 LocalPlus court list (Oct 29, on branch)

The court-list UI and geofence reconciliation use modules already installed
(expo-location / expo-task-manager); no native config or dependency changed.
The saved-courts database migration must be applied and verified before the
new paid list can work in connected previews. No production update or build
is started by this work. Expo Go/web can show list/preferences and navigation;
background geofencing remains unavailable in Expo Go/web.

Paid region identifiers are namespaced inside the existing Expo task and decoded
before RPC calls. On entitlement downgrade those registrations stop; the
existing free single-court opt-in remains available. This is JavaScript using
installed TaskManager APIs, not a native configuration change.
