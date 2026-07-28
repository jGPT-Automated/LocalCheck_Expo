# Expo and TestFlight release runbook

Last verified end-to-end: 2026-07-26, `v1.0.4` → TestFlight `1.0.0 (9)`

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

## 6. Build-9 failure signatures worth remembering

| Failure | Cause | Proven resolution |
| --- | --- | --- |
| MapboxCommon download returned HTTP 403 | Secret token lacked correct scope/wiring | Mapbox secret token with `Downloads:Read`, stored as Expo secret env variables. |
| Local and EAS fingerprints differed | Generated native/autolinking content produced nondeterministic hashes | Runtime policy changed to `appVersion`; commit `249c926`. |
| pnpm lock/config mismatch | EAS worker toolchain too old | Keep pnpm `10.13.1` pin. |
| `configs.toReversed is not a function` during OTA export | Worker Node version too old for Metro | Keep Node `20.19.4` pin in OTA workflow. |

## 7. Definition of delivered

- Workflow terminal state is successful.
- For native releases, build and submit jobs both succeeded and the build is visible/installable in TestFlight.
- For OTA, the production update group exists and the installed compatible build shows the change after relaunch.
- The requested behavior passes on Jesse's phone.
- Current-state and activity documents are updated.

Reference: [Expo monorepo guidance](https://docs.expo.dev/guides/monorepos/),
[EAS builds in monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/).
