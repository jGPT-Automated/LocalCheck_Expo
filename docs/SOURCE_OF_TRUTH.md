# LocalCheck — Source of Truth & Task List
**Status: LIVING DOCUMENT.** Update this file (don't create a new one) every time a task ships or a new gap is found. Last verified: 2026-07-13, against live source + live database — not against the pasted DeepWiki/audit docs alone.

**Canonical repo:** `jGPT-Automated/LocalCheck_Expo` @ `main`
**Canonical backend:** Supabase project `jzclwnzcektqhgkkdeje`
**Other repos** (`agenticjess-star/LocalCheck_Expo`, `agenticjess-star/LocalCheck-IOS`, `agenticjess-star/localcheck` web app) are **not** in scope for this doc. If work needs to happen there, that's a separate decision — don't let it bleed into this task list.

**Verification method:** every claim below was checked one of three ways — (1) direct file read from GitHub, (2) direct query against the live Supabase project via MCP, or (3) DeepWiki cross-check. Claims from the earlier pasted audits that I could not verify directly are marked accordingly.

---

## 1. TL;DR

The app's screens are almost entirely wired to real Supabase data — this is much further along than a prototype. But **two of the three "log an activity" write paths (log a game, schedule/join a run) are currently broken against the live database and would fail silently for a real user today.** Verified, not theoretical: the live `games` and `scheduled_games` test rows in the database have enum values the client's own code cannot produce, meaning that data was seeded directly, not through the app.

The bigger surprise: **the fixes for two of the biggest gaps already exist as working, correct, tested-by-nobody-but-ready Postgres functions in the live database** (`log_game`, `switch_active_checkin`). Nobody wired the client to call them. This changes the task list — some "build this" items in the earlier audit are actually "call this."

---

## 1.5 Status update — 2026-07-13 (PR consolidation + core-loop work)

Repo was consolidated back to a single `main`: PR #11 merged (which carried #8, #9, and #10's
plans in its history — GitHub marked all three merged), docs-only #6 merged, #7 closed
(based on the stray `jbyh` branch; conflicts with merged work — onboarding recorded below
as an open item). Stale branch pointers remain on GitHub but can be deleted from the
branches page (the session's credentials can't delete refs).

**Shipped and on `main`:**
- All four P0s (§4): `log_game` RPC wired with tie/score validation and real
  success/failure UI, fixed player-history query with viewer-perspective scores,
  correct scheduled-game enums, `switch_active_checkin` with success booleans.
- P1-1 Host a Run (create-run modal, host auto-RSVPs, capacity-checked joins,
  all-7-days schedule mapping) and P1-4 real head-to-head.
- No auto-assigned local court (#8); robust check-in loop (#9).
- Fabricated data removed app-wide: fake run results/Elo deltas, invented court
  rating/surface/capacity, weather stub, random H2H (plans 001–007 in `plans/`).
- **Full-screen court takeover**: tapping a court on Explore/Map now slides a
  full-screen sheet showing the home-style court view (hero, WHO'S HERE roster,
  next run, check-in, set/unset local). Home is untouched — always the local court,
  FIND A COURT state when none is set.
- **45-minute auto checkout**: pg_cron job `auto-checkout-stale-checkins` (every
  5 min, migration `auto_checkout_stale_checkins`, in-repo copy under
  `docs/supabase/migrations/`) closes stale check-ins server-side; client reads
  filter to the same 45-min window (`AUTO_CHECKOUT_MINUTES` in `checkInService.ts`).
  A push reminder before auto-checkout is a future iteration (needs P2-1).

**Top remaining items (see §4 for the rest):**
1. **Manual live walkthrough** of the new flows on device (two-account check-in
   switching, log game between two users, run create/join persistence) — code-level
   and schema-level verification done; end-to-end app run still pending.
2. **Onboarding flow** — closed PR #7 had a full implementation (username, sport,
   location steps); rebuild it on top of current `main` (its `profileService`
   widening must NOT reintroduce client `is_pro` writes).
3. **Plan 008** (`plans/008-real-feed-hype-counts.md`) — real feed like counts via
   `feed_posts` + `feed_post_likes`.
4. P1-2 profile editing, P1-3 settings toggles, P1-5 delete account, P1-6 friend
   requests, P2 items (push notifications unlock the checkout reminder), and the
   court-add verify endpoint gap recorded in #6 (`AddCourtModal.verifyPhoto()` posts
   to a nonexistent `/api/courts/verify` — court adding is blocked in prod builds).

---

## 2. Confirmed current state, screen by screen

Full screen-by-screen interaction detail (routes, empty states, per-screen data sources) is in `LocalCheck_Screens_Interactions_Map.md` from the prior session — that detail is still accurate for the UI layer and isn't repeated here. This table is the status delta:

| Area | Status | Confirmed by |
|---|---|---|
| Auth (sign up/in, Apple SI, session persistence) | ✅ Real | direct read + live `profiles`=13 rows |
| Home / check-in / who's here | ✅ Real | direct read |
| Explore / find courts / search / GPS | ✅ Real | direct read |
| Compete → Leaderboard | ✅ Real | direct read |
| Compete → Log Game | ✅ Real (2026-07-13: `log_game` RPC, validation, real success/failure UI) | shipped — see §1.5 |
| Me / ELO / match history | ✅ Real (ELO updates via `log_game`; per-game delta shown as — until stored server-side) | shipped — see §1.5 |
| Schedule (view runs) | ✅ Real | direct read |
| Schedule → Host a Run | ✅ Real (create-run modal; host auto-RSVPs) | shipped — see §1.5 |
| Schedule → Join a Run | ✅ Real (`going` RSVP, capacity-checked) | shipped — see §1.5 |
| Court Detail | ✅ Real | direct read |
| Player Profile — stats | ✅ Real | direct read |
| Player Profile — Head-to-Head | ✅ Real (shared-games query) | shipped — see §1.5 |
| Friends | ✅ Real | direct read + live `friendships`=10 rows |
| Friend requests (pending/blocked) | 🔴 Not implemented — schema supports it, code always inserts `'accepted'` | live schema + direct read |
| Settings — visibility, preferred sport | ✅ Real, persisted | direct read |
| Settings — 4 toggles (push/location/haptics/dark mode) | 🔴 Local state only | direct read |
| Settings — LocalPlus upgrade | 🔴 Stub `Alert` | direct read + live `subscriptions`=0 rows |
| Settings — Delete account | 🔴 Stub `Alert`, deletes nothing | direct read |
| Push notifications (end-to-end) | 🔴 Not started — no `expo-notifications`, no token table | DeepWiki cross-check |

---

## 3. Verified against the live database (new this session)

Pulled directly via Supabase MCP against project `jzclwnzcektqhgkkdeje`. Full reconstructed schema/functions in the companion file `LocalCheck_Supabase_Baseline_Snapshot.sql`.

**Live data snapshot:** 13 profiles · 6 courts · 23 check-ins · 3 games · 8 game_participants · 1 scheduled_game · 1 scheduled_game_participant · 10 friendships · 0 subscriptions · 0 feed_post_likes · 0 game_likes · 0 game_comments.

**Confirmed enum mismatches (this is the headline finding):**

| Table.column | Live enum values | What the client actually sends | Result |
|---|---|---|---|
| `games.winner_side` | `a`, `b` | `"A"`, `"B"` | insert fails, swallowed by `catch{}` |
| `game_participants.team_side` | `a`, `b` | `"A"`, `"B"` | insert fails, swallowed by `catch{}` |
| `scheduled_games.status` | `scheduled`, `cancelled`, `completed` | `"open"` | insert fails, swallowed by `catch{}` |
| `scheduled_game_participants.rsvp_status` | `going`, `waitlist`, `declined` | `"team_a"`, `"team_b"` | insert fails, swallowed by `catch{}` |

I checked the actual stored rows: all 3 `games` rows have `winner_side='a'`, all 8 `game_participants` rows split 4/4 `'a'`/`'b'`, the 1 `scheduled_games` row has `status='scheduled'`, the 1 participant row has `rsvp_status='going'` — **all lowercase, all valid**. Since the current client code can only produce the invalid uppercase/wrong-word versions, **this test data did not come from anyone using the app** — it was seeded directly against the database. First-hand confirmation that logging a game and joining/creating a run are broken right now, not just theoretically fragile.

**Two RPC functions already exist, are correct, and are never called (⭐ biggest finding of this session):**

- **`public.log_game(court_id, opponent_id, my_side, score_a, score_b, winner_side, notes)`** — atomically inserts the game + both participants with correct enum casing, computes a *real* Elo update (K=32, expected-score formula, not the client's hardcoded flat ±15), updates both players' `wins`/`losses`/`elo_rating`, and posts a `game_result` feed entry. This single function is the fix for both "ELO never updates" and "logGame writes wrong enum values."
- **`public.switch_active_checkin(court_id, visibility, note)`** — atomically checks the caller out of any current check-in before checking into a new one (the current client can't guarantee this — two separate calls, no transaction), and already supports the check-in note field the UI has no input for.

Full verbatim definitions are in the companion SQL file. **Nobody needs to design or build these — the task is to point the client at them.**

**`profiles.is_pro` has a live trigger (`trg_sync_profile_is_pro`) that derives it from the `subscriptions` table**, and the column's own DB comment says *"Do not write directly from the client."* `AppContext.setIsLocalPlus()` currently violates this by writing `is_pro` directly. Harmless today only because nothing else touches `subscriptions` (0 rows) — but it's the wrong integration point for whenever real RevenueCat/IAP work happens. When that's built, it should insert/update `subscriptions` rows and let the trigger derive `is_pro`; the client should never set it directly again.

**`feed_posts` is quietly half-alive.** A trigger (`trg_log_checkin_feed_post`) creates a `feed_posts` row on every public check-in — that's where the table's 4 existing rows came from. But `feedService.ts` never reads from `feed_posts`; it reconstructs the feed ad hoc from `check_ins`/`games`/`scheduled_games` directly. So there's a real, live, working write path into a table nobody reads. (And once `log_game` gets adopted, it'll add `game_result` feed_posts rows too — still nobody reading them. Not urgent, but don't be surprised by orphaned rows.)

**Confirmed via DeepWiki (independent cross-check, per your instruction not to bias the question):** asked DeepWiki directly, with no framing toward a particular answer, where migrations live and what RPCs the client calls. It confirmed independently: **zero `supabase.rpc()` calls anywhere in the client**, and **no migration files exist in the repo** — the schema, triggers, and both RPC functions above exist *only* live in Supabase, with no version-controlled source. That's a real risk on its own (see §5).

**Security advisories (live, via Supabase advisors, not previously flagged anywhere):** `courts_with_stats`, `city_courts_summary`, `state_courts_summary` are `SECURITY DEFINER` views — worth a deliberate look at whether that's intended. Leaked-password protection is currently disabled on Auth. Several tables are readable by the `anon` role via the GraphQL API even where that's probably not intended (mostly low-stakes read tables, but worth a pass before launch).

---

## 4. Task list

Reordered from the earlier audit given the RPC discovery. P0 = broken/silently-failing today. P1 = missing core feature. P2 = important UX gap. P3 = polish/process.

### P0 — broken right now — ✅ ALL DONE 2026-07-13 (see §1.5)

**P0-1 — ✅ DONE — Rewrite `logGame()` to call the existing `log_game` RPC instead of raw inserts**
```
File: artifacts/mobile/services/gameService.ts

Replace the current logGame() body (which inserts into `games` then
`game_participants` with "A"/"B" and is silently failing against the live
enum) with a single call to the RPC that already exists in the database:

  const { data, error } = await supabase.rpc('log_game', {
    p_court_id: payload.courtId,
    p_opponent_id: payload.opponentId,
    p_my_side: 'a',
    p_score_a: payload.myScore,
    p_score_b: payload.theirScore,
    p_winner_side: payload.myScore > payload.theirScore ? 'a' : 'b',
    p_notes: payload.note ?? null,
  });
  if (error) { console.warn('logGame failed', error.message); return; }

This one RPC call replaces the manual games + game_participants inserts,
AND already updates elo_rating/wins/losses server-side with a real Elo
formula (K=32) — do not also build a separate ELO-update step, it's
redundant with what log_game already does.

Do not change mapGameToMatchResult() or fetchGamesByPlayer() in this task
— those are P0-2, separate bug.

SUCCESS CRITERIA:
- Logging a game via Compete → Log Game creates a real games row with
  lowercase winner_side
- Both players' elo_rating/wins/losses change immediately after
- No console warnings on submit
```

**P0-2 — ✅ DONE — Fix `fetchGamesByPlayer`'s broken join filter**
```
File: artifacts/mobile/services/gameService.ts

PROBLEM: `.eq("game_participants.user_id", userId)` filters on a joined
table column, which PostgREST does not support as a top-level filter.
It silently returns wrong/empty results.

FIX: two-step fetch —
  1. const { data: participations } = await supabase
       .from("game_participants").select("game_id").eq("user_id", userId).limit(100);
  2. const gameIds = participations?.map(p => p.game_id) ?? [];
     if (gameIds.length === 0) return [];
     const { data: games } = await supabase
       .from("games")
       .select("*, courts(name, sport_type), game_participants(user_id, team_side, profiles(*))")
       .in("id", gameIds)
       .order("played_at", { ascending: false })
       .limit(50);

SUCCESS CRITERIA: Me tab and Player Profile show real match history for
a user who has logged games via the fixed P0-1 flow.
```

**P0-3 — ✅ DONE — Fix `joinScheduledGame` and `createScheduledGame` enum values**
```
File: artifacts/mobile/services/scheduledGameService.ts

joinScheduledGame(): change `rsvp_status: team === "A" ? "team_a" : "team_b"`
to always `rsvp_status: "going"`. The valid enum is going/waitlist/declined
— there is no team concept in this table. Team assignment stays purely a
client-side display concern (AppContext's optimistic update already
handles it) — either drop the `team` param or keep it unused.

createScheduledGame(): change `status: "open"` to `status: "scheduled"`
(the actual enum default).

SUCCESS CRITERIA: joining a run and creating a run both persist to
Supabase without silent failure; the participant/new run appears after
a refresh.
```

**P0-4 — ✅ DONE — Harden check-in to use `switch_active_checkin`**
```
File: artifacts/mobile/services/checkInService.ts, context/AppContext.tsx

Replace the separate checkInToCourt() insert with a call to the existing
RPC, which atomically checks the user out of any other active check-in
first:

  const { data, error } = await supabase.rpc('switch_active_checkin', {
    p_court_id: courtId,
    p_visibility: visibility,
    p_note: note ?? null,
  });

This also gives you a real place to wire the check-in note field
(P2 item below) since the RPC already accepts it.

SUCCESS CRITERIA: a user checked in at Court A who checks into Court B
is automatically checked out of A — verify with a live query against
check_ins that no user has two rows with checked_out_at IS NULL.
```

### P1 — missing core features

- **P1-1 — ✅ DONE 2026-07-13 — Build "Host a Run" create-run UI.** `createScheduledGame()` exists (fix its status value per P0-3) and is never called from any screen. Wire the header "+" and empty-state "HOST A RUN" buttons in `schedule.tsx`, and the "BE THE FIRST TO HOST" card in `court/[id].tsx`, to a new create-run form (title, court, date/time, max players, note) → `createScheduledGame()` → `refreshRuns()`.
- **P1-2 — Profile editing screen.** No way to set `display_name`/`username` after signup — new users show as "Player" everywhere. New screen + `updateDisplayName()` service function, matching the existing username CHECK constraint (`^[A-Za-z0-9_]{3,32}$`).
- **P1-3 — Wire the 4 dead Settings toggles.** Push notifications, location sharing, haptics, dark mode are local `useState` only. `push_notifications_enabled`/`check_in_reminders_enabled`/`game_alerts_enabled` exist on `profiles` and are never read/written by Settings. Location sharing and dark mode have no column — decide if they need one or stay local-only (dark mode probably should stay a device setting).
- **P1-4 — ✅ DONE 2026-07-13 — Add real head-to-head query.** Replace `Math.random()` in `player/[id].tsx` with a real query: get `game_ids` where both the current user and the opponent are in `game_participants`, intersect, fetch those games. Small, contained fix.
- **P1-5 — Real delete-account flow.** Needs a new `SECURITY DEFINER` RPC (`delete_own_account()` calling `DELETE FROM auth.users WHERE id = auth.uid()`) since the client can't call `auth.admin.deleteUser()` directly. Required for App Store review.
- **P1-6 — Friend request pending flow.** Schema already supports `pending`/`accepted`/`blocked`; `addFriend()` currently inserts `'accepted'` directly, skipping the request step entirely. Needs a "requests" view and accept/decline actions.

### P2 — important UX gaps

- **P2-1 — Push notification registration.** `expo-notifications` isn't installed. Needs a `push_tokens` table (doesn't exist yet — this one genuinely needs to be built), registration on sign-in, and a toggle-off path that deletes the token.
- **P2-2 — RevenueCat / real IAP.** When this gets built: **write to `subscriptions`, never to `profiles.is_pro` directly** — the trigger handles that derivation (see §3).
- **P2-3 — Check-in note UI.** The field exists end-to-end in the database and now in `switch_active_checkin` (P0-4) — just needs a text input in the check-in UI.
- **P2-4 — Avatar / court image upload.** Both columns exist (`profiles.avatar_url`, `courts.image_url`); no photo picker or Storage integration anywhere.
- **P2-5 — Regional leaderboard.** `fetchLeaderboard`'s `"REGIONAL"` scope has no geographic filter and just returns global results. Either implement a real region concept or remove the option from the UI until it's real.

### P3 — process / polish

- **P3-1 — STARTED — first migration (`auto_checkout_stale_checkins`) applied via Supabase MCP with an in-repo copy in `docs/supabase/migrations/`; baseline snapshot still to be committed as migration 0. Commit the missing migration history.** Nothing about the schema, triggers, or RPCs is version-controlled. Start with `LocalCheck_Supabase_Baseline_Snapshot.sql` (produced this session) as the initial baseline, then use `Supabase:apply_migration` (not raw SQL editor) for every change going forward so history accumulates.
- **P3-2 — Isolate the legacy Drizzle schema** (`lib/db/src/schema/courts.ts`) if it's still present — it diverged completely from the live Supabase schema per the earlier audit and risks misleading anyone who opens it.
- **P3-3 — Security advisory pass** before App Store submission: review the 3 `SECURITY DEFINER` views, enable leaked-password protection, review `anon`-readable tables.

---

## 5. Cross-cutting risks (carried forward, still open)

- **No schema version control** (§3, P3-1) — the two RPC functions and three triggers that make the app function exist only live in the dashboard.
- **Credentials in plaintext docs** — flagged in an earlier session, re-appeared again in a pasted onboarding doc this session (OpenAI key, session secret, DB password, Mapbox token). Rotate and gitignore properly; stop pasting the doc that contains them.
- **Repo fragmentation** — three LocalCheck codebases exist across `agenticjess-star` and `jGPT-Automated`. This doc treats `jGPT-Automated/LocalCheck_Expo` `main` as canonical per your direction this session; the others aren't tracked here.

---

## 6. Executing this with Claude Code

Research done this session (Anthropic's official Claude Code docs + current best-practice writeups, mid-2026). What actually matters for this task list:

**Give it a CLAUDE.md.** Drop a short one at the repo root pointing at this file and the SQL snapshot:
```markdown
# LocalCheck — Claude Code memory

Source of truth: LocalCheck_SOURCE_OF_TRUTH.md (read it first, every session)
DB baseline: LocalCheck_Supabase_Baseline_Snapshot.sql
Supabase project: jzclwnzcektqhgkkdeje

Rules for this repo:
- Never write to profiles.is_pro directly — it's derived by a DB trigger
  from `subscriptions`. Write to `subscriptions` instead.
- Prefer calling existing RPCs (log_game, switch_active_checkin) over
  raw table inserts for games/check-ins.
- This codebase has a pattern of `catch { /* Best-effort */ }` that
  silently swallows Supabase errors. When fixing a task, temporarily
  log the actual error and confirm success against the live database
  (via the Supabase MCP or a SQL query) before claiming a fix works —
  don't trust the absence of a thrown error.
```

**Work the P0 list in Plan Mode first, one task at a time — don't batch them.** Each P0 task is small and self-contained, but they touch the two flows (game logging, run scheduling) that everything else in P1 depends on being trustworthy. Plan Mode's value here isn't scale, it's that this codebase's silent-failure pattern means a plausible-looking fix can still be wrong — worth the extra gate.

**Verification is the actual hard part here, not the code change.** Because errors are swallowed throughout this codebase, "no error thrown" is not evidence a fix works. After each P0 fix, either have Claude Code query the live table directly (it has the Supabase MCP tools this session used) to confirm a row was actually written with the right values, or run it through the app and check. Don't accept "should work now" as a stopping point — that's exactly the gap that let P0-1 through P0-4 ship broken in the first place.

**P1 items are good candidates for one-task-per-subagent** once P0 is solid — they're independent of each other (profile editing, settings toggles, H2H query, delete account, friend requests all touch different files). Give each subagent the specific file paths and the task block above verbatim; don't make it re-derive scope from this doc.

**Suggested kickoff prompt for a fresh Claude Code session:**
```
Read LocalCheck_SOURCE_OF_TRUTH.md and LocalCheck_Supabase_Baseline_Snapshot.sql
in full. Then start on P0-1 in Plan Mode. Show me the plan before editing
anything. After implementing, verify the fix against the live Supabase
project (project_id jzclwnzcektqhgkkdeje) by querying the actual table —
don't tell me it's fixed until you've confirmed a real row with correct
values exists.
```
