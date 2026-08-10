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

## Phone preview

The PR preview EAS workflow publishes the branch to the `preview` channel. Use
a compatible LocalCheck preview/development build to inspect it on the phone.
Use `pnpm preview:web` for desktop annotation and simultaneous signed-in users.

## Production OTA

For JavaScript, styling, or asset changes compatible with the installed native
runtime, run `Publish production OTA` from the EAS dashboard after merge. It is
manual by design: one click prevents an accidental merge from immediately
reaching every installed client without adding a release bureaucracy.

If an OTA is bad, use EAS Update to republish the last known-good update to the
production channel. Record the incident and fix in the pull request or issue.

## TestFlight/native release

Every approved merge to `main` triggers `Release iOS (build + TestFlight)`.
That workflow builds the production iOS profile and submits the resulting
binary to App Store Connect. It can also be retriggered manually or with a
`v*` tag. EAS owns signing and App Store Connect submission; build numbers
increment remotely.

This is intentionally the fast MVP path: GitHub review and required checks are
the release gate. A merge does not publish an App Store version to external or
production users by itself; TestFlight processing and tester/review controls
remain in App Store Connect.

Before the first workflow after this repository reset, set the EAS GitHub base
directory to the repository root.

## Backend order

Deploy additive/backward-compatible database changes before enabling dependent
client behavior. Destructive or contract-breaking changes require an explicit
compatibility and recovery plan. Edge Functions and migrations are separate
production actions; merging their source does not deploy them.
