# Front-end handoff: QStash timers, auto check-in, challenges (Oct 13)

For the agent doing front-end changes and the polish review on PR #67
(`codex/auto-check-in`). The backend is done. Don't change SQL, Edge Functions or
timings without Jesse. Decisions: `docs/product/DECISIONS.md` D50–D52.
Backend detail: `docs/SUPABASE.md` → "Timed work (QStash)".

## 1. User flows (what the player sees)

**Auto check-in** (local court only, opt-in, real iPhone builds only):

| Time | What happens | Player sees | Others see |
|---|---|---|---|
| 4:00 | Phone enters the 150 m circle. App calls `auto_check_in_arrive`. Server holds an arrival (private). | Nothing yet | Nothing |
| 4:01 | Still inside a minute. | Local notice **"Checked in at Rancho"**: "Posts at 4:05 PM. Not playing? Tap Hide." Home: **CHECKED IN** button, line "Checked in automatically · Posts at 4:05 PM · Hide" | Nothing |
| 4:05 | QStash timer posts it (check-in time = 4:00). | Push **"Check-in posted"**: "You're at Rancho. Not playing? Tap Hide." It replaces the 4:01 notice. Home line: "Checked in automatically · Hide" | Court roster, feed. Friends with both alert switches on get "A friend just checked in / Jesse is at Rancho" |
| Any time | Leaves the circle. App calls `auto_check_in_leave`. | Checked out at once (before 4:05: it never posted) | Gone |
| 5:30 | Phone never reported leaving. QStash ends it 1.5 h after arrival. | Push **"Auto checked out"**: "Still at Rancho? Tap I'm still here." The button starts a new 1.5 h | Gone |

**Hide** (any time, from the notice, push, Home line or court drawer) calls `undo_auto_check_in`. It erases the arrival or check-in and its feed item. Friend alerts already sent stay sent. Tapping **CHECKED IN** while it waits to post also hides it.

**Manual check-in:** ends 45 minutes after it started (QStash). No push.

**Challenge:** needs court, day and time, up to 7 days ahead. Unanswered, it expires at its game time (leaves the inbox; no push). Accepted 30+ minutes ahead: both players get **"CASUAL GAME"** / **"RANKED GAME"**, "With {username} at {court} in 30 minutes". Only sent if the game hasn't started.

**Score:** approved automatically at its 3-day deadline; a held game is voided at its deadline (unchanged rules).

## 2. Names the app uses

**Server functions (authenticated):**

| Function | Returns / errors |
|---|---|
| `my_pending_auto_check_in()` **new** | `{court_id, arrived_at, posts_at}` or `null` (also `null` before the migration runs) |
| `auto_check_in_arrive(p_court_id)` | `{status: "pending"|"already"|"not_local", arrived_at, court_name}` |
| `auto_check_in_leave(p_court_id)` | `"cancelled"|"checked_out"|"none"` |
| `undo_auto_check_in()` | `boolean` (Hide) |
| `resume_auto_check_in(p_court_id)` | `"checked_in"|"already"|"not_local"` (I'm still here) |
| `create_challenge(p_opponent_id, p_court_id, p_play_on, p_ranked, p_play_at)` | `p_play_at` is **required** now. LC103 "Pick a day and time." / "Pick a time in the next 7 days.", LC104 open challenge, LC105 10 a day |
| `respond_to_challenge(p_challenge_id, p_accept)` | LC112 "This challenge expired." once the game time passes |

Never call `fire_timer` or `timer_booked`: they're service-role only.

**Notifications** (`public.notifications.type`, `data`):

| type | title / body | data |
|---|---|---|
| `auto_check_in` **new** | Check-in posted / You're at {court}. Not playing? Tap Hide. | `path:/court/<id>`, `kind:"auto_check_in"`, `court_id`, `category:"auto-check-in"`, `collapse_id:"localcheck-auto-check-in"` |
| `auto_check_out` | Auto checked out / Still at {court}? Tap I'm still here. | `path`, `kind:"auto_check_out"`, `court_id`, `category:"auto-check-out"` |
| `friend_check_in` | A friend just checked in / {name} is at {court} | `path` |
| `challenge` (reminder) | CASUAL GAME or RANKED GAME / With {username} at {court} in 30 minutes | `path:/challenge/<id>`, `challenge_id` |

**App constants** (`lib/autoCheckInModel.ts`):
- `AUTO_CHECK_IN_HOLD_MINUTES = 5`, `AUTO_CHECK_IN_MAX_HOURS = 1.5`, `AUTO_CHECK_IN_NOTICE_DELAY_SECONDS = 60`.
- `AUTO_CHECK_IN_NOTIFICATION_ID = "localcheck-auto-check-in"`. It **must** equal the server's `collapse_id`.
- `AUTO_CHECK_IN_CATEGORY = "auto-check-in"`, with action `AUTO_CHECK_IN_UNDO_ACTION = "undo"` (button **Hide**).
- `AUTO_CHECK_OUT_CATEGORY = "auto-check-out"`, with action `CHECK_BACK_IN_ACTION = "check_back_in"` (button **I'm still here**). `GOT_IT_ACTION` was removed.
- Helpers: `postsAt(arrivedAt)`, `clockTime(date)` ("4:05 PM"), `checkedInNotification(court, postsAt)`.
- `services/checkInService.ts`: `AUTO_CHECKOUT_MINUTES = 45`.

**App state** (`context/AppContext.tsx`):
- `pendingAutoCheckIn: {courtId, postsAt} | null` **new**.
- `hideAutoCheckIn(): Promise<boolean>` **new**.
- `checkedInAuto`, `checkedInCourtId`.
- `refreshCheckedIn()`: now also runs on app foreground and 3 s after `postsAt`.

## 3. Already built for you (Claude, Oct 13, unreviewed). Polish, don't rebuild

- `components/autoCheckIn/AutoCheckInNote.tsx`: the waiting and posted lines and the Hide link. Toasts: **HIDDEN** / "You're not checked in."
- `components/HomeScreen.tsx` and `components/sheet/CourtSheetContent.tsx`: the button shows CHECKED IN while waiting, and tapping it then hides.
- `services/autoCheckInService.ts`: the notice after 60 s, removed on leave; button sets registered on every launch (`AutoCheckInContext`).
- `context/AutoCheckInContext.tsx`: toasts **HIDDEN** and **STILL HERE** / "Checked in for another 1.5 hours, or until you leave."
- `context/NotificationContext.tsx` (unchanged): `kind === "auto_check_in"` + Hide calls undo; `kind === "auto_check_out"` + I'm still here calls resume. Works for both the local notice and the server push.
- Mock Jesse approved ("what you have is fine"): `docs/handoffs/2026-10-13-home-waiting-mock.html`.

## 4. Open front-end items

1. **Polish** the Home and drawer waiting line against the mock and `docs/product/DESIGN.md`.
2. **Hide on the player's own row in the court feed:** Jesse's idea. Show him a mock first; don't build it unasked.
3. **Fix stale comments:**
   - `components/challenge/ChallengeSheet.tsx:31` ("today plus four days"; the wheel is 7 days).
   - `lib/challengeModel.test.mts:214` (test name).
   - `services/checkInService.ts:9` (says a pg_cron job ends check-ins every 5 minutes; QStash does now).
4. **Notification buttons only show when the player long-presses or expands a notification.** That's how iOS works ([Apple: actionable notifications](https://developer.apple.com/documentation/usernotifications/declaring-your-actionable-notification-types)). Most players just tap, which opens `/court/<id>`, so the in-app Hide is the main path.
5. **After launch, not now:** a countdown to auto checkout on the home court page.

## 5. What needs a build vs. an over-the-air update

- **Needs the 1.0.4 TestFlight build (PR #67):** geofence, notification buttons, Hide on the notice. Build 33 (1.0.3) has neither auto check-in nor challenges.
- **Over the air, after that build:** any JS or copy change in §3–4.
- **Server side:** the timer script ("2 REAL" in the Supabase SQL editor, run by Jesse). The push sender update adds `collapseId` and `categoryId`; until it's deployed, "Check-in posted" stacks under the 4:01 notice and the push buttons don't show.
- **Web preview:** no auto check-in (no geofence), so `pendingAutoCheckIn` stays `null` there. Test the waiting state on a phone.

## 6. Done means (real flow, on the 1.0.4 build)

1. Walk onto the local court: the notice at about 1 minute, the push at 5 minutes, which replaces it.
2. Hide, from both the notice and Home: you're gone from the court and the feed.
3. Walk away: checked out at once.
4. Check in by hand: checked out at 45 minutes.
5. Challenge from the web test account for about 35 minutes out, and accept on the phone: both reminders 30 minutes before.
6. `pnpm run check` passes.
