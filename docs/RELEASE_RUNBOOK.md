# Expo and TestFlight release runbook

Last verified end-to-end: 2026-08-01, `v1.0.5` → TestFlight `1.0.1 (13)`

This is the canonical repeatable path. Run Expo/EAS commands from
`/Users/JesseH/Projects/LocalCheck_Expo/artifacts/mobile`.

## 1. Confirm the release source

- Local branch is `main`.
- Working tree contains only the intended release changes.
- Local `HEAD` matches the intended GitHub main commit.
- Required checks and the requested physical/local QA have passed.
- `docs/CURRENT_STATE.md` and `docs/product/ACTIVITY_LEDGER.md` describe the candidate.
- Jesse has explicitly approved the release trigger.

## 2. Choose OTA or a native build

Use OTA only for JavaScript/TypeScript, ordinary styling, and compatible bundled
assets. A new native module, Expo SDK/config plugin, permission, entitlement,
icon/splash, `app.json`, `app.config.js`, or relevant `eas.json` change requires
a new binary.

The Mapbox native SDK/download-token change required a full build. Do not expect
that class of change to reach the phone through OTA.

## 3A. OTA path

1. Push the verified change to `main`.
2. The connected EAS workflow at `artifacts/mobile/.eas/workflows/publish-ota-update.yml` publishes to the production channel.
3. Confirm the workflow is successful and an update group exists on the production channel.
4. Cold-launch the installed TestFlight app as required by Expo Updates and verify the exact changed behavior.
5. Record the commit, workflow/update group, and phone result in the ledger/current-state doc.

## 3B. Native/TestFlight path

1. Push the verified release commit to `main`.
2. Create the next unique `v*` tag on that exact commit and push the tag.
3. The workflow at `artifacts/mobile/.eas/workflows/release-ios.yml` runs a production iOS build, then submits that exact build to App Store Connect.
4. Confirm both `build_ios` and `submit_ios` succeed. A successful build job alone is not delivery.
5. Wait for App Store Connect processing, then confirm the new build is available to the Internal Testers group.
6. Update through TestFlight on Jesse's phone and run the release acceptance checks.
7. Record the tag, commit, workflow id, build number, and result.

## 4. Required Expo environment

Never record secret values in Git or chat.

| Variable | Purpose | Required environments |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | LocalCheckProd URL | development, preview, production |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client publishable key | development, preview, production |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Runtime public map token | development, preview, production |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | Secret Mapbox native SDK download token with `Downloads:Read` | development, preview, production |

`@rnmapbox/maps` now reads `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` directly from the EAS
environment. Do not pass the old `RNMapboxMapsDownloadToken` plugin property;
the installed plugin marks it deprecated and warns that it writes the secret
into generated native properties.

## 5. Load-bearing configuration

- Expo GitHub base directory: `artifacts/mobile`.
- pnpm: `10.13.1`; OTA workflow also pins Node `20.19.4`.
- iOS image: `macos-sequoia-15.6-xcode-26.0`.
- EAS owns build numbers through `appVersionSource: remote` and production `autoIncrement`.
- Runtime policy: `appVersion`. This replaced the nondeterministic local-vs-EAS fingerprint policy that blocked build 9.
- EAS stores signing and App Store Connect credentials; do not add local credential files to Git.

## 6. Build failure signatures worth remembering

| Failure | Cause | Proven resolution |
| --- | --- | --- |
| MapboxCommon download returned HTTP 403 | Secret token lacked correct scope/wiring | Mapbox secret token with `Downloads:Read`, stored as Expo secret env variables. |
| Local and EAS fingerprints differed | Generated native/autolinking content produced nondeterministic hashes | Runtime policy changed to `appVersion`; commit `249c926`. **Do not revert this to `fingerprint` or any other policy** — it was a deliberate fix for this exact bug. |
| pnpm lock/config mismatch | EAS worker toolchain too old | Keep pnpm `10.13.1` pin. |
| `configs.toReversed is not a function` during OTA export | Worker Node version too old for Metro | Keep Node `20.19.4` pin in OTA workflow. |
| `Provisioning profile "...AppStore..." doesn't support the Push Notifications capability` / `doesn't include the aps-environment entitlement` (Xcode build error, `XCODE_BUILD_ERROR`) | A plugin requiring a new native capability (here: `expo-notifications`) was added to `app.json`, but the EAS-managed provisioning profile predates it and wasn't regenerated. `eas build`'s automatic capability sync (see [Expo iOS capabilities docs](https://docs.expo.dev/build-reference/ios-capabilities/)) did not self-heal across two separate build attempts in this project's case — don't assume it will. | 1) Enable the capability on the App ID in [Apple Developer Console](https://developer.apple.com/account/resources/identifiers/list) if it isn't already. 2) Run `cd artifacts/mobile && eas credentials` → iOS → `production` → **Build Credentials: Manage everything needed to build your project** → when asked "Would you like to reuse the original profile?" say **no**, then "Generate a new Apple Provisioning Profile?" say **yes**. Deleting/regenerating a provisioning profile this way is safe — it only clears EAS's cached copy, doesn't touch Apple's side, and has zero effect on any build already live in TestFlight/App Store ([Expo app-credentials docs](https://docs.expo.dev/app-signing/app-credentials/)). |
| App launches, then crashes ~0.3–0.5s later with `SIGABRT` in `StartupProcedure.throwException` → `ErrorRecovery.crash` → `ErrorRecovery.notify(newRemoteLoadStatus:)` | This is `expo-updates`' own recovery system giving up, not a native crash — it means a fatal JS error occurred on launch, usually because the OTA update just downloaded relies on native code the installed binary doesn't have. Confirmed here: `expo-notifications` was added to `app.json` in the same commit that got auto-published via `publish-ota-update.yml` (which fires on every push to `main`, unconditionally), landing that JS on an older native binary that predated the module. [Expo's error-recovery docs](https://docs.expo.dev/eas-update/error-recovery.md) and [runtime-versions docs](https://docs.expo.dev/eas-update/runtime-versions.md) both describe this exact failure mode. | Bump `expo.version` in `app.json` (runtime policy is `appVersion`, so this also bumps the effective runtime version) *before or in the same commit as* any change that adds/removes a native module, plugin, permission, or entitlement. This makes the next native build's runtime version distinct, so it stops matching OTA updates meant for the old runtime. Does **not** fix already-installed old binaries — they need to be replaced by the new build. |
| "Rerunning" an old EAS Workflow run produces an unexpectedly old build | EAS Workflow's re-run action replays that run's *original* triggering git ref (e.g. an old tag), it does **not** re-resolve to the branch's current HEAD. Manually re-running a run tied to `refs/tags/v1.0.4` will always rebuild the exact commit that tag points to, even months later. | To build current `main`, always cut a **new, unique tag** on the current commit and push it (step 3B above) — never re-run an old workflow run expecting it to pick up new work. Check `git ls-remote --tags <repo-url>` for the full existing tag list before choosing a name; this repo already has `v1.0.1`–`v1.0.5` in use. |

## 7. Definition of delivered

- Workflow terminal state is successful.
- For native releases, build and submit jobs both succeeded and the build is visible/installable in TestFlight.
- For OTA, the production update group exists and the installed compatible build shows the change after relaunch.
- The requested behavior passes on Jesse's phone.
- Current-state and activity documents are updated.

Reference: [Expo monorepo guidance](https://docs.expo.dev/guides/monorepos/),
[EAS builds in monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/).
