# Release and rollback

LocalCheck keeps the MVP release path intentionally small: required PR checks,
an easy phone preview, a one-click production OTA for compatible changes, and
one TestFlight workflow for native changes.

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

Use `Release iOS (build + TestFlight)` when a change touches a native package,
Expo plugin, permission, entitlement, `app.json`, `app.config.js`, `eas.json`,
runtime policy, or Expo/React Native version. Trigger it manually or with a
`v*` tag. EAS owns signing and App Store Connect submission; build numbers
increment remotely.

Before the first workflow after this repository reset, set the EAS GitHub base
directory to the repository root.

## Backend order

Deploy additive/backward-compatible database changes before enabling dependent
client behavior. Destructive or contract-breaking changes require an explicit
compatibility and recovery plan. Edge Functions and migrations are separate
production actions; merging their source does not deploy them.
