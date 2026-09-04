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
  `origin/main` @ `39fc658`). **Not merged to `main`. No PR opened yet.**
- **Plan (confirmed by Jesse, 2026-09-04):** keep stacking commits on this one
  branch through settings → game logging → explore/roster polish → a final
  screen-by-screen review pass. Claude opens and merges the final PR to
  `main`; Jesse screenshots that merged build for App Store Connect and
  submits it. Do **not** split this into several small PRs.
- All commits so far are **JS-only → OTA-eligible** (no new TestFlight build
  required once merged + OTA'd).
- **Not yet device/browser verified** for any commit below — the web preview
  sits behind login and no test credential has been available in-session.
  Verification happens when Jesse pulls the branch or after merge + OTA.

## Status legend

✅ done — committed on the branch · 🚧 in progress · ⬜ backlog, not started

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
