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
- **`ios-1.0.1-build-13`** — delivered through TestFlight on 2026-08-01 (PR #22 MVP consolidation + provisioning-profile/version-bump fixes; see `docs/CURRENT_STATE.md`). This is the current shipped build, but **no screen-library capture exists for it yet** — the next UI-focused session should record one before making further visual changes, since build-9's captures are now a release behind.
