# LocalCheck app architecture

Status: Required contributor guide
Last verified: 2026-07-29

Read this file before changing a mobile screen. It tells you which visual code
you may change and which product behavior you must preserve. Read
[`CURRENT_STATE.md`](CURRENT_STATE.md) first for the current release state.

## One source of truth

- Canonical checkout: `/Users/JesseH/Projects/LocalCheck_Expo`
- Shipping app root: `artifacts/mobile/`
- Backend: Supabase LocalCheckProd `qkrnmyexzvaxiqfxwwfb`
- Current review branch: `codex/mvp-consolidation`
- Current review PR: open PR [#22](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/22)

Do not implement from `archive/`, `mockup-sandbox/`, a Documents copy, or a
design artifact. Mocks show the intended experience. They are not application
code and they do not define database behavior.

## System flow

```text
Expo Router screen
  -> React context owns shared session and screen state
  -> domain service validates and maps the request
  -> Supabase query or approved SECURITY DEFINER RPC
  -> database transaction, RLS, and Broadcast invalidation
  -> RealtimeHub receives a small private invalidation
  -> the active consumer performs one authoritative refetch
  -> screen renders confirmed server state
```

Realtime does not carry the final product data. It tells the correct active
screen that data changed. The screen then reads the current server truth. Do
not add global polling or use a socket connection as presence.

## Provider order and ownership

The provider order in `artifacts/mobile/app/_layout.tsx` is intentional:

1. `AuthProvider` owns the Supabase session and profile bootstrap.
2. `AuthGate` keeps signed-out users out of authenticated routes.
3. `RealtimeHubProvider` owns private scoped Broadcast channels.
4. `NotificationProvider` owns the durable inbox, unread count, and optional
   phone-push registration.
5. `CourtPresenceProvider` owns watched court rosters and bounded map/list
   counts.
6. `AppProvider` owns shared courts, local court, check-in, feed, run, planned
   visit, friend, and profile state.
7. `CourtSheetProvider` owns the one contextual court-preview sheet.

The data providers exist only for a signed-in session. A signed-out app must
not start Supabase reads, Realtime channels, or notification work. Do not move
these providers without a full auth and lifecycle test.

## Rules that UI work must preserve

- Apple Sign-In works in TestFlight. Do not change it during UI work.
- A court check-in is durable database state. Phone lock, app background,
  leaving a screen, or socket loss never checks a player out.
- Use private scoped topics only: `user:<id>`, `court:<id>`, `market:<name>`,
  and `run:<id>`.
- Realtime listeners exist only while they have a consumer. The hub closes
  channels in the background and performs a scoped catch-up on return.
- Use `services/*` for backend access. Do not add Supabase calls to visual
  components.
- Use the write paths in [`BACKEND_WRITE_PATHS.md`](BACKEND_WRITE_PATHS.md).
  Do not replace an RPC with a direct table write.
- Always inspect and handle the Supabase `error` value. Do not show success
  before the server confirms it.
- Do not add mock users, fake activity, fake counts, or fake venue facts.
- Orange `#FF5500` means LocalCheck identity, live state, selection, ranked
  state, or a primary action. Sport color is quiet metadata only.
- Mapbox and phone notifications contain native code. A dependency or config
  change for either feature needs a new iOS build. An OTA is not enough.
- A database schema change needs a migration, a rollback or recovery note,
  and explicit approval before production use.

## Screen contracts

### Home

Owner: `artifacts/mobile/components/HomeScreen.tsx`

Purpose: Show the signed-in player's local-court truth without making the
player search for it.

Preserve:

- The Home court summary is a full-width page section. It is not the reusable
  Explore card.
- The header, court summary, `Who's Here`, and `Next Run` stay fixed. Only the
  Activity Feed scrolls.
- Check In and Check Out call `AppContext`; do not write `check_ins` directly.
- `Who's Here` comes from `CourtPresenceContext` and the local court topic.
- `View all` belongs in the `Who's Here` section header. Do not restore a
  detached count box.
- `Next Run` uses real run data. Keep its current compact presentation unless
  the product owner requests a new one.

### Explore list and map

Owners:

- `artifacts/mobile/components/CourtsScreen.tsx`
- `artifacts/mobile/components/MapScreen.tsx`
- `artifacts/mobile/components/MapScreen.web.tsx`
- `artifacts/mobile/components/CourtListItem.tsx`
- `artifacts/mobile/components/sheet/CourtSheetContent.tsx`

Purpose: Find relevant courts in the player's current market and open one
shared court-preview sheet.

Preserve:

- Discovery is bounded by market/location. Do not fetch every court.
- List and map use the same court identity and confirmed counts.
- Map markers are Mapbox sources/layers, not freely positioned React views.
- Map clustering and camera state stay inside Mapbox.
- The reusable court card belongs in Explore and selected-map previews.
- A non-local court can call `AppContext.setLocalCourt`. A local court can be
  identified without a strong sport-colored slab.
- Check In and Check Out use `AppContext`.
- Add Court is not a working production write yet. Do not present it as
  successful until an approved `create_court` backend path exists.

### Schedule

Owners:

- `artifacts/mobile/app/(tabs)/schedule.tsx`
- `artifacts/mobile/components/CourtSchedulePanel.tsx`
- `artifacts/mobile/services/plannedVisitService.ts`
- `artifacts/mobile/components/sheet/FormSheet.tsx`

Purpose: View court activity, post planned arrival times, and find scheduled
runs.

Preserve:

- View mode reads. Edit mode collects more than one local change. Save sends
  the batch once and then refreshes once.
- Planned-visit insert uses `upsert(..., ignoreDuplicates: true)`. A normal
  upsert fails because `user_id` cannot be updated.
- Failed selections remain visible for retry. Do not report a failed save as
  success.
- The heatmap covers 8 AM through 11 PM and defaults to the current time bucket
  when the screen regains focus.
- Create Run uses the shared form sheet and approved run RPCs.
- Edit Run is not a working backend path. Do not expose it as working.

### Compete and score review

Owners:

- `artifacts/mobile/app/(tabs)/compete.tsx`
- `artifacts/mobile/services/gameService.ts`
- `artifacts/mobile/app/match/[id].tsx`
- `docs/supabase/migrations/20260729_mvp_notifications_and_sport_elo.sql`

Purpose: Show one sport-specific leaderboard and submit a score for opponent
review.

Preserve:

- Basketball and pickleball ratings are separate.
- A court defines the sport for a logged match.
- A new match is pending. It does not change Elo, record, or public history.
- `confirm_match` changes both players in one database transaction.
- `reject_match` puts the score on hold and changes no rating.
- The current MVP uses 1200 start and standard Elo with K=32.
- The signed-in hidden row must not duplicate the user in public rows or alter
  public rank numbering.
- The migration is candidate source only until explicitly approved and applied.

### Me, profile, friends, and settings

Owners:

- `artifacts/mobile/app/(tabs)/elo.tsx`
- `artifacts/mobile/app/player/[id].tsx`
- `artifacts/mobile/app/friends.tsx`
- `artifacts/mobile/app/settings.tsx`
- `artifacts/mobile/services/profileService.ts`
- `artifacts/mobile/services/friendshipService.ts`

Purpose: Show the player's real identity and record, manage social state, and
control explicit preferences.

Preserve:

- Metrics come from Supabase. A failed count is not the same as a confirmed
  zero.
- Friend requests are pending until the other user accepts.
- Use `request_friend`, `accept_friend_request`, and `remove_friendship`.
- Do not write the `friendships` table directly.
- Profile privacy is not fully persisted across all app surfaces yet. Do not
  claim that the current session-only check-in visibility setting hides every
  profile surface.
- Apple Sign-In must remain unchanged.
- Account deletion is not release-ready until the Edge Function and Apple
  token revocation are deployed and physically tested.

### Court details

Owner: `artifacts/mobile/app/court/[id].tsx`

Purpose: Give one court a stable identity and four focused views: `Feed`,
`Locals`, `Schedule`, and `Details`.

Preserve:

- The four tabs remain separate and their content can scroll.
- Feed is court-specific. Do not substitute the local-court feed for another
  court.
- Locals use real roster/ranking/friend data. Orange glow means ranked; the
  star means accepted friend.
- Schedule reuses the same planned-visit and run contracts as the main Schedule
  screen.
- Details shows only trusted venue fields that exist.
- Check In, Check Out, and local-court changes go through `AppContext`.

### Run detail and notifications

Owners:

- `artifacts/mobile/app/run/[id].tsx`
- `artifacts/mobile/app/notifications.tsx`
- `artifacts/mobile/context/NotificationContext.tsx`
- `artifacts/mobile/services/notificationService.ts`
- `artifacts/mobile/services/pushNotificationService.ts`
- `supabase/functions/send-notification/index.ts`

Preserve:

- Run capacity and RSVP changes use the approved run RPCs.
- A run detail subscribes only to `run:<id>` while open.
- The database inbox is the source of truth. Phone push is optional delivery.
- Notification types stay limited to friend request/accept, run invite, score
  review, score confirmed, and score objected for the first release.
- Push permission appears only after the user enables phone alerts.
- The notification migration, Edge Function, secret, and webhook are not
  active until approved. Build 9 cannot receive phone push.

## Native and release boundaries

These changes need a new native build:

- `@rnmapbox/maps` dependency or config changes;
- `expo-notifications` or `expo-device` dependency or config changes;
- iOS permissions, entitlements, config plugins, bundle identity, or native
  environment changes.

Pure JavaScript and asset changes can use OTA only when the installed build has
the same runtime and all required native modules. A merge to `main` can start
the configured OTA workflow. It does not create a new TestFlight build.

No contributor may merge, publish an OTA, apply a migration, deploy an Edge
Function, start EAS/TestFlight, or submit to Apple without explicit approval.

## Required check before a UI PR

1. Name the screens and files changed.
2. List every context, service, RPC, Realtime topic, and native dependency that
   the screen uses.
3. Keep the existing write and refresh path unless the task explicitly changes
   product behavior.
4. Run TypeScript, focused tests, `git diff --check`, and a fresh preview.
5. Compare at the requested phone viewport. Record what was and was not
   visually inspected.
6. Update `CURRENT_STATE.md`, `product/ACTIVITY_LEDGER.md`, and the affected
   design or release document.
7. Keep the PR draft until product review and physical-device gates pass.

If a mock conflicts with this file, stop at the product boundary and ask. Do
not silently replace working logic to make a screenshot match.
