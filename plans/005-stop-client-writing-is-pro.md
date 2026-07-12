# Plan 005 — Stop writing profiles.is_pro from the client

Written against commit: `d08156e`

## Finding

The client directly updates `profiles.is_pro`, but the live database derives that column from `subscriptions` via trigger. Direct client writes can drift from billing truth once real IAP/RevenueCat is integrated.

Evidence:
- `artifacts/mobile/context/AppContext.tsx` implements `setIsLocalPlus` by calling `updateProfileFields(userId, { is_pro: v })`.
- `docs/SOURCE_OF_TRUTH.md` and `docs/supabase/baseline_snapshot.sql` document that `profiles.is_pro` is derived and should not be written directly from the client.

Impact: P1/P2 monetization correctness. This will matter as soon as subscriptions become real.

Effort: Small for removing the incorrect write; Medium if adding a complete subscription integration. Risk: Medium because current UI may rely on a stub toggle. Confidence: High.

## Scope

In scope:
- `artifacts/mobile/context/AppContext.tsx`
- `artifacts/mobile/services/profileService.ts` type narrowing if needed to prevent accidental `is_pro` writes.
- Settings upgrade button behavior only enough to avoid pretending purchase succeeded.

Out of scope:
- Full RevenueCat/IAP implementation.
- Backend subscription schema changes unless a dedicated monetization plan is selected.

## Implementation steps

1. Remove the direct `updateProfileFields(userId, { is_pro: v })` call from `setIsLocalPlus`.
2. Preferred temporary UI behavior: make LocalPlus upgrade show a clear “coming soon / purchase not configured” alert and leave state unchanged.
3. Narrow the accepted fields for `updateProfileFields` so ordinary callers cannot pass `is_pro` accidentally, unless doing so would cause broad churn. At minimum, add a comment at the type definition warning not to write it.
4. Keep reading `profile.is_pro` from Supabase; the trigger remains the source of truth.
5. Add a future TODO near the upgrade action: real purchases should write `subscriptions` rows through a secure server/RPC flow, then refresh the profile.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. `rg -n "is_pro" artifacts/mobile -g '!mockup-sandbox/**'` — expected: reads/mapping are allowed; no client update payload writes `is_pro`.
3. Manual app check: open Settings/LocalPlus upgrade and confirm the app does not falsely mark the user as Pro without a real subscription.

## Done criteria

- No client-side Supabase update writes `profiles.is_pro`.
- The app still reads and displays server-derived LocalPlus status.
- Typecheck passes.

## Escape hatches

STOP and report back if stakeholders want a temporary manual admin Pro switch. That should be built as an admin-only server operation, not a client profile update.
