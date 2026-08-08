# ELO and notifications

## Ratings and score review

- Basketball and pickleball have separate ratings starting at 1200.
- MVP ELO uses K=32; margin of victory and provisional ratings are later work.
- The court controls match sport.
- A submitted score is pending and changes no rating or confirmed history.
- The named opponent may confirm or reject it.
- Confirmation updates the match and both player ratings atomically.
- Rejection keeps an auditable non-public record and changes no rating.
- A stable request identifier prevents duplicate submissions.

Any automatic-confirmation timing is database policy and must be surfaced to
both players before it is changed.

## Notifications

The durable Supabase inbox is source of truth. Phone push is optional delivery.
MVP event types are friend request/acceptance, run invite, score review,
confirmation, and rejection.

- Signed-out clients create no notification traffic.
- Push permission is requested in context, not on first launch.
- Users may read only their own inbox and push tokens.
- Database functions create inbox events and prevent duplicates.
- One private user topic invalidates the open inbox; there is no polling loop.
- The push Edge Function claims work before sending.

## Source and acceptance

- App inbox: `app/notifications.tsx`
- Score review: `app/match/[id].tsx`
- Client services: `services/notificationService.ts` and
  `services/gameService.ts`
- Push sender: `supabase/functions/send-notification/index.ts`
- Database history: `supabase/migrations/`

Acceptance requires two signed-in users completing score submit/confirm/reject,
friend and run notification flows, duplicate-tap checks, and background return.
Push registration and delivery require a current physical iOS build.
