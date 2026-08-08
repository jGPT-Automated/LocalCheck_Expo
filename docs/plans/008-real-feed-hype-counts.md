# Candidate: persistent feed hype

Revalidate before implementation. The feed historically synthesized items from
domain rows and updated hype counts only in client state even though
`feed_post_likes` exists. If still true, counts reset and do not converge across
users.

## Intended outcome

- Read authoritative feed items and like counts from Supabase.
- Persist a user's hype action against the real feed-post identifier.
- Prevent duplicate likes and make counts converge across active clients.
- Keep failures visible; an optimistic update must reconcile with server truth.

Likely files: `services/feedService.ts`, `context/AppContext.tsx`, and
`components/FeedCard.tsx`. A schema/RPC change, if required, must be a new
migration with RLS tests.

## Acceptance

1. `pnpm check` and `pnpm export:web` pass.
2. User A hypes a real post; the count survives refresh.
3. User B sees the same count through the scoped Realtime/refetch path.
4. A second tap or retry cannot create a duplicate row.

Stop and restate the product/backend contract if `feed_posts` does not contain
every activity type the UI needs; do not paper over missing server truth with
fabricated client entries.
