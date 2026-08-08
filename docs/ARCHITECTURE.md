# Architecture

LocalCheck is one Expo Router application backed directly by one Supabase
project. There is no application API tier.

```text
Expo Router screen
  -> context owns session or shared UI state
  -> domain service validates and maps the request
  -> Supabase query or approved RPC
  -> Postgres transaction, RLS, triggers, and scoped Broadcast
  -> Realtime hub receives an invalidation
  -> active consumer refetches authoritative rows
  -> UI renders confirmed server state
```

## Runtime boundaries

- `app/` defines routes and route-level composition.
- `components/` renders UI. Visual components do not query Supabase directly.
- `context/` owns session-aware shared state and subscription lifecycles.
- `services/` is the only product-data access layer.
- `lib/supabase.ts` owns the Supabase client and session adapter.
- `lib/realtimeHub.ts` owns private, scoped Broadcast subscriptions.
- `supabase/` owns the database and Edge Function source of truth.

Provider order in `app/_layout.tsx` is intentional: authentication gates every
authenticated provider, then Realtime, notifications, court presence, shared
app state, and the court sheet are composed. Signed-out clients must not start
product queries or Realtime channels.

## Data rules

- Product state is server state. Never store courts, check-ins, activity,
  schedules, relationships, rankings, or flags in device/browser storage.
- Native uses SecureStore and web uses the Supabase browser adapter only for
  authentication-session persistence.
- Atomic behavior belongs in database RPCs. Service code maps inputs, calls the
  approved query/RPC, checks errors, and returns typed results.
- RLS applies to every client-accessible relation. Authorization is not a UI
  concern.
- Realtime messages are invalidations, not final data. Topics are bounded to
  `user:<id>`, `court:<id>`, `market:<name>`, or `run:<id>`.
- Backgrounding or losing a socket never means checkout. The server expiration
  policy is independent of connection state.

## Native boundary

The app contains native Mapbox, notification, Apple Sign-In, location,
SecureStore, and Expo Updates configuration. A dependency, config plugin,
permission, entitlement, runtime policy, Expo SDK, or native config change
requires a new binary. JavaScript, styling, and assets compatible with the
installed runtime can be delivered by EAS Update.

## Backend source of truth

`supabase/migrations/` mirrors the production migration ledger and is
append-only. `supabase/functions/` contains deployable functions. The workflow
and recovery rules are in `docs/SUPABASE.md`.

## Feature detail

Durable product and visual decisions live under `docs/product/`. Candidate work
under `docs/plans/` is not current behavior until it is implemented, tested,
and reflected here or in `docs/CURRENT_STATE.md`.
