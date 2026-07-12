# Plan 003 — Use switch_active_checkin for atomic court presence

Written against commit: `d08156e`

## Finding

The client inserts check-ins directly and checks out separately, so it cannot guarantee one active check-in per user. The live database already provides `switch_active_checkin`, which atomically checks out any open check-in before creating a new one.

Evidence:
- `artifacts/mobile/services/checkInService.ts` currently inserts directly into `check_ins` in `checkInToCourt()`.
- `docs/SOURCE_OF_TRUTH.md` documents the existing `public.switch_active_checkin(court_id, visibility, note)` RPC.

Impact: P0 correctness. Presence counts can become wrong if users switch courts.

Effort: Small. Risk: Low/Medium because it touches a core presence write. Confidence: High.

## Scope

In scope:
- `artifacts/mobile/services/checkInService.ts`
- Caller adjustments in `artifacts/mobile/context/AppContext.tsx` only if required.

Out of scope:
- Designing the check-in note UI. That should be a follow-up once the RPC path is live.
- Changing fetch/count check-in read paths.

## Implementation steps

1. Replace the direct insert in `checkInToCourt()` with `supabase.rpc("switch_active_checkin", { p_court_id: courtId, p_visibility: visibility, p_note: note ?? null })`.
2. Keep the function signature stable: `userId` may become unused because the RPC uses `auth.uid()`; do not remove it unless every caller is updated safely.
3. Log RPC errors with `console.warn("checkInToCourt failed", error.message)`.
4. Keep `checkOutOfCourt()` as-is because explicit checkout still needs an update path.
5. Ensure optimistic UI state still updates through AppContext as before.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. Manual app check: check into Court A, then Court B, refresh both screens, and confirm the user appears only at Court B.
3. Optional live SQL inspection: the user's rows with `checked_out_at IS NULL` should contain exactly one row.

## Done criteria

- `checkInToCourt()` calls `switch_active_checkin`.
- No direct insert into `check_ins` remains for normal user check-in.
- Explicit checkout still works.
- Typecheck passes.

## Escape hatches

STOP and report back if the RPC is absent or if RLS/auth context makes `auth.uid()` null during mobile calls.
