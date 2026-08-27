# Release and rollback

LocalCheck keeps the MVP release path intentionally small: required PR checks,
an easy phone preview, a manual production OTA for compatible changes, and one
automatic TestFlight workflow after an approved merge to `main`.

## Before merge

1. CI passes and review conversations are resolved.
2. The PR identifies whether the change is JavaScript-only, native, or backend.
3. The relevant browser, multi-user, and device evidence is attached.
4. Any backend change is backward-compatible with the installed client before
   client activation.
5. PR #28 specifically requires explicit release approval after connected
   preview, physical-device, and review-thread evidence is complete. Pushing
   the branch is not approval to deploy or merge it.

## Phone preview

The PR preview EAS workflow publishes the branch to the `preview` channel. Use
a compatible LocalCheck preview/development build to inspect it on the phone.
Use `pnpm preview:web` for desktop annotation and simultaneous signed-in users.

PR #28 also carries GitHub's `eas-build-ios:production` label, the current Expo
syntax `eas-build-[platform]:[profile]`. That label asks the Expo GitHub
integration for a pull-request production build; it is review evidence, not a
TestFlight submission trigger. The TestFlight trigger is the approved merge to
`main` described below. Do not create a `v*` Git tag before release approval,
because that tag is an alternate production build-and-submit trigger.

## Production OTA

For JavaScript, styling, or asset changes compatible with the installed native
runtime, run `Publish production OTA` from the EAS dashboard after merge. It is
manual by design: one click prevents an accidental merge from immediately
reaching every installed client without adding a release bureaucracy.

If an OTA is bad, use EAS Update to republish the last known-good update to the
production channel. Record the incident and fix in the pull request or issue.

### Latest verified production OTA

- Message: `Enable first-time push notification registration`
- Runtime/platform: `1.0.2` / iOS
- Update: `019ff2db-faca-700f-82be-9e0b1b0c249e`
- Group: `e7ed1d7d-0d91-458c-adf1-941d807ce84d`
- Source: `bc1507f6cff43b0d6af67e6dd34016b3079ff7bb`
- Published: 2026-08-11
- Acceptance: TestFlight build 14 registered a physical iPhone and received a
  real background friend-request notification.

This OTA was safe because build 14 already contained the production APNs
entitlement, the `expo-notifications` native module, and runtime `1.0.2`. Only
the JavaScript registration gate changed.

## TestFlight/native release

Every approved merge to `main` triggers `Release iOS (build + TestFlight)`.
That workflow builds the production iOS profile and submits the resulting
binary to App Store Connect. It can also be retriggered manually or with a
`v*` tag. EAS owns signing and App Store Connect submission; build numbers
increment remotely.

This is intentionally the fast MVP path. `main` is not currently protected, so
the operational release gate is explicit approval recorded after GitHub review
and a clean check run; do not bypass the PR by pushing directly. A merge does
not publish an App Store version to external or production users by itself;
TestFlight processing and tester/review controls remain in App Store Connect.

Expo's connected GitHub base directory is `/`, visibly saved on 2026-08-10. EAS
therefore resolves the cleaned root-level app instead of the retired
`/artifacts/mobile` directory.

For this release, merge PR #28 only. It already contains PR #27. The merge is
the authorization that starts the workflow; no version tag or second pull
request is required. PR #28 is app version `1.0.2` because Add Court introduces
the native `expo-image-picker` config plugin; EAS assigns the build number.

After merge:

1. Watch GitHub `quality` and the EAS `Release iOS (build + TestFlight)` run.
2. Wait for App Store Connect processing and record the generated build number.
3. Install that exact build from the internal TestFlight group and run the
   native/high-risk matrix in `docs/TESTING.md`.
4. Add the proven build to the external tester group, completing Beta App
   Review if App Store Connect requires it.
5. Submit the App Store version only after metadata, privacy answers,
   screenshots, support URLs, account deletion, and review notes are complete.

## Backend order

Deploy additive/backward-compatible database changes before enabling dependent
client behavior. Destructive or contract-breaking changes require an explicit
compatibility and recovery plan. Edge Functions and migrations are separate
production actions; merging their source does not deploy them.

The current Profile/Compete branch adds `expo-camera` for in-app player QR
scanning, so it requires a new native iOS build and camera-permission review; it
is not OTA-only. It also adds the `p_played_on` Log Game RPC contract. Apply
`20260826120000_add_game_date_to_log_match.sql` before installing that client,
then verify one QR-selected opponent and one dated two-account score review.

For the PR #28 snapshot, the approved order is:

1. Reconcile every pending migration and function against the read-only live
   schema/deployment state, pass focused source/unit checks, and complete the
   two-account/device behavior matrix.
2. Obtain explicit release approval.
3. Apply the additive migrations, configure the Vault webhook secret, and
   deploy `verify-court` and `send-notification`.
4. Verify Add Court, review timers, push claims, tickets/receipts, and invalid
   token cleanup without changing existing Realtime topics.
5. Reconfirm the saved Expo root base directory and merge PR #28.
6. Follow the exact EAS build through App Store Connect processing and an
   internal TestFlight install before closing PRs #25–27.

Release 2, scheduled run results, remains a separate focused pull request after
the Release 1 TestFlight build is accepted.
