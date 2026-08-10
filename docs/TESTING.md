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
| Planned visit create/edit/remove | 2 signed-in users | schedule and court views converge |
| Run create/join/leave/capacity | 2–4 signed-in users | all clients show authoritative membership |
| Friend request/accept/remove | 2 signed-in users | both relationship views agree |
| Match submit/confirm/reject | 2 signed-in users | pending state then correct ELO/history result |
| Notification inbox/read state | 2 signed-in users | durable inbox and unread count agree |
| Realtime lifecycle | browser + iPhone | background/foreground catches up once; no duplicate updates |
| Privacy/RLS | allowed + denied user | permitted row works; unauthorized read/write is denied |
| Add Court | 2 users + 2 photos | accepted insert, rejected photo, quota and duplicate denial |
| Block/report | blocker + blocked user | filtered reads and denied social writes agree |
| QR profile → Log Game | cold + warm app | profile resolves by ID and opponent is prefilled |
| Push delivery | 2 iPhones | foreground, background, cold start, retry, invalid token cleanup |

## Native acceptance

A development/TestFlight build is required for Mapbox rendering/camera,
location permission, Apple Sign-In, SecureStore session restore, push token
registration/delivery, haptics, and update startup behavior. Capture the build
number and device/iOS version.

## Visual acceptance

For a visual change, include a browser screenshot and an iPhone screenshot of
the same meaningful state. Compare against the applicable reference under
`docs/product/`. Exercise empty, loading, error, populated, and long-content
states when they are affected.

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

## PR #28 evidence checkpoint — 2026-08-10

- `pnpm check:release` passed for app version `1.0.2`, including 38 focused
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
