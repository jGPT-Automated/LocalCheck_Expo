# Plan 008 — Real feed hype counts via feed_posts + feed_post_likes

Written against commit: `3445d36`

## Finding

Feed "hype" (like) counts are fiction. `fetchFeed()` synthesizes feed items directly from `check_ins`/`games`/`scheduled_games` rows and hardcodes `hypeCount: 0`; tapping hype calls `AppContext.hypeItem`, which increments local state only and never persists. A `hypePost()` service exists (`feed_post_likes` insert) but is never called — and would fail anyway, because the synthesized item ids are check-in/game ids, not `feed_posts` ids, violating the FK.

Evidence:
- `artifacts/mobile/services/feedService.ts:87` — `hypeCount: 0` hardcoded.
- `artifacts/mobile/context/AppContext.tsx:423-429` — `hypeItem` local-only increment.
- `artifacts/mobile/services/feedService.ts:199-205` — `hypePost` exists, zero callers.
- `docs/supabase/baseline_snapshot.sql` — `feed_posts` is populated by the check-in trigger and by `log_game`; `feed_post_likes` FKs to `feed_posts`.

Impact: P2 correctness/trust. Hype counts reset on refresh and are never shared between users.

Effort: Medium — the honest fix changes the feed's data source. Risk: Medium — feed rendering touches several item types. Confidence: High.

## Dependencies

Best done after Plan 001 (log_game writes `feed_posts` entries for games) and Plan 003 (check-ins keep flowing through the trigger). Both keep `feed_posts` authoritative.

## Scope

In scope:
- `artifacts/mobile/services/feedService.ts` — fetch from `feed_posts` (join author profile, court, like counts, liked-by-me) instead of synthesizing from three raw tables.
- `artifacts/mobile/context/AppContext.tsx` — `hypeItem` persists via `hypePost(postId, userId)` with optimistic update; add unlike if trivially supported.
- `artifacts/mobile/components/FeedCard.tsx` — only if the item shape changes.

Out of scope:
- New backend triggers or RPCs.
- Comments (`game_comments`) UI.
- `artifacts/mobile/mockup-sandbox/`.

## Implementation steps

1. Rewrite `fetchFeed()` to select from `feed_posts` with `profiles` (author), `courts`, and `feed_post_likes(count)`; map `post_type` (`checkin_note`/`game_result`/etc.) to the existing `FeedItem["type"]` values; keep the current message formatting style.
2. Include `huped` (liked by current user) by checking `feed_post_likes` for the signed-in user.
3. Wire `AppContext.hypeItem` to call `hypePost` with the real `feed_posts.id`, keeping the optimistic local increment; refresh the feed afterward.
4. Guard against double-like (unique constraint) — treat insert conflict as success.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. Manual: hype a post, refresh the feed, count persists; second device sees the count.
3. Optional live SQL: `feed_post_likes` gains a row for the tapped post.

## Done criteria

- Feed items come from `feed_posts` with real like counts.
- Hype persists across refresh and devices.
- Typecheck passes.

## Escape hatches

STOP and report back if `feed_posts` rows are missing for content the current feed shows (e.g. scheduled runs have no trigger) — deciding whether to keep synthesizing those item types or add a trigger is a product/backend call.
