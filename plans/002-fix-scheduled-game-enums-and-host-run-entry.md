# Plan 002 — Fix scheduled-game enum writes and make Host a Run reachable

Written against commit: `d08156e`

## Finding

Scheduled-game writes use enum values the live schema does not accept, and the main Schedule screen has dead Host a Run buttons. Joining/creating runs can appear to work optimistically while failing to persist.

Evidence:
- `artifacts/mobile/services/scheduledGameService.ts` inserts `status: "open"` in `createScheduledGame()`.
- `joinScheduledGame()` upserts `rsvp_status: "team_a" | "team_b"`.
- `artifacts/mobile/app/(tabs)/schedule.tsx` has plus and empty-state buttons with `onPress={() => {}}`.
- `docs/SOURCE_OF_TRUTH.md` records valid live values: `scheduled`/`cancelled`/`completed` and `going`/`waitlist`/`declined`.

Impact: P0/P1 correctness and product completeness. Runs are a core feature, and persistence currently fails silently.

Effort: Medium. Risk: Medium. Confidence: High.

## Scope

In scope:
- `artifacts/mobile/services/scheduledGameService.ts`
- `artifacts/mobile/app/(tabs)/schedule.tsx`
- A small create-run modal/screen if needed, reusing existing design tokens and service functions.

Out of scope:
- Backend schema changes.
- Team-assignment persistence; the existing table models RSVP, not team sides.
- Push notifications for runs.

## Implementation steps

1. In `createScheduledGame()`, change inserted `status` from `"open"` to `"scheduled"`.
2. Add warning logs for failed create/join calls instead of fully swallowing errors.
3. In `joinScheduledGame()`, set `rsvp_status: "going"` regardless of the visual team slot. Keep the `team` parameter only if callers still need it for optimistic UI.
4. Make the Schedule header plus button and empty-state Host button open a create-run flow.
5. The create-run flow must collect at least: court, title, start date/time, max players, optional note. Use existing dark brutalist styles from the Schedule screen.
6. On submit, call `createScheduledGame()`, then refresh runs through existing AppContext refresh paths or append the returned run only if it includes enough joined court data to render correctly.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. Manual app check: create a run from Schedule, refresh, confirm it persists; join it, refresh, confirm participation persists.
3. Optional SQL/live inspection: created `scheduled_games.status` is `scheduled`; participant `rsvp_status` is `going`.

## Done criteria

- No mobile write path sends `scheduled_games.status = "open"`.
- No mobile write path sends `scheduled_game_participants.rsvp_status = "team_a"` or `"team_b"`.
- Schedule's visible Host buttons perform a real action.
- Typecheck passes.

## Escape hatches

STOP and report back if product wants persistent team assignment for scheduled games. That requires a schema/product decision, not reusing `rsvp_status` incorrectly.
