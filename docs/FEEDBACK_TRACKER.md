# Feedback & polish tracker

Status: Living tracker. **This is the source of truth for what Jesse has
flagged, whether it's been handled, and which commit/branch/PR it landed in.**
Any agent picking up UI/polish work on this repo should read this file first
and update it as part of the same change — not as an afterthought.

This is a deliberate, requested exception to the "no activity ledgers" rule in
`docs/product/README.md`. It has one job and does not duplicate the other
docs:

- `docs/product/DECISIONS.md` — finalized design decisions and their
  reasoning, written once a decision is settled.
- `docs/CURRENT_STATE.md` — shipped engineering/runtime state (what's live in
  production right now).
- **This file** — Jesse's raw feedback items, whether each is done/in
  progress/backlog, and the exact commit(s) implementing it. Task tracking,
  not rationale or runtime truth.

Keep entries terse. When an item ships, mark it ✅ and record the commit SHA —
don't delete the row; the history of what was asked and when it landed is the
point.

## Branch / PR status

- **PRs #42, #44, and [#45](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/45)
  are merged to `main`.** `origin/main` @ `f5f5b81` (PR #45 squash, 2026-09-08).
  #45 = camera lifecycle, unified `profiles.visibility` privacy + FRIENDS
  leaderboard, `profiles.account_tag`, one shared `SearchField`, launch polish.
  The merge triggered EAS production **build 22**.
- **All LocalCheckProd migrations applied; none pending:** referral/cooldown
  plumbing, `account_tags` (`docs/runbooks/ACCOUNT_TAGS.md`), `profile_visibility`.
- **Release loop:** opening a PR against `main` auto-publishes a scannable Expo
  Go preview; merging to `main` auto-triggers the TestFlight build. No manual
  EAS step. See `docs/RELEASE.md`.
- No feature branch open right now. Branch the next task from `origin/main`.

## Status legend

✅ done — committed on the branch · 🚧 in progress · ⬜ backlog, not started

## 2026-09-08 — account tags, not deletion

Jesse: don't delete the 44 dev accounts (a mass delete would cascade-kill 22 of
the 52 games on the kept accounts). Use one tag to differentiate them, shown on
the leaderboard, changeable in "one clear repeatable database action" from "a
single file" — no future agent should have to explore the codebase to do it.

| Item | Status |
|------|--------|
| `profiles.account_tag` — single tag: `FOUNDER` / `STARTER` / `REVIEWER` / `TEST` / null; replaces `is_test` + `is_founding_member` | ✅ migration `20260907120000`, applied to prod |
| Jesse's account → `FOUNDER`, username/display → `JESSE` | ✅ (id `8ea0f430…`) |
| Apple review account `APPLE` (apple@test.com) → `REVIEWER`, Apple-mark avatar | ✅ tagged (id `069a0d4c…`); Jesse created the login, Claude cannot |
| Other 43 dev accounts → `TEST` | ✅ backfilled |
| First 100 real post-launch sign-ups → `STARTER` (1 free LocalPlus year each) | ⬜ launch-day SQL in the runbook |
| `docs/runbooks/ACCOUNT_TAGS.md` — the whole procedure + blast radius + copy-paste SQL | ✅ new |
| `AGENTS.md` — "Repeatable operations" section + per-turn "link the files + Supabase project" rule | ✅ |
| Future: multi-tag accolades (tournament wins, profile-square graphics) | ⬜ out of scope; separate `badges[]` later |

**Correction (2026-09-08, later):** the tag was over-built — it was hiding
`TEST`/`REVIEWER` from every board and driving `useLocalPlus()`, which made the
board empty for tagged viewers and let a STARTER's free year never lapse.
Jesse: the tag is **cosmetic**. Now:

| Item | Status |
|------|--------|
| Tag no longer hides accounts by itself — behind flag `LeaderboardFlags.hideTaggedAccounts`, **off** now (all accounts visible, LA + Houston), **on** at launch | ✅ |
| `useLocalPlus()` no longer reads `account_tag` — free year comes from a promo `subscriptions` row (with an expiry) | ✅ |
| Rank requires ≥1 game in the sport (`hasRankedGame`) — a 1200 default isn't a rank | ✅ |
| `$4.99/mo` monthly-only pricing recorded in `docs/product/DECISIONS.md` | ✅ |
| PR #46 Codex review (5 findings: stale merged-branch status, visibility-migration status, STARTER expiry, auth-validation wording, pricing in wrong doc) | ✅ addressed |
| Auth screen: rejects empty + 6-char min, but no email-format / password-strength / leaked-password check | ⬜ pre-submit |

## 2026-09-06 (polish round 4) — game card + score review, live markup

Fast Expo Go iteration on the score card and the FINAL SCORE / Inbox
flow. Landing state after this round:

- ✅ **Score card** (`ScoreCard`): two centred side-by-side columns, name
  first, **no avatars** (they threw off the balance — Jesse's call after
  trying them). 1v1 side = name → ELO move → score; team side = team label
  → score → a name/ELO row per member. Caption leads with court short slug
  · format (1V1/2V2) · date. Winner's name + score in accent; **WIN badge**
  on the winning column (confirmed only) — Jesse: "clean". Player names
  link to `/player/[id]`. No inner box — columns sit on the card.
- ✅ **Status** is a thin top banner, not a pill. On the full FINAL SCORE
  screen the banner + review timer + explainer are lifted above the card
  (screen furniture); the Inbox keeps the banner on the card.
- ✅ **Inbox card** (`compact`): one tight line per side (name · score), so
  several games fit — was too tall to see more than one.
- ✅ **viewerStatusLabel**: whoever last submitted the score has implicitly
  approved it → they never see "YOUR APPROVAL" (they see who they're
  waiting on / "CONFIRMING…"). Fixes a game logged here + approved by the
  other account still showing "your approval" with no approve button.
- ✅ **Inbox freshness**: `elo.tsx` refetches open matches on focus, so a
  game the opponent approved elsewhere leaves the inbox.
- ✅ **After approving a 1v1** (`match/[id]`): it confirms + moves ELO, then
  routes to the profile tab. The profile ELO (`EloStat`/`ProfileHero` new
  `animate` flag, wired only at the own-profile call site) rolls its digits
  when it changes.
- ✅ **Me tab went stale after a confirm on the other device** (`c4e1aad`):
  Jesse logged 28-2 on Expo Go (8YP), Jesse-on-TestFlight approved it. Court
  feed + notifications + FINAL SCORE screen all updated on 8YP's phone; the
  Me tab kept ELO 1154 / 3 wins and never showed the new game. Cause: the
  per-user realtime broadcast for that match/profile change doesn't reliably
  land on this device's user topic. Fix is client-side: the Me tab's focus
  effect now re-pulls profile + matches + activity + open matches every time
  it's focused (`elo.tsx`), and a match batch on the user topic also kicks a
  profile + feed refresh (`AppContext.tsx`). ⬜ The underlying broadcast gap
  is a backend fix, still open.
- ✅ **BrandCheck** (`components/brand/LogoMark.tsx`): the LocalCheck frame
  fades in and the check springs up inside it — on-brand success mark.
  Used on the SCORE SENT screen below the card. Jesse: "i love the
  checkmark". ⬜ NEXT: roll it out to other Feather check / success spots
  for brand consistency (Jesse asked for this broadly).
- ✅ Compete header: `#rank` readout is a right-aligned stack (big number,
  small privacy line under it), not an inline row.
- ✅ schedule.tsx time-window chevron given real spacing off the time axis.
- ✅ Home "N arrivals in the last hour" no longer overlaps the section rule.
- ✅ Log Game review / SCORE SENT: title, check and actions centred; real
  safe-area inset so CONFIRM clears the tab bar.

### Account deletion + App Store metadata (2026-09-06, per Jesse)
- ✅ Account deletion is **done**, no longer a release blocker — the in-app
  DELETE ACCOUNT flow + `delete-account` Edge Function revoke the Apple
  token and remove the user. Cleared the "needs verification" line in
  `CURRENT_STATE.md`, `ROADMAP.md`, `RELEASE.md`.
- Support email **localchecksports@gmail.com**; privacy / terms / support
  pages at **localchecksports.com** (`/privacy`, `/terms`, `/support`),
  already linked from Settings → Legal & Support. Still to do (outside the
  repo): enter these URLs in App Store Connect, and make sure the pages are
  live. The Apple **privacy manifest** (`app.json` → `ios.privacyManifests`)
  is already filled in.

### ⬜ Still open / next
- Roll BrandCheck out to the remaining success/checkmark icons.
- Inbox vs. notifications badge-count reconciliation + the all/games filter
  (from round 3) — still a product call.
- The Starter/tier system (round 2).
- **Backend:** the per-user realtime broadcast (`user:<id>` topic) doesn't
  reliably fire on `profiles` / `matches` changes when a match is confirmed
  from the *other* participant's device. The Me-tab focus refetch (`c4e1aad`)
  masks it there; other own-data surfaces could still lag until the broadcast
  is fixed at the source.
- ME-tab notifications: sticky search bar under the tabs (reuse Explore's
  search component) + a games/all filter dropdown — from round 4, deferred
  with the inbox-vs-notifications product call.

## 2026-09-05 (polish round 3) — Expo Go pass, live element markup

Jesse tested on Expo Go and marked up live elements. First finding: the
`expo start --web` preview he still had open was **stale** (dev server was
stopped after the round-2 commits) — it showed the pre-round-2 SET LOCAL
chip, old RunCard, old drawer. Expo Go had the current build. Lesson for
next time: don't stop the web server between commits if he's mid-review.

### Score card / FINAL SCORE screen ✅ DONE (`6b38222`)
- ✅ Score number was riding the top of its row (the ELO line stacked above
  it) — it's vertically centred on the player name now, ELO under the name.
- ✅ ELO no longer gets a thousands separator ("1154", was "1,154" / "1
  220") — `NumberFlow format={{ useGrouping: false }}`.
- ✅ Dropped the "YOU / OPPONENT" sub-label (it read as loud as the name).
  The accent ring on the viewer's avatar carries it.
- ✅ Status is a thin full-width banner across the card's top edge, not a
  pill.
- ✅ "lots of empty space… status/timer are non-game-card elements": on the
  full FINAL SCORE screen the status banner + review timer + policy
  explainer are lifted to screen furniture above the card
  (`MatchReviewCard` non-compact); the card is just the game. The Inbox
  (compact) keeps the banner on the card.

### Schedule panel ✅ DONE (`dc5aeb0`)
- ✅ "put the box on the bottom of the screen, more room for the grid" —
  `CourtSchedulePanel` is a flex column: the grid fills the space above the
  slot card and scrolls its own rows, so the card sits flush at the bottom
  (tab-bar clearance on Home, safe-area inset on court/[id]). No dead space,
  no clipping. Verified on Home in the web build.

### Explore / court page ✅ DONE (`dc5aeb0`)
- ✅ court/[id] metric "ACTIVE NOW" → "ACTIVE".
- ✅ Removed the "HERE" check-in pill from the Explore court card.
- Note: the live-dot-pushes-text and drawer court-name / "LIVE"-collision
  Jesse flagged were the **stale web preview** — current code already has
  absolute-positioned live dots (`StatBlock`, `CourtListItem`) and the
  drawer already uses the short slug with `numberOfLines={1}` and no LIVE
  pill (that pill was dropped back in `3c81d71`). Re-confirm on Expo Go.

### ⬜ Inbox vs. notifications — needs a product call
Jesse: ME tab shows a "4" badge but ME→INBOX says "you're all caught up",
while Settings→Notifications shows "6 NEW". Not a straightforward bug:
- The **INBOX tab** deliberately shows only *actionable* items — games to
  review (`fetchOpenMatchesForPlayer`, status pending/held/rejected),
  incoming friend requests, and run invites.
- Settings→**Notifications** shows everything, including informational and
  now-stale rows ("SCORE APPROVED", "MATCH CONFIRMED", and "CONFIRM FINAL
  SCORE" rows for matches that are already confirmed and so no longer in
  the inbox).
- The ME-tab **badge** counts unread notifications, a different set than
  the inbox count — hence "4 vs 6 vs empty inbox".
Jesse floated an all / games filter toggle on the inbox but said "idk".
Options to decide:
1. Make the badge match the inbox count exactly (badge = actionable only).
2. Auto-mark "CONFIRM FINAL SCORE" read when its match confirms, so stale
   rows stop inflating the notifications count.
3. Add the all / games (/ friends) filter Jesse mentioned and let "all"
   surface informational notifications inside the inbox too.
Recommend 1 + 2 first (kills the confusion), then 3 if he still wants it.

## 2026-09-05 (polish round 2) — 8 screenshots + a detailed Log Game brief

Jesse pushed back hard: things kept getting pushed out of view / overlapping
because changes weren't visually verified before claiming done. **This round
was verified screen-by-screen in the `react-native-web` build (`expo start
--web`, 375×812) before committing** — that's the fix for "I don't like
doing them twice." No iOS Simulator runtime on this machine, so web is the
verification surface; RN Web renders the same flat container/overflow bugs.

### Log Game form — full rework ✅ DONE (`0aeea24`)
Jesse's brief: log-after-the-fact flow (see who's checked in → pick them →
court/sport/date prefilled → enter score → confirm), or scan a QR. Wants it
to fit the screen with the LOG GAME button in view, no scroll.
- ✅ Matchup is two columns (YOUR SIDE | OTHER SIDE); each grows a row on
  ADD PLAYER. Verified LOG GAME stays in view at 1v1 and 2v2.
- ✅ The player picker opens as a full-width panel below the columns.
- ✅ DATE reads oldest-left → TODAY-right, scrolls to TODAY, capped at 7
  days, no future date ("logging is after it happened").
- ✅ Keyboard dismisses on submit / pick / date (number-pad has no Done).
- ✅ COURT shows the short slug everywhere it was clipping (`…Sports
  Complex` → `Rancho Cienega`) — CourtPickerField, ScoreCard context,
  MatchReview (gameService now selects `short_name`), run/[id] LOCATION.
- ✅ Clear gap between the FINAL SCORE label and the per-player labels.

### Score review card ✅ DONE (`0aeea24`)
Jesse: "you just made the box larger… still focus on the court name…
buttons pushed out of view." Fixed:
- ScoreCard with participant identities is a compact box score: one row per
  side (avatars + name + YOU/OPPONENT role + score, ELO animating on
  confirm). Court is a one-line caption, not a title.
- Killed the "YOU / YOU" doubling (real name + role label).
- REVIEW SCORE screen pads for the tab bar; EDIT / CONFIRM verified in view.

### Scheduled game ✅ DONE (`3050e9e`)
- ✅ "There should be an option for the creator to delete a game" — creator
  gets CANCEL GAME (two-tap confirm) via the existing `public.cancel_run`
  RPC. (Jesse hit this: made a game to test leaving, couldn't leave as
  creator, had to use the TestFlight account.)
- ✅ "Move the CREATOR label, it takes space from the name" — the text pill
  is gone; creator is a full-width "CREATED BY <name>" line under WHEN /
  LOCATION + a small award glyph before their name in the roster.

### Home schedule panel ✅ DONE (`b1e0378`)
- ✅ "Change this icon back to the dot" — in-cell game marker is a small
  accent dot, not a calendar chip.
- ✅ "Make the bottom box lower, give more area to the grid" + "lots of
  empty space at the bottom" — card tightened, grid taller, panel scrolls
  with tab-bar-clearance padding instead of a fixed dead gap.

### Court page + Compete header ✅ DONE (`b1f568f`)
- ✅ Court header SET LOCAL / LOCAL is a favourite-style star pill (filled
  accent star when it's your local), replacing the boxy check-circle chip.
- ✅ Compete header `#9` is a single line aligned with "COMPETE".
- ✅ The viewer's own hidden leaderboard row matches other rows' structure
  and shows its privacy state ("HIDDEN — LOCALPLUS" / "HIDDEN — PRIVATE")
  where others show a tier, instead of a bare "BRONZE".

### ⬜ NEXT ROUND / needs a product decision
- **Tier + "Starter" system** (from the leaderboard screenshot): first 100
  users get a "Starter" status with a distinct profile box and a free year
  of the paid tier; the per-row badge should reflect privacy × paid state
  (public+unpaid = hidden; friends-only+paid = a look; private+paid =
  "private"). This is a real data-model + entitlements feature, not polish —
  parked for a dedicated pass.
- The friends-counter animate-on-own-action ask (no counter exists yet).
- Copy the notification-type inventory into this file.

## 2026-09-05 (polish round — pre-merge) — 7 annotated Expo Go screenshots

Jesse's framing: "this looks really good. we're almost there." Light polish on
Schedule + Home, a cooler game card, and a couple of real functional gaps.
He merges to `main` after this round. Screenshots 1–7 map to the items below.

### Home feed (screenshot 1)
- ✅ DONE (`fb2587f`): first activity row's timeline dot sat ~2px above the
  row's text center — the first/last rail segments weren't symmetric with the
  middle rows. `ActivityRow` rail rebuilt so top and bottom segments are
  always the same box (only the line colour is hidden on the cap), so every
  dot lands on the row centre.
- ✅ DONE (`fb2587f`): "too much space in the checked-in section" — the
  Home roster strip (`peopleSection` / `roster`) tightened (shorter min
  heights, less vertical padding).
- ✅ DONE (`fb2587f`): "text overlaps" — the person-tile name label under
  the checked-in avatars could ride into the section divider; constrained.

### Home → SCHEDULE tab (screenshot 2) — `CourtSchedulePanel`
- ✅ DONE (`fb2587f`): bottom "SAT 5 · 7 PM" slot card was clipped by the
  tab bar — the Home schedule tab now reserves tab-bar clearance so the card
  is fully visible.
- ✅ DONE (`fb2587f`): dead vertical space between the day-header row and
  the first time row removed (the standalone scroll-cue row is gone; the
  hint moved to the top of the time axis, not its own full-width row).

### Scheduled game detail (screenshot 3) — `app/run/[id].tsx`
- ✅ DONE (`06f2450`): "I can't leave a game once I join or switch sides."
  Added `LEAVE GAME` (non-host, before start) via the existing
  `public.leave_run` RPC — new `leaveScheduledGame` service fn + `leaveRun`
  in `AppContext`, no migration, stays OTA-eligible. For `choose_teams`
  games a joined player also gets `SWITCH SIDE` (re-calls
  `join_scheduled_game` with the other side — the RPC already upserts
  `team_side`). Host still can't leave (must cancel) — that's the RPC rule.

### Full Schedule page (screenshots 4, 5, 6) — `app/(tabs)/schedule.tsx`
- ✅ DONE (`0219ab9`, screenshot 4): the selected time cell only had
  `REMOVE MY TIME`; added an `ADD MY TIME` affordance on the selected-slot
  card so a single cell is easy to opt into without entering bulk-edit. The
  FAB (bulk add times / schedule a game) is unchanged, as asked.
- ✅ DONE (`0219ab9`, screenshot 5): the "N SELECTED — TAP TO ADD OR
  REMOVE" line moved out of the top instruction row into a summary block
  below the grid that lists the actual selected times (not just a count),
  above CANCEL / SAVE CHANGES.
- ✅ DONE (`0219ab9`, screenshot 6): `RunCard` re-weighted — game format
  (2V2 / 4V4) is the headline, court name drops to `courtShortName` (the
  short slug) as sub-text since the page is already court-scoped; created-by,
  spots-open and the going-avatars stay.

### Game card + score-review flow (screenshot 7 mockup)
"could have a cooler ui"; "if we show the players box we can animate the elo
there, more prominent / visual"; "clearer court state, and who's it pending".
Reference is Jesse's own "PLAYER-FIRST GAME CARD STATES" mockup (6 states +
voided). Split so the merge isn't blocked on the whole redesign:
- 🚧 IN PROGRESS (`9ed0718`): `ScoreCard` gains a player box — avatars +
  `YOU` / `OPPONENT` role labels + `VS`, player-first per the mockup — and
  the ELO before→after animation moves into that box (prominent, not a small
  line under the score). Status line becomes viewer-aware:
  "YOUR APPROVAL NEEDED" / "WAITING ON <NAME>" / "FINAL" / "VOIDED" instead
  of one static "IN REVIEW".
- ⬜ NEXT ROUND: the rest of the mockup polish — the "Score visible" toggle,
  the trophy winner banner, the per-state action-button sets (Approve /
  Dispute / Request Void / Final Approve / View Details), the inline
  correction thread, and the "auto-approves in 2d 23h" countdown chip
  styling. These are screen-level (`elo.tsx` inbox, `match/[id].tsx`,
  `compete.tsx` review step) and already partly wired; folding them into the
  card's new shape is the next pass.

## 2026-09-04 (second wave) — tested PR #42 in Expo Go, two accounts

Jesse's own priority call: **the score-review/approval flow is the biggest
remaining item** — "this part needs to be gamified and addicting... people
should love checking in, adding times, logging games, because they see their
stats go up." Everything else here is real but secondary to that.

### Priority 0 — Match-approval delight loop 🚧 IN PROGRESS
Jesse sent a game for review, approved it from the other account, and got
**nothing**: no visible ELO change, no feed entry, no notification, no sense
it was even approved — "I didn't even know it was approved."

**Investigated at the DB level (not guessed):** `apply_match_elo` already
updates ELO/wins/losses correctly and inserts the feed activity event;
`notify_match_change` already fires a notification + push on confirm.
Checked `push_delivery_attempts` for real confirmed-match notifications
since 2026-09-03 — every one shows `ticket_status: accepted`,
`receipt_status: ok`. The pipeline was never broken. Every one of those
notifications also shows `read_at: null` — never opened, not once — because
the text was the same generic line every time: "SCORE APPROVED / The result
is final and ratings are updated." No name, no score, no ELO number, no
reason to tap in.

- ✅ DONE (`90c0c3a`, corrected tone in `f20b8ce`): personalized
  `notify_match_change`'s 1v1-confirm notification. Title is always
  "MATCH CONFIRMED" (deterministic regardless of outcome); body states the
  fact plainly — "You beat 8yp4gttjwv, 11–0. ELO now 1200 (+18)." Sends to
  BOTH participants now (was submitter-only). **Correction from Jesse:**
  first version read "YOU WON! Beat X 11-0 · ELO 1200 (+18)" — exclamatory,
  wrong tone. Fixed to be "purely and professionally deterministic," per his
  direct instruction — same personalization, plain sentence, no hype.
- ✅ DONE (`90b34a3`): **"gamified" clarified by Jesse — it means animate
  the ELO number when it changes, not hype copy.** Installed
  `number-flow-react-native` (pure JS, built on the already-installed
  `react-native-reanimated`, no native module, stays OTA-eligible) and
  wired it into `EloStat` — the one shared ELO component (leaderboard rows,
  profile hero, match rows). Every digit now rolls to its new value instead
  of jump-cutting. Verified in the library's own source that first render
  is static (no counting up from zero on screen load).
- ⬜ STILL OPEN: scheduled/team match confirmations
  (`apply_scheduled_match_elo` / `apply_ad_hoc_team_elo`) still send **no**
  confirmation notification at all — only the ad-hoc 1v1 path was fixed.
- ⬜ STILL OPEN: full inventory of every notification title/body currently
  in the system was compiled and given to Jesse directly in chat (not yet
  copied into this file) — worth doing if another tone pass is needed.
- ⬜ STILL OPEN: Jesse's "friends counter, the check-in metric... matters"
  note (same "animate on your own profile after your own action" rule as
  ELO) has no counterpart feature yet — there's no visible friends-count
  number anywhere in the app today (only a bare tab label), so this needs
  either a small new feature (a friends-count metric on `ProfileStats`) or
  an explicit call that it's deferred, before it can animate.
- **Correction from Jesse, then fixed:** the first cut wired NumberFlow into
  `EloStat` itself — wrong, because `EloStat` is one of several *different*
  ELO renderings across the app (see the new 2026-09-05 section below) and
  making the shared component animate would make ELO look like an ambient
  live number everywhere it appears (leaderboard, other players' rows,
  roster carousels), which Jesse explicitly does not want. Reverted
  (`4fb30f1`), then correctly scoped in `654cb90`: `ScoreCard` animates
  each 1v1 side's ELO before → after **only when status is "confirmed"**
  (the moment you open a just-approved match), and `ProfileStats` gained an
  `animateChanges` prop wired **only** at the Me tab's own-stats call site —
  `player/[id].tsx`'s peer-profile call site is untouched. Team-side ELO
  (>1 player per side) intentionally shows no animation — no single
  before/after pair to show honestly.

## 2026-09-05 — activity feed inconsistency + ELO display fragmentation

Jesse's report: the Me tab's own ACTIVITY tab doesn't show game activity,
only check-ins/check-outs — "we need to reimagine that." Also: ELO is
rendered with "many different styles" across the app, not the "one shared
EloStat" DESIGN.md claims.

- ✅ DONE (`9a61e14`): **real bug, verified by reading the query, not
  guessed** — the Me tab's activity reused `fetchFeed(localCourt?.id, ...)`,
  which is scoped to your *local court*. A game played at any other court
  never appeared in your own activity. There was already a fallback to a
  match-history list when that court-scoped feed came back empty, but
  check-in/check-out events at your local court kept the fallback from
  firing, so only checkins/checkouts ever showed — exactly what was
  reported. A second bug in the same spot: a `match_result` event's
  `actor_id` is the *winner* (1v1) or *creator* (team/scheduled) — never
  the losing/non-creating participant — so even a plain `actor_id` filter
  would still hide your own losses. New `fetchPlayerActivity(userId)` in
  `services/feedService.ts` fixes both: matches on participation, not court
  or raw actor_id. Wired into the Me tab; the two-tier fallback is gone
  (the fetch is correct up front, so it's unnecessary).
- ✅ VERIFIED (not guessed): grepped every ELO render site. `EloStat` is
  used in `compete.tsx` (leaderboard), `PlayerSummaryRow`, and
  `ProfileHero`'s non-compact variant. But `feed.tsx`, `elo.tsx`'s friend
  rows, `settings.tsx`, `run/[id].tsx` (×3 spots), `CourtSheetContent`'s
  WHO'S HERE carousel, and `ProfileHero`'s *own* "compact" variant all
  hand-roll their own `<Text>{elo} ELO</Text>` with different styling —
  confirming Jesse's report exactly. Not yet unified — flagged here, not
  fixed, since a real redesign decision (what should the one look be)
  should happen with his input, not be invented silently after several
  correction rounds today.
- ✅ DONE — activity feed redesign, built from Jesse's own full written spec
  (two-tier presence/event weight, no green/red on names, collapsed visits,
  simplified rail, grouped arrival bursts, floating game-result card). Five
  commits, in dependency order:
  - `6c9e863` — presentation layer. `FeedItem` gained `occurredAtIso` (raw
    ISO instant) and two UI-only synthetic types: `"visit"` (a paired
    checkin+checkout collapsed into one entry with a duration) and
    `"checkin_burst"` (3+ arrivals within a ~15-minute window collapsed into
    one expandable row). New `lib/activityPresentation.ts` holds the pure
    transforms (`pairVisits`, `groupCheckinBursts`, plus duration/relative-day
    formatters) with `lib/activityPresentation.test.mts` (10 cases: matching
    pairs, unmatched checkins, games never blocking pairing, the 3+ grouping
    threshold, gap/type breaks in a run). Built as pure + unit-tested first
    specifically to de-risk the rest of the batch after two correction
    rounds earlier in the week.
  - `32b372c` — `components/ui/ActivityRow.tsx` rewritten as a dispatcher on
    `item.type`. Game rows get their own header ("GAME · FINAL" + time) and
    two name+score lines with a text "WIN" tag and accent-colored winner
    score — **no color on the player name itself**, exactly per spec (result
    semantics live on the score/tag, not the identity text). Visit rows show
    court + duration + relative day. Burst rows show a count that expands to
    the name list on tap. New dot styles (`gameNode` filled, `visitNode`
    hollow/larger) keep the vertical rail but simplify what each dot means.
  - `6b53f32` — wired into both profiles. Me tab (`elo.tsx`) and the
    other-player profile (`player/[id].tsx`) both now run their activity
    through `pairVisits` before rendering, so raw checkin/checkout pairs
    collapse into one "VISIT" entry instead of two rows. `player/[id].tsx`
    also dropped its separate `fetchGamesByPlayer`/`playerMatches` path
    entirely — one activity fetch now serves both the ACTIVITY tab list and
    (via `ProfileMatchRow`'s new `opponentName` prop) the VS YOU tab, so a
    head-to-head row leads with `VS <NAME>` instead of court name.
  - `be5597a` — court-level feeds. `HomeScreen.tsx` and `court/[id].tsx` both
    run `courtFeed` through `groupCheckinBursts` before rendering. Home also
    gained the persistent summary caption under "Court activity" ("N
    arrivals in the last hour") — the always-visible court-activity header
    from the spec. `court/[id]` skipped its own summary line since that page
    already has `MetricDashboard` doing that job.
  - `9537e1e` — `GameResultModal` (the FINAL SCORE bottom sheet) converted
    from an edge-to-edge sheet to a detached floating card: 16px side
    margins, 26px radius on all four corners, 60% max height, and "VIEW
    GAME →" (routes to `/match/[id]`) replacing the old full-width DONE
    button.
  - Not covered by this batch, flagged for a follow-up: `CourtSheetContent`
    (the Explore court-preview drawer) has no activity-feed section at all
    today (only WHO'S HERE/LOCALS/PULLING UP TODAY/NEXT RUN), so the
    grouping/summary treatment above was never applicable there — confirm
    with Jesse whether that drawer should grow one before treating this as
    fully closed.

### Priority 1 — ScoreCard/Inbox redesign ⬜ BACKLOG
From the annotated Inbox screenshot (yellow "In Review" pill circled):
- Card is too tall for a list of several — "will look bad when there are
  multiple games to review or in progress."
- Replace the corner status pill with a thin full-width bar at the card's
  top edge: yellow background, black text, says "PENDING" (or similar,
  viewer-aware — see next point).
- **Status copy should be relative to the viewer**, not a generic raw-status
  label: distinguish "action required by you" from "pending the other
  player" instead of one static "IN REVIEW" for everyone.
- **Invert the card's hierarchy**: player names should be the primary/large
  text; court + date drop to secondary/sub text (today `ScoreCard` does the
  opposite — court name is the title, players are in the scoreboard row).
- Player names should be tappable → routes to that player's profile.
- The "GAMES" section label above the Inbox cards may be unnecessary chrome
  — re-check once the card itself is redesigned.
This directly affects `components/match/ScoreCard.tsx` (shared everywhere a
game shows — Log Game confirm, Inbox, FINAL SCORE screen), so the redesign
propagates automatically once done in one place.

### Priority 2 — Court page (Feed tab + SET LOCAL) ⬜ BACKLOG
- `SET LOCAL` button (court detail header) needs a real icon instead of/along
  with the text — "a court with a star, signaling Favorite / Local Court" —
  more intuitive than a plain text button.
- Feed tab: the first activity row's text is misaligned with its timeline
  dot.
- Game-result entries in the feed ("X beat Y, 11–5") are plain sentences
  that "break the clean view" next to check-in/check-out rows — Jesse wants
  them as a distinct "thin, long game card box," not sentence-style text.
  Related to the typed note "Unified Activity Feed — consolidated view" —
  the events are already in one feed; the visual treatment isn't unified.

### Priority 3 — Profile header (Me tab) + username ⬜ BACKLOG
- `ProfileHero` alignment: avatar box, name, and ELO aren't vertically
  aligned with each other ("align the name and number with the box").
- Header layout in general needs cleanup — "reduce clutter from long
  tags/handles."
- Reposition ELO so it doesn't sit awkwardly inline with tags/username.
- **New feature, not just polish**: usernames today are raw-looking
  auto-generated strings (e.g. `8YP4GTTJWV`) with no friendly default and no
  way to change them. Auto-generate a nicer default slug at signup, and add
  a username field to Settings so a player can edit it.

### Also noted (typed list, folded into the above where they overlap)
- Matchup copy should show both real player names, not "You vs. X" style
  pronoun copy, for consistent, scannable, clickable cards — same fix as
  Priority 1's "player names first" + "tappable" points.

## 2026-09-04 — 10 annotated TestFlight screenshots

Jesse's framing: "this is a lot, anxious even going through it, take your
time & take it at a logical order." Agreed order below; each area is its own
small set of commits, reported back before moving on.

### Area 1 — Log Game form ✅ DONE
| Note (paraphrased) | Commit |
|---|---|
| Sport dropdown text not centered in a sized box; make it tap-to-toggle everywhere | `f175282` |
| Court dropdown "very bad design"; default to local court, tap shows 3 nearest for the sport + typeahead | `f175282` |
| Date picker "the worst thing I've ever seen"; scope to the last 7 days | `69b7b61` |
| Format selector (1v1/2v2/3v3/5v5) is redundant with picking players | `69b7b61` |
| Show two sides, creator prefilled left, right side empty; support adding a row for more players | `69b7b61` |
| (5-second countdown that auto-sent the score without explicit confirm) | `d74f62a` |

### Area 2 — Score review parity ✅ DONE
| Note | Commit |
|---|---|
| Status visual on the FINAL SCORE screen differs from Log Game's; should be the same, and better than both | `34aef56` |
| Inbox pending-game row is just notification text; want status, score, and which side you're on | `4a51a63` |
| Clicking DISPUTE opens a drawer over a screen — doesn't make flow sense; old drawer even worse | `745cad4` |
| Large note textbox at the top of the dispute form is wrong; move it down | `745cad4` |
| Score input text not centered in its box | `745cad4` |

### Area 3 — Explore card & court drawer 🚧 IN PROGRESS
Screenshots: `MY LOCAL COURT` card + court preview drawer header (images 1–5
of the 2026-09-04 batch).
- ✅ DONE (`3c81d71`): the `•N` live-indicator dot pushed the "ACTIVE NOW"
  number off-center. Fixed with a corner-pulse pattern (small `LivePulse`
  badge over the number instead of inline before it; number takes accent
  color) added to `StatBlock` (shared) and applied in `CourtListItem`. "ACTIVE
  NOW" → "ACTIVE" to match "LOCALS" as one word. The checked-in "HERE" pill
  moved out of the stats row into the top line so the two stat columns are
  always symmetric regardless of check-in state.
- ✅ DONE (`3c81d71`): court drawer header — sport tag alone in its corner,
  distance moved next to city on the opposite corner ("Houston · 33.5 MI"),
  title now uses `court.shortName || court.name` (was always the full name,
  the actual reason it wrapped to two lines). Dropped the `LIVE` pill; live
  activity now shows via the same corner-pulse on the "On Court" stat.
- ⬜ STILL OPEN: "padded... more intentionally" — the header box spacing
  itself hasn't had a dedicated pass yet, just the content it holds. Revisit
  if it still looks cramped once device-verified.
- **Proposal, not built:** the corner-pulse pattern now lives in `StatBlock`
  and `CourtListItem` independently. Area 4 (below) should promote it to the
  one place any surface asks "is this thing live" — including Home's court
  hero and the court detail page's metric panel, which weren't touched this
  pass and still have their own treatment.

### Area 4 — Roster consistency across surfaces 🚧 IN PROGRESS
WHO'S HERE / LOCALS is built three different ways today with different data
and styling:
1. Court preview drawer (`components/sheet/CourtSheetContent.tsx`)
2. Home LOCALS tab (`components/HomeScreen.tsx`)
3. `court/[id]` LOCALS tab (`app/court/[id].tsx`)

- ✅ DONE (`1bdefd0`): turned out Home and `court/[id]` already agreed with
  each other (both used `PlayerSummaryRow` + "Last here · 3 days ago"). The
  drawer's **LOCALS** list was the actual outlier (custom row, uppercase
  "LAST CHECK-IN: TODAY", no check-in count) — now uses `PlayerSummaryRow`
  too. The two duplicated `relativeTime`/`isInactive` helpers Home and
  `court/[id]` each carried verbatim are unified in `lib/localPresence.ts`.
- ⬜ STILL OPEN — **WHO'S HERE** (the live-right-now group): the drawer shows
  it as a horizontal avatar carousel; Home and `court/[id]` show it as a
  vertical `PlayerSummaryRow` list (same component as LOCALS, different data
  set). Two ways to resolve, needs a call before touching it:
  1. Convert the drawer's WHO'S HERE to vertical `PlayerSummaryRow` too —
     maximum consistency, matches everywhere else.
  2. **Proposal:** keep the horizontal carousel for WHO'S HERE specifically,
     and consider bringing it to Home/`court/[id]` too. A live "who's here
     right now" group is usually small and reads faster as faces you can scan
     in one glance than as a stack of rows (Von Restorff: the live group
     should visually read as a different kind of thing than the historical
     LOCALS list, not just a shorter version of the same row). LOCALS stays
     the detailed vertical list either way — it's the larger, historical set
     where check-in count / ELO / last-seen actually matter.
  Not built — flagging for a decision.
- ⬜ STILL OPEN: private-mode dimming has not reached these roster surfaces
  (a private check-in still renders as a normal row today) — see the
  2026-09-03 entry below.

### Not yet triaged from this batch
- (none outstanding — all 10 screenshots map to areas 1–4 above)

## Earlier feedback (2026-09-03) — settings & privacy

- ✅ DONE (`e3ce569`): Settings LOCATION collapsed from a ZIP field + separate
  court search + "CURRENT COURT ·" line into one drill-in row + focused
  typeahead editor ("if you said it, you said it").
- ✅ DONE (`e3ce569`): private mode is now visible to its own owner — the
  Settings profile row dims (48% opacity) + shows "HIDDEN — you won't appear
  in court rosters or the leaderboard" when PRIVATE is selected.
- ⬜ BACKLOG: the same private-mode dimming has **not** been extended to the
  roster surfaces themselves (Home locals, `CourtSheetContent` WHO'S HERE,
  `court/[id]` locals) — those render server-side presence and weren't
  touched. Natural to fold into area 4 above.
- ✅ DONE (`325a0d4`, `6501f77`): map "find nearest court" now reframes the
  camera and draws a neon accent path to the court instead of leaving the map
  static; Add Court camera overlay reworked; Add Court sheets rescaled to
  DESIGN.md tokens; Gemini court verification narrowed to a fixed set of
  rejection codes with matching copy (no free-text response); every Add Court
  screen has a way to cancel/close.

## Known gaps, not yet scheduled

- Terms of Service / EULA — Settings → Legal & Support now links
  `localchecksports.com/terms` alongside `/privacy` and `/support` (support
  email `localchecksports@gmail.com`). Remaining: make sure that page is
  live on the site and enter the URL in App Store Connect. App wiring done.
- "Report player" destination/handling is unconfirmed.
- Account deletion — done (Settings → Delete Account + `delete-account`
  Edge Function revokes the Apple token). Was previously listed as a
  release blocker in `docs/CURRENT_STATE.md`; cleared 2026-09-05.

## How to use this file

- Starting new UI/polish work: read the newest dated section, confirm what's
  ⬜/🚧, and continue that instead of re-deriving scope from screenshots
  already triaged here.
- Shipping something from this list: flip its status to ✅ and add the commit
  SHA in the same change that ships it.
- New feedback from Jesse: add a new dated section at the top (below "Branch
  / PR status"), in his own words where practical, before starting work.
- Merge status changes (PR opened, merged to `main`, OTA published): update
  the "Branch / PR status" section above — don't leave it stale once the
  branch this file describes has actually landed.
