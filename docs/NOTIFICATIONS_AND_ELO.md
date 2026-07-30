# Notifications and Elo MVP

Last reviewed: 2026-07-29

This is the current product contract for the first tester release. The code and
database migration are in the `codex/mvp-consolidation` candidate. They are not
active in production until the activation steps below are approved and run.

## User experience

### Ratings

- Basketball and pickleball have separate ratings.
- Each rating starts at 1200.
- The first version uses standard Elo with a fixed K value of 32.
- A court controls the sport for a match. A player cannot select a different
  sport for that court in the score form.
- A logged score is pending. It does not appear in confirmed game history and
  does not change either rating.
- The named opponent can confirm the score. Confirmation changes both ratings
  in one database transaction.
- Either player can object. An objected score is kept on hold and changes no
  rating.
- A pending score confirms after seven days if the opponent takes no action.
- The old combined rating stays in the database for older app versions. New
  leaderboards use the selected basketball or pickleball rating.

This is a deliberately simple MVP. Margin of victory, provisional ratings,
doubles, rating floors, and anti-abuse rules are later work.

### Notifications

The app has one durable inbox. It contains only these first-release events:

- friend request;
- friend accepted;
- run invite;
- score needs review;
- score confirmed; and
- score objected.

The inbox is the source of truth. A phone push is a convenience. If a push is
late or fails, the inbox item is still saved.

Push permission is requested only when the user turns phone alerts on. The app
does not ask on launch. Signed-out users create no notification traffic.

## Scale and safety

- Notification rows are written by database functions, not by the phone.
- Row security lets each user read only their own inbox and phone tokens.
- A unique key prevents the same event from making two inbox items.
- One private Realtime topic refreshes the open inbox. There is no polling
  timer.
- One database job checks pending scores every 15 minutes. It does no rating
  work when no score is due.
- Match confirmation locks both player records and updates the match, ratings,
  records, and activity event together.
- A stable request ID prevents a weak connection or repeated tap from logging
  the same score twice.
- Phone pushes use a small Edge Function. It claims each inbox item once before
  it sends.

## Source files

- Database: `docs/supabase/migrations/20260729_mvp_notifications_and_sport_elo.sql`
- Push sender: `supabase/functions/send-notification/index.ts`
- App inbox: `artifacts/mobile/app/notifications.tsx`
- Score review: `artifacts/mobile/app/match/[id].tsx`
- App services: `artifacts/mobile/services/notificationService.ts` and
  `artifacts/mobile/services/gameService.ts`

## Activation checklist

Do these steps in this order. Do not merge or release between steps.

1. Review and apply the database migration to LocalCheckProd.
2. Run the Supabase security and performance advisors.
3. Create a random `NOTIFICATION_WEBHOOK_SECRET` in Supabase secrets.
4. Deploy `send-notification` with JWT checks off. The function checks the
   private webhook secret itself.
5. Create one Supabase Database Webhook for `INSERT` on
   `public.notifications`. Send it to the deployed function and include the
   secret as the `x-localcheck-webhook-secret` header.
6. Test the inbox with two accounts before phone push is enabled.
7. Make a new iOS build. `expo-notifications` and `expo-device` are native
   dependencies, so an OTA update alone cannot add phone push support to build
   9.
8. Test on two physical phones: friend request and accept, run invite and join,
   score log and confirm, score object, duplicate tap, and app background return.

## Open product rule

An objected score currently stays stored with status `rejected`. It is not
public and changes no rating. Do not delete it automatically until the product
retention rule is approved.
