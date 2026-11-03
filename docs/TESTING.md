# Testing

Testing combines a fast automated gate with the real multi-user workflow that
has already been used successfully: two to four signed-in accounts across the
browser, a LocalCheck development build, and TestFlight.

## Automated gate

Every pull request runs the fast CI gate:

```bash
pnpm check
pnpm export:web -- --output-dir /tmp/localcheck-ci-export
```

CI uses deliberate non-service placeholders and its bundle is never an
interactive preview. Before handoff, run `pnpm check:release` locally. It covers
TypeScript; focused backend, Add Court, splash/logo, notification-routing,
Realtime, home-presentation, player-identity, and schedule-model tests; the
design-system consistency guard; and a fresh export verified against the
ignored development Supabase configuration. CI's bundle assertion is a
portable Node script and does not assume `rg` exists on the runner. Add a
focused regression test with every bug fix when behavior can be exercised
without a device. CI is a merge gate, not proof of native or multi-user
behavior.

## High-risk manual matrix

Use distinct real test accounts. Record clients, account labels, and outcomes
in the pull request; never record passwords or tokens.

| Journey | Minimum clients | Evidence |
| --- | ---: | --- |
| Sign in/out and session restore | browser + iPhone | both return to correct auth state |
| Check in, switch court, check out | 2 signed-in users | roster and state converge without refresh |
| Change active check-in privacy | public → friends → private | active row/feed visibility persists before the selector changes and survives relaunch |
| Planned visit create/edit/remove | 2 signed-in users | schedule and court views converge |
| Run create/join/leave/capacity | 2–4 signed-in users | all clients show authoritative membership |
| Full run detail | compact phone + host controls | roster, invitations, and management actions scroll above the fixed RSVP footer |
| Friend request/accept/remove | 2 signed-in users | both relationship views agree |
| Match review lifecycle | 2 signed-in users; 4 for team | submit → approve and submit → dispute → revise → approve; correct countdowns, notifications, ELO/history only after final approval |
| Match dispute limits | 2 signed-in users | first/second dispute create 7-day holds; third dispute and expired hold void with no ELO/profile/history mutation |
| Notification inbox/read state | 2 signed-in users | durable inbox and unread count agree |
| Realtime lifecycle | browser + iPhone | background/foreground catches up once; no duplicate updates |
| Privacy/RLS | allowed + denied user | permitted row works; unauthorized read/write is denied |
| Add Court | 2 users + 2 photos | accepted insert, rejected photo, quota and duplicate denial |
| Block/report/unblock | blocker + blocked user | filtered reads and denied social writes agree; Settings lists and unblocks only the caller's blocked players |
| Feed hype | 2 signed-in users | first tap persists once, count converges across clients, repeated taps do not inflate it, refresh retains liked state |
| Add Court location | user with a saved home court while at another venue | form starts without the home pin and only device location enables submission |
| Other-player profile stats | player with long visits | CHECK-INS is an actual visible row count, never total court minutes |
| QR profile → Log Game | cold + warm app | profile resolves by ID and opponent is prefilled |
| Push delivery | 2 iPhones | foreground, background, cold start, retry, invalid token cleanup |

## Native acceptance

A development/TestFlight build is required for Mapbox rendering/camera,
location permission, Apple Sign-In, SecureStore session restore, push token
registration/delivery, haptics, and update startup behavior. Capture the build
number and device/iOS version.

## Visual acceptance

Every visible change follows `.claude/skills/ui-done/SKILL.md` and passes
`pnpm qa:visual` (`scripts/visual-qa/`): every screen and state in
`screens.mjs` at 375x667, 393x852 and 430x932, signed in against an in-memory
Supabase stand-in with the clock pinned. It fails on cut-off, clipped,
overlapping or off-screen text and sideways scroll, and on any screen whose
sub-11pt text, sub-4.5:1 text or sub-44pt control count rises above
`baseline.json` (lower the baseline when a change improves it). Not in CI yet:
the Explore drawer peek is flaky at 375x667. It does not see
off-centre art, uneven spacing or colour; open the PNGs.

For every frontend PR, follow the before/after evidence fields in the
[PR template](../.github/pull_request_template.md) and add retained screenshots
to the chronological [visual history](product/design-qa/README.md). Compare
the same route and state at the baseline and PR-head commits and the same
viewport. Use 375x667, 393x852 and 430x932 where the change could vary by size;
explain omitted sizes. Capture the actual rendered app, not a design mockup.
Record the browser or device, reproducible journey and outcome, backend
isolation (including whether writes are intercepted or fixture-only), and
remaining limits. If a browser and iPhone are both relevant, identify each
capture separately. Exercise affected empty, loading, error, populated and
long-content states. These captures complement `qa:visual`; they do not
replace its checks or native-device evidence.

For authentication, also test a compact phone, landscape, the software
keyboard, and a visible error message; every field and action must remain
reachable. For Schedule, test a compact phone with a selected slot and upcoming
runs; the one-hour heatmap remains usable and content below it remains
reachable.

Inspect the signed-out artwork reveal, the signed-in pin → W → check launch,
and Reduce Motion. At compact and desktop browser widths, open court, run,
player, match, notification, and settings detail headers and confirm the shared
back-logo frame does not overflow.

## Backend acceptance

Run the focused backend source and behavior checks:

```bash
pnpm test:backend
```

Before release approval, inspect the live cloud migration ledger, relevant
tables, functions, policies, extensions, and deployed Edge Functions read-only;
record the comparison in the pull request. Do not apply a migration or deploy a
function during inspection. After the approved backward-compatible deployment,
prove both the intended user and a user who must be denied with dedicated test
accounts before the client release is activated.

For score-review migrations, also verify an unrelated signed-in user cannot
read or mutate the match; a proposer cannot approve their own submission; a
same-side teammate cannot approve it; any participant can revise a held game;
and every relevant participant receives exactly one actionable notification
that routes back to the same `matches.id`.

## PR #28 evidence checkpoint — 2026-08-10

- `pnpm check:release` passed for app version `1.0.2`, including 43 focused
  tests, design consistency, TypeScript, and a connected web export.
- Expo CLI validated all four `.eas/workflows/*.yml` files against the current
  workflow contract; `expo install --check` reported dependencies up to date.
- The in-app browser verified the fresh connected signed-out splash/auth flow
  at 390×844 and 1280×900. Both widths had matching viewport and document
  widths, and every auth control remained reachable.
- Expo's GitHub setting visibly confirmed the base directory saved as `/`.
- Signed-in detail surfaces, Add Court permissions/photo outcomes, Realtime,
  push delivery, and the two-account/device matrix remain release-approval
  evidence; they are not represented as completed by the browser export.

## Production push checkpoint — 2026-08-11

- TestFlight app `1.0.2` build `14` had `aps-environment=production`, the
  `expo-notifications` native module, and runtime `1.0.2` before the client fix.
- Production OTA `019ff2db-faca-700f-82be-9e0b1b0c249e` corrected first-time
  registration without a new native build.
- The database webhook authenticated to `send-notification` and returned HTTP
  200 in a no-work probe.
- A real friend request generated a visible background iPhone notification.
- Still open: foreground presentation, cold-start destination routing, Expo
  receipt/retry observation, and invalid-token cleanup evidence.

## Linked court activity (D66)

`node scripts/visual-qa/court-activity-journey.mjs http://127.0.0.1:8090 /tmp/activity-proof`
opens the preview started by `pnpm preview:web`. It intercepts all backend HTTP
and blocks every WebSocket before navigation; writes mutate fixture memory
only. It checks chart scrub/list scroll synchronization, anchored chart, day
arrows, Going failure/retry/save/reload/removal, heatmap-to-Feed, load retry,
Home/drawer separation and captures all three phone sizes. It downloads only
the existing QR worker's public static jsQR dependency before browser work.
Use `CHROMIUM_PATH` for a system browser; default is `/usr/bin/chromium`.
This proves browser behavior against fixtures, not production RLS, realtime
delivery or iOS gesture arbitration. No live Supabase access is authorized.

Use `QA_PLANNER_ONLY=1` to recheck only Home/drawer after a planner-only change.

## PR #89 logic-review regressions

Run `node scripts/visual-qa/pr89-review-journey.mjs http://127.0.0.1:8094 /tmp/pr89-review`.
Start the local preview with `TMPDIR=/tmp PORT=8094 pnpm preview:web` first.
The journey intercepts every backend HTTP request and blocks WebSockets before
navigation. No live account is used. It fixes the clock at 6:30 PM Central and
checks that the 5 PM heatmap block opens 5 PM, a completed 3 PM block stays
disabled, and a future 7 PM block stays 7 PM. It scrubs the top historical
10 PM row, rapidly alternates hours on past/today/future days, checks vertical
synchronization and an anchored chart, taps missing actors in both court event
groups and a valid actor, and verifies Me/player date headings are retained.
Runs at 375x667, 393x852 and 430x932; `REVIEW_SIZES=393x852` scopes a reproduction.
It records screenshots/results, rejects page errors and product writes, and
fulfills the QR worker's public static dependency locally.
