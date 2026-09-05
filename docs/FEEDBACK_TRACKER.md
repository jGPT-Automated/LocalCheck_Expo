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

- **Working branch:** `codex/explore-location-nearest-court` (base
  `origin/main` @ `39fc658`). **PR open: [#42](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/42),
  not merged.**
- **Plan (confirmed by Jesse, 2026-09-04):** keep stacking commits on this one
  branch through settings → game logging → explore/roster polish → score
  review delight → a final screen-by-screen review pass. Claude opens and
  merges the final PR to `main`; Jesse screenshots that merged build for App
  Store Connect and submits it. Do **not** split this into several small PRs.
- All commits so far are **JS-only → OTA-eligible** (no new TestFlight build
  required once merged + OTA'd).
- **The release loop is simple and already automatic** (corrected
  2026-09-04 after Claude wrongly hedged on this): opening a PR against
  `main` auto-publishes a scannable Expo Go preview via
  `expo-pr-preview.yml`; merging that PR to `main` auto-triggers the
  TestFlight build. No manual EAS step either way. Expo Go runs the whole
  app; only Explore's map crashes there (reload recovers) — see
  `docs/RELEASE.md`.
- **Now device-verified via PR #42's Expo Go preview** — Jesse tested on two
  accounts (`jessebharrick` and `8yp4gttjwv`) and sent the next round of
  feedback below from that build.

## Status legend

✅ done — committed on the branch · 🚧 in progress · ⬜ backlog, not started

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
- ⬜ BACKLOG, needs a design decision before building — same theme as
  Priority 1 above, now expanded:
  - `ProfileMatchRow` (used on the other-player "ACTIVITY"/"VS YOU" tabs,
    which Jesse said looks better than his own Activity tab) shows
    `match.courtName` as the bold primary text today — needs to become
    player names instead, court/date as sub text. `MatchResult` (the type
    it receives) carries no participant-name field at all right now, so
    this needs a small data-shape change (`gameService.ts`'s
    `mapMatchToResult`), not just a component edit.
  - The Home feed's and court feed's `match_result` entries render as plain
    sentence text next to check-in/check-out timeline dots (already flagged
    in Priority 2 as "should be a thin, long game card box") — same root
    ask as the `ProfileMatchRow` one: **one consistent, player-names-forward
    game-result treatment used everywhere a game shows in a feed/activity
    list** (Home feed, court feed, Me tab activity, other-player Activity
    tab), distinct from the plain check-in/check-out rows they sit beside.
  - Not started. Proposed approach: a compact, feed-specific game card
    (lighter than `ScoreCard`, which carries review-status semantics that
    don't apply to a historical feed entry) rendered wherever `ActivityRow`
    currently renders a `type: "game_result"` item, and reused by
    `ProfileMatchRow`'s call sites. Needs confirmation before building —
    this is a real design decision, not a bug fix.

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

- No Terms of Service / EULA URL — App Store review requires one. Privacy
  policy and support links are live.
- "Report player" destination/handling is unconfirmed.

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
