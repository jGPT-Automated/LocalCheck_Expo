# Multi-court and hourly lobbies: contract for review

**Draft, 2026-11-03.** Proposal only; no migration, deployment, write probe,
or product approval follows from this document. Base: `main` 19dac69 (PR #89).
This is a review artifact, not a statement of shipped behavior. Jesse's stated
direction is free: one court; LocalPlus: up to five ordered saved courts, first
is default; nested Settings controls; a view selector on Home and Schedule;
Explore saves without replacing the default. Lobby rules remain open.

## Evidence and current boundary
- Lead's authorized read-only live metadata inspection on Nov 3 found no
  public/private saved-court membership relation. `profiles.local_court_id`
  remains the single local; `is_pro` is subscription-derived. Metadata examined
  included catalog relations/columns, constraints, triggers, policies and
  function definitions; no player rows or RPC writes were queried. The exact
  queries and independently reproducible output are not included in this handoff.
- Live `auto_check_in_arrive` requires that single local; changing it stamps
  `local_court_changed_at`, clears pending auto arrivals and closes the old
  auto check-in. Local [AppContext](../../context/AppContext.tsx) writes the
  profile and preferred sport directly with optimistic rollback; local and
  ranking queries use the same profile field. Legacy clients must continue.
- Local [AutoCheckInContext](../../context/AutoCheckInContext.tsx) and
  [service](../../services/autoCheckInService.ts) register one region and
  follow the profile local. Multi-region operation is not implemented or
  verified on a device. D35/D37/D52 and D66 remain current authority in
  [decisions](../product/DECISIONS.md) until explicitly revised.
- Live `create_scheduled_game` accepts a future start and even capacity 4–10;
  it does not enforce a two-hour or seven-day window. `join_scheduled_game`
  locks the run, validates scheduled/future, invite and capacity, and handles
  team selection or ELO balancing. `runs` has scheduled/cancelled/completed
  statuses and no additional scheduling-window constraint. This is scheduled
  RSVP, not evidence of a rolling lobby, queue, or game-end lifecycle.
  [Client calls](../../services/scheduledGameService.ts) and
  [hour model](../../lib/courtActivityModel.ts) show the separate paths.

## Proposed server-owned saved courts

- Add one owner-scoped ordered membership relation: `(user_id, court_id)`
  unique, order, and per-court auto-check-in preference (initially off unless
  legacy opt-in migration semantics are explicitly approved). Validate court
  eligibility, owner and position server-side; no public write access. Return
  only the owner's list, including effective auto-check-in state and a revision.
- Backfill each non-null existing profile local as position one. Preserve
  `profiles.local_court_id` as compatibility/default source used by installed
  clients, ranking and locals; list's first entry and profile must agree in
  the same transaction. Empty local means empty list. Preserve the existing
  sport-adoption behavior on actual default change; never alter either for a
  temporary view selection. Order uniqueness must tolerate transactional reorder.
- Narrow authenticated RPCs for add, remove, reorder/set default and per-court
  toggle should derive owner from auth, enforce entitlement from server data,
  lock the profile/owner consistently, atomically validate the complete list,
  update both representations, and return authoritative list/revision. A
  stale revision is rejected for refetch, rather than overwriting another
  device's reorder. Concurrent adds cannot exceed five (one for free) and
  duplicate retries must be harmless. All reads and writes enforce RLS and
  existing hidden-account/test-court visibility rules; privileged functions use
  fixed search paths and least privilege. No client-supplied entitlement.
- **Legacy write bridge requires review:** installed clients can directly set
  `local_court_id`. A server-side transaction/trigger must reconcile that write
  under the same lock and cap: preserve an existing member's ordering with it
  first; for a new court add it when capacity allows. At capacity, recommend
  rejecting the legacy change with a recoverable error rather than silently
  deleting a saved court. Null removes the default only if a coherent empty or
  replacement policy is approved. Verify recursion, lock order, trigger ordering,
  errors and existing profile update privileges before choosing implementation.
  No promise of seamless old-client behavior until tested against old binaries.
- Downgrade recommendation for decision: retain excess saved rows and order,
  expose only the first as effective while free, disable excess auto-check-ins,
  block adds/reordering into excess, and restore on upgrade. Do not delete data.
  Decide whether the user can replace the effective default while downgraded,
  and how subscription transitions serialize with mutations and geofences.

## Frontend and native contract

- Settings' existing nested local-court drawer owns saved order, drag reorder,
  removal/default and each auto toggle; Explore's plus adds a saved membership.
  Home/Schedule use an anchored selector over the authorized list; selection is
  ephemeral view state initialized from default, never a profile write or
  device-persisted product state. Refetch authoritative state after mutations,
  handle stale revisions/errors, and preserve free one-court behavior.
- A per-court toggle needs both server preference/entitlement and native Always
  permission; surface pending, denied and registration failure honestly. Update
  `auto_check_in_arrive` authorization and native region synchronization together
  before advertising additional courts. Review simultaneous/overlapping regions,
  region limits, cold/background launch, sign-out, removal, disable, default
  changes, downgrade and stale events. Preserve active/pending cleanup semantics
  deliberately; default changes should not accidentally end an enabled
  non-default court's legitimate session. Do not broaden identity visibility,
  sharing or friend notifications; existing privacy preferences still apply.
- Open decisions: migration of a legacy device's existing opt-in (currently
  native registration), cross-device preference meaning, permissions recovery,
  behavior when an enabled court is removed, and overlapping arrivals. Native
  iOS/Android capability and actual region limits require device verification.

## Separate hourly intent from a rolling lobby

`planned_visits` is an hourly intention with self-write RLS and privacy-filtered
reads; it is neither presence nor game RSVP. Preserve anonymous aggregates and
deduplicate visible people as today. A real rolling lobby needs a separately
reviewed server-owned contract: eligibility and admission, queue ordering and
capacity, atomic join/leave and concurrency, lobby/game start, replacement,
expiry, cancellation, game end and result/score linkage, visibility, moderation,
and retries/realtime invalidation. Decide its relation to scheduled runs and
whether/how hosts can manage it. No queue is authorized by D66; do not infer
one from slot avatars, planned visits, or the scheduled-game RPCs.

## Review and acceptance gates

1. Approve unresolved downgrade, removal, opt-in, compatibility, and lobby
   choices; validate catalog evidence and threat model before executable SQL.
2. In an isolated environment, test backfill and old-client profile writes,
   two-device add/reorder/downgrade races, cap, ownership/RLS denied users,
   hidden data, rollback and server-confirmed errors. Include migration and
   rollback plans without destroying legacy contracts or existing data.
3. Test view selection, nested drawer, free/Plus transitions and failures at
   phone sizes; verify default, sport, locals and rankings stay coherent.
4. On real devices and separate accounts, exercise permission, multi-region,
   background, privacy, stale events and downgrade; test lobby lifecycle only
   after its separate contract is approved. Production SQL, RPC probes and
   deployment require their own explicit authorization.
