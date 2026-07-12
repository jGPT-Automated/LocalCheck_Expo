# Plan 004 — Replace random head-to-head stats with real game overlap

Written against commit: `d08156e`

## Finding

Player profiles display head-to-head stats using `Math.random()`, so the same profile can show different matchup history across renders.

Evidence:
- `artifacts/mobile/app/player/[id].tsx` filters matches with `return Math.random() > 0.5;` and comments that this is a demo heuristic.
- `fetchGamesByPlayer(id)` is already used on the same screen, and Plan 001 will make player game history reliable.

Impact: P1 correctness/trust. Premium-gated matchup information must not be fake.

Effort: Medium. Risk: Low/Medium. Confidence: High.

## Dependencies

Do this after Plan 001, or include its fixed `fetchGamesByPlayer()` approach in this task. Without reliable player match history, this plan has weak data foundations.

## Scope

In scope:
- `artifacts/mobile/app/player/[id].tsx`
- A small service helper in `artifacts/mobile/services/gameService.ts` if needed, such as `fetchHeadToHeadGames(currentUserId, opponentId)`.

Out of scope:
- New backend RPCs unless the two-query approach is too slow.
- Changing LocalPlus purchase mechanics.
- Redesigning the player profile.

## Implementation steps

1. Add a typed helper that finds games where both users participated by querying `game_participants` for each user, intersecting `game_id`s, then fetching matching `games` with courts and participants.
2. Map each fetched game into a `MatchResult` from the current user's perspective, using lowercase team/winner sides after Plan 001.
3. Replace `getHeadToHeadStats()` random filtering with deterministic stats from that helper.
4. Keep LocalPlus gating behavior: non-plus users should not receive premium detail beyond what the current screen already exposes.
5. Show an honest empty state when there are zero shared games.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. Manual app check: open the same player profile twice and confirm head-to-head totals are stable; open a player with no shared games and confirm the empty state is clear.

## Done criteria

- No `Math.random()` remains in `app/player/[id].tsx`.
- Head-to-head stats derive only from persisted `games` and `game_participants` data.
- Typecheck passes.

## Escape hatches

STOP and report back if privacy/product rules require hiding all head-to-head data from non-LocalPlus users at the query layer rather than just at render time.
