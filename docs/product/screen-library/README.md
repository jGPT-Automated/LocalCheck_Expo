# LocalCheck Screen Library

This library preserves the actual product UI by release so future agents can trace user flows, compare regressions, and create accurate App Store materials without inventing screens.

## Structure

`releases/<platform-version-build>/`

Each release folder contains:

- `SCREEN_MAP.md` — routes, entry points, actions, states, defects, and screenshot index.
- `screenshots/` — numbered source captures in user-flow order.
- `MANIFEST.sha256` — integrity hashes for persisted captures when present.
- release metadata: source commit/tag, distribution channel, capture date, account/state notes, and known privacy or marketing-use restrictions.

## Capture rules

- Preserve a release folder after it is recorded; never overwrite it with a later build.
- Use consistent names: `<flow-order>-<area>-<screen>-<state>.png`.
- Capture important variants: loading, empty, populated, active, error, modal/sheet, permission, and signed-out states.
- Record broken actions where they occur, not only in a separate bug list.
- Keep real test data for internal product evidence. Before App Store use, replace personal/test identifiers and verify that every claim and activity state is honest.
- Screenshots are source material, not automatically approved marketing assets.

## Releases

- [`ios-1.0.0-build-9`](releases/ios-1.0.0-build-9/SCREEN_MAP.md) — delivered through TestFlight on 2026-07-26. No longer current.
- **`ios-1.0.1-build-13`** — historical TestFlight release from 2026-08-01
  (PR #22). No screen-library capture is recorded for it; it is not the
  latest recorded build.
- Latest recorded TestFlight checkpoint: **1.0.3 (33)**, built Sep 14,
  checked Oct 14 (`docs/CURRENT_STATE.md`). This library has no captures
  for that checkpoint. Verify the actual installed build before a new
  capture session; the checkpoint is not a claim about today's installed build.

## Paired action captures

Jesse requested captures from both participants' sessions (Oct 22) for flow
verification, explainers and possible later promo/web use.

- Use distinct tester accounts and the test courts in
  `../../runbooks/ACCOUNT_TAGS.md`; record each account's role in the flow.
- For each action, capture before, the action/confirmation, and both
  participants' resulting state. Record route, source commit/deployment or
  native build, timestamp, viewport/device and whether a refresh was needed.
- Pair names with the same flow identifier and `sender` / `recipient` (or
  `player-a` / `player-b`). Keep the originals and their notes together in
  `SCREEN_MAP.md`. Record a pass only after the expected transition is seen.
- Candidate flows: check-in/roster; planned visit/schedule; game invite/RSVP;
  friend request/accept; score submission/review/final result. Choose the
  specific actions with Jesse before the coordinated session.
- Browser emulation is labeled web evidence. Camera, push, permissions and
  purchases need actual native-device captures for native claims.
- Select promo assets from reviewed captures of the final UI; QA screenshots
  do not automatically become approved promotional material.

Capture status: pending. The Oct 22 Browser Use exploration returned a written
report, but no image files accessible to the lead agent. Its reported
screenshots have not been accepted into this library or visually signed off.
