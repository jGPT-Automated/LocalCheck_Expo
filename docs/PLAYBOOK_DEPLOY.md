# Playbook: Deploy an app update to Jesse's phone (TestFlight)

> For any agent (Claude, Codex, Devin) shipping LocalCheck changes. Follow it
> top to bottom. Last verified working: 2026-07-15 (v1.0.3 pipeline repair).
> If reality diverges from this playbook, fix the playbook in the same session.

## Required from user

- **Explicit go-ahead before any deploy trigger** — pushing a `v*` tag, merging
  to `main` (triggers OTA), `eas build`, `eas submit`, or `eas update`. A merged
  PR is not implicit permission to tag a release.
- Nothing else. Credentials are already wired: EAS holds the Apple distribution
  cert + App Store Connect API key; `EXPO_TOKEN`/`GITHUB_TOKEN` are in the shell.

## Step 0 — Decide the path: OTA or full build

Ask: does the change touch anything native?

| Change | Path |
|---|---|
| JS / TS / styling / assets / app logic only | **OTA** (seconds once run) |
| New native module, permission, SDK bump, `app.json` or `eas.json` change, icon/splash | **Full build** (minutes + TestFlight processing) |

When unsure, run `npx expo-doctor` from `artifacts/mobile` and check whether the
fingerprint would change; if still unsure, do a full build — an unnecessary
build costs minutes, a wrongly-OTA'd native change crashes the app.

## Path A — OTA update (JS-only changes)

1. Merge the PR to `main`. That's it — the push triggers the
   `Publish OTA update` workflow (`artifacts/mobile/.eas/workflows/publish-ota-update.yml`),
   which publishes to the **production channel**.
2. Verify the workflow run (see "Verification gates" below).
3. Confirm delivery: installed TestFlight builds pick up the update on the
   next app launch (second launch after publish, per expo-updates default).

**OTA reach caveat:** an OTA only reaches builds whose `runtimeVersion` matches
and that shipped with `expo-updates` configured. TestFlight build 1.0.0 (3)
predates EAS Update and can NEVER receive OTA — builds (5)/(6)+ are the first
OTA-eligible ones. If the phone still runs build (3), ship a full build first.

## Path B — Full build + TestFlight (native changes)

1. Merge the PR to `main`.
2. Get Jesse's explicit go-ahead to release.
3. Create and push a version tag on the merge commit. Local git may push as an
   unauthorized user ("GenJess") — if `git push` returns 403, create the tag
   via the GitHub API instead (this works and triggers the workflow):
   ```bash
   gh api repos/jGPT-Automated/LocalCheck_Expo/git/refs \
     -f ref=refs/tags/v1.0.X -f sha=<merge-commit-sha>
   ```
4. The tag push triggers `Release iOS (build + TestFlight)`
   (`artifacts/mobile/.eas/workflows/release-ios.yml`): `build_ios` (EAS build,
   production profile, ~5 min once running) → `submit_ios` (upload to App
   Store Connect).
5. Verify both jobs (below), then confirm the build appears in
   App Store Connect → TestFlight → iOS Builds (processing can add ~5–15 min).
   Internal Testers group gets it automatically; Jesse updates from the
   TestFlight app on the phone.

## Verification gates — a deploy is NOT done until all pass

Run these; do not report success on partial evidence.

1. **Workflow run green.** Poll via Expo MCP (`workflow_list` /
   `workflow_info` with appId `9c906173-0258-45a9-a3fe-786cda373c66`) or the
   dashboard: https://expo.dev/accounts/agenticjess-os/projects/LocalCheck/workflows
2. **For builds: BOTH jobs green.** A green `build_ios` only proves an .ipa
   exists; `submit_ios` must also succeed (v1.0.2 failed exactly there).
3. **For OTA: update group exists** on the production channel
   (dashboard → Over-the-air updates, or `eas update:list --channel production`
   from `artifacts/mobile`).
4. **On-device check** for builds: the new build number is visible in
   TestFlight on the phone.

## Advice and pointers

- **"Searching for a worker" / long queue times are normal** on the current
  free EAS plan. Jobs can queue 30–90+ min before running (a "1h21m failed
  workflow" was 1h20m queue + 13s run). Don't rediagnose config because of
  queue time; check whether log files exist yet (`workflow_info` →
  `logFileUrls` empty = still queued). Paid plans get priority queues.
- **The toolchain pins are load-bearing.** The OTA workflow pins
  `defaults.tools: { pnpm: '10.13.1', node: '20.19.4' }` and root
  `package.json` declares `packageManager: pnpm@10.13.1`. The repo needs
  pnpm ≥10 (lockfileVersion 9.0 + `overrides` in `pnpm-workspace.yaml`, a
  pnpm-10 feature) — without the pin, EAS workers default to an older pnpm
  and fail install with `ERR_PNPM_NO_LOCKFILE` /
  `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. The update workers also default to
  Node 18, but Metro 0.83 needs ≥20.19.4 — the signature is
  `TypeError: configs.toReversed is not a function` during export. Keep pins
  and `packageManager` in sync when bumping.
- **Monorepo:** the Expo GitHub integration's Base directory is
  `artifacts/mobile`. Workflow logs should show
  "Changing default working directory to …/artifacts/mobile" early — if not,
  check Expo dashboard → Project settings → GitHub.
- **Xcode image is pinned** to `macos-sequoia-15.6-xcode-26.0` in
  `artifacts/mobile/eas.json` (unpinned image broke v1.0.1). Only move it
  deliberately, with a successful build as proof.
- `appVersionSource: remote` — EAS owns the build number and auto-increments;
  never hand-edit build numbers.
- Version bumps: the marketing version (`app.json` → `version`) does NOT
  auto-bump from the tag name. Bump it in the PR when it should change.
- Workflow YAML edits: validate against the live schema before merging —
  fetch https://api.expo.dev/v2/workflows/schema (the `expo:eas-workflows`
  skill has a validator script).

## Forbidden actions

- Do NOT deploy anything without Jesse's explicit go-ahead (see top).
- Do NOT disable or work around `--frozen-lockfile` (no
  `--no-frozen-lockfile`) — fix the toolchain mismatch instead.
- Do NOT ship from or reference `artifacts/mobile/mockup-sandbox/`.
- Do NOT remove `minimumReleaseAge` from `pnpm-workspace.yaml`.
- Do NOT run `eas submit` against an old build id to "save time" — always
  submit the build produced from the tagged commit.
- Do NOT claim success from "no error thrown" — walk the verification gates.

## Postconditions (what "done" looks like)

- Workflow run(s) SUCCESS in the Expo dashboard.
- For builds: new build number visible in App Store Connect TestFlight with
  status "Ready to Submit"/available to Internal Testers, and installable on
  Jesse's phone.
- For OTA: new update group on the production channel with the merge SHA as
  its message.
- `ACTIVITY_LOG.md` + `dev_agent.md` activity log updated with what shipped,
  and `docs/SOURCE_OF_TRUTH.md` updated if the deploy changes project status.
