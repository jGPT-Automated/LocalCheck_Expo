# Plan 001 — Wire game logging to Supabase RPC and fix player match history

Written against commit: `d08156e`

## Finding

The client logs games with raw inserts that send uppercase team enum values, but the live database expects lowercase `a`/`b`. The same service fetches player games with a joined-table filter that PostgREST does not support reliably as written. These failures are swallowed, so users can submit a game and see no durable ELO/match-history update.

Evidence:
- `artifacts/mobile/services/gameService.ts` currently computes `winner` as `"A" | "B"`, inserts into `games`, then inserts `game_participants` with `team_side: "A"/"B"`.
- `docs/SOURCE_OF_TRUTH.md` documents the verified live enum mismatch and the existing `public.log_game(...)` RPC.
- `fetchGamesByPlayer()` filters `games` with `.eq("game_participants.user_id", userId)`, then maps results as if the filter were applied.

Impact: P0 correctness. Log Game is one of the app's core loops and should update game rows, participants, feed, wins/losses, and ELO.

Effort: Medium. Risk: Medium because this touches the central match-write path. Confidence: High.

## Scope

In scope:
- `artifacts/mobile/services/gameService.ts`
- Minimal caller adjustments only if TypeScript requires them.

Out of scope:
- UI redesign of Compete.
- Adding a new ELO formula client-side. The RPC already owns ELO updates.
- Changing scheduled games or check-ins.
- Editing `artifacts/mobile/mockup-sandbox/`.

## Current conventions to match

- Services import `supabase` from `@/lib/supabase` and return domain models from `@/constants/data`.
- New service code should warn before returning on Supabase errors so silent failures are observable.
- Keep Expo app commands inside `artifacts/mobile/` when running app-local commands.

## Implementation steps

1. In `gameService.ts`, update `SupabaseGame.winner_side` and participant `team_side` types to lowercase `"a" | "b"` because that is what Supabase returns.
2. Update `mapGameToMatchResult()` to compare against lowercase sides. If the current user is not present in `game_participants`, keep a safe generic mapping for court/recent-game lists.
3. Replace `logGame()` raw inserts with a single RPC call using parameters `p_court_id`, `p_opponent_id`, `p_my_side: "a"`, `p_score_a`, `p_score_b`, `p_winner_side`, and `p_notes`.
4. If the RPC returns an error, warn with the message and return; do not perform fallback raw inserts.
5. Rewrite `fetchGamesByPlayer(userId)` as a two-step query: first read `game_participants.game_id` for the user, then query `games` with `.in("id", gameIds)` selecting courts and participants.
6. Preserve public function signatures unless TypeScript forces a narrow change.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. `pnpm typecheck` — expected exit 0 or only documented pre-existing failures.
3. Manual live check: Compete → Log Game creates a game, no `logGame` warning appears, and Me/player profile shows updated history/ELO after refresh.

## Done criteria

- `gameService.ts` contains exactly one write path for logging games: `supabase.rpc("log_game", ...)`.
- No remaining mobile write sends uppercase game side enums.
- `fetchGamesByPlayer()` no longer filters on `game_participants.user_id` from a `games` query.
- Typecheck passes.

## Escape hatches

STOP and report back if `log_game` is missing from the target Supabase project, has different argument names, or requires a schema change. Do not recreate the RPC from the client task.
