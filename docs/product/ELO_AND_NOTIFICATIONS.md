# ELO and notifications

## Ratings and score review

- Basketball and pickleball have separate ratings starting at 1200.
- MVP ELO uses K=32; margin of victory and provisional ratings are later work.
- The court controls match sport.
- A submitted score is pending and changes no rating or confirmed history.
- In 1v1, the named opponent may approve or dispute it. Team games require
  equal 2v2, 3v3, or 5v5 rosters; every participant other than the submitter may
  approve or dispute, and all participants must approve before a team result is
  confirmed.
- Approval returns the persisted match row; only the transition to `confirmed`
  updates the match and participant ratings atomically. Repeated approval is
  idempotent and never applies ELO twice.
- A dispute may include an explanation and corrected score/court/date. A note-
  only dispute places the match `held` for seven days; a corrected submission
  starts a fresh three-day pending review. The third dispute or an unresolved
  hold voids the match and changes no rating.
- A stable request identifier prevents duplicate submissions.
- Silence automatically confirms an undisputed pending score after three days.
  A dispute places the result on hold for seven days; a participant correction
  returns it to pending review, while a third dispute or unresolved hold voids
  it without changing ratings. Explicit review and the recurring automatic-
  confirmation job use the same rating path for their match format.

Any automatic-confirmation timing is database policy and must be surfaced to
both players before it is changed.

## Notifications

The durable Supabase inbox is source of truth. Phone push is optional delivery.
MVP event types are friend request/acceptance, run invite, score review,
confirmation, dispute/hold, revision, and voiding.

Presentation is intentionally split by whether the player still owes an
action:

- Profile `INBOX` and the Me-tab badge include pending friend requests, score
  reviews, run invitations, and future game invitations.
- Informational outcomes such as friend acceptance, game confirmation, and
  rejection remain in the notification feed; they do not inflate the Profile
  Inbox badge.
- This is a presentation split over the same durable notification model, not a
  second notification store.

- Signed-out clients create no notification traffic.
- Push permission is requested in context, not on first launch.
- Users may read only their own inbox and push tokens.
- Database functions create inbox events and prevent duplicates.
- One private user topic invalidates the open inbox; there is no polling loop.
- The push Edge Function claims work before sending and recovers stale claims.
- Expo tickets and receipts are durable per-token attempts. Transient delivery
  failures retry within a bounded limit; `DeviceNotRegistered` removes the bad
  token rather than repeatedly sending to it.
- Foreground taps, background taps, and cold-start responses all pass through
  one allow-listed route resolver and are deduplicated by notification request
  identifier.

## Source and acceptance

- App inbox: `app/notifications.tsx`
- Score review: `app/match/[id].tsx`
- Client services: `services/notificationService.ts` and
  `services/gameService.ts`
- Push sender: `supabase/functions/send-notification/index.ts`
- Database history: `supabase/migrations/`

Acceptance requires two signed-in users completing 1v1
submit/confirm/reject, four signed-in users completing one 2v2 review, friend
and run notification flows, duplicate-tap checks, and background return. Push
registration, QR scanning, and the native date picker require a current iOS
build.
