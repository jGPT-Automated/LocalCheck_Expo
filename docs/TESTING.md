# Testing

Testing combines a fast automated gate with the real multi-user workflow that
has already been used successfully: two to four signed-in accounts across the
browser, a LocalCheck development build, and TestFlight.

## Automated gate

Every pull request runs:

```bash
pnpm check:release
```

`pnpm check:release` covers TypeScript; focused Realtime, home-presentation,
player-identity, and schedule-model tests; the design-system consistency guard;
and a clean production-style web export. Add a focused regression test with
every bug fix when the behavior can be exercised without a device. CI is a
merge gate, not proof of native or multi-user behavior.

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

## Backend acceptance

Run database tests locally after migrations:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

Prove both the intended user and a user who must be denied. Production is never
the first place a migration or authorization rule is exercised.
