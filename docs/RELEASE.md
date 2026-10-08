# Release and rollback

Three release paths, all started by hand. Nothing builds or ships on merge.

| Path | Trigger | Cost | Use for |
|------|---------|------|---------|
| PR preview (Expo Go) | Opening or pushing a PR to `main` (`.github/workflows/expo-pr-preview.yml`) | EAS Update only | Every change. Jesse scans the QR on the PR. |
| Production OTA | `Publish production OTA` from the EAS dashboard (`.eas/workflows/publish-production-ota.yml`) | EAS Update only | JavaScript/asset changes compatible with the installed build. |
| TestFlight build | `Release iOS to TestFlight`, "Run workflow" in GitHub Actions (`.github/workflows/release-ios.yml`) | **One of the plan's monthly iOS builds** | Native changes, the review build. Jesse starts it, no one else (D22). |

**Protect the build quota.** Agents never start a build, OTA, or submission.
They say when a change needs a build and why, and Jesse decides.

## Before merge (only Jesse merges)

1. `pnpm check` passes in CI and review conversations are resolved.
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
App Store Connect, waiting for the real result (a green check means the build
reached TestFlight). EAS owns signing; build numbers increment remotely.

After a build:

1. Wait for App Store Connect processing; note the build number.
2. Install it from TestFlight and run the native checks in `docs/TESTING.md`
   (camera, notifications, Apple Sign-In, purchases in sandbox).
3. For App Review: attach both LocalPlus subscriptions (Monthly, Yearly) to
   the version, fill in the reviewer account and notes, privacy answers,
   screenshots, and the support / privacy / terms URLs
   (`https://localchecksports.com/support`, `/privacy`, `/terms`; support
   email `localchecksports@gmail.com`). Account deletion is in Settings.

## Edge Function waiting for deploy

- `send-notification`: passes `data.category` as `categoryId`, so the 3-hour
  "You've been checked out" push shows Check back in / Got it (D38). Deploy
  after #67 merges, with Jesse's OK. Until then the push still arrives, and
  tapping it opens the court page.

## Backend order

Apply additive database changes before the client that depends on them. Edge
Functions and migrations are separate production actions: merging their
source deploys nothing.
