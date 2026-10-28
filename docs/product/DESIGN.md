# LocalCheck Design System

Status: Authoritative MVP contract

Version: 3.0.4
Last verified source: 2026-08-29

This document describes the current product. It replaces earlier competing design notes. The reproducible source artwork and specs live in the LocalCheck Brand Asset Sheet; app tokens live in `constants/` and shared components live in `components/ui/`.

## Product idea

**Know who is running. Show up. Rank up.**

LocalCheck makes a local court legible: what is happening now, who belongs there, what is scheduled next, and how play changes a player's standing.

The product should feel premium, athletic, editorial, local, and direct. It should not feel like a glossy SaaS dashboard, a hacker interface, or a collage of unrelated cards.

## Identity

- `assets/brand/localcheck-logo-final.svg` is the canonical LocalCheck lockup.
  `assets/brand/localcheck-chevron-icon.svg` is its icon-only back variant.
- Render them only through `components/brand/LogoMark.tsx`: `LogoLockup` owns
  dedicated brand moments, `LogoMark` owns tab-header, icon-only, and static
  loading-placeholder contexts.
- The mark is icon-only; do not recreate it with text glyphs, CSS art, or a
  second in-product implementation.
- `assets/brand/splash-artwork.png` is the auth screen's persistent
  background image only (`app/auth.tsx`'s `AUTH_GRAPHIC`) — it is not part of
  any launch animation.
- `components/onboarding/LaunchTransition.tsx` is the one loading/launch
  indicator for the whole auth journey: a static, always-solid checkmark with
  the four corner brackets sweeping clockwise (one bright with a fading trail
  into the next) for exactly as long as its `loading` prop is true — tied to
  real async work, never a cosmetic timer. When loading resolves, the sweep
  stops, all four corners snap solid together, a brief breathing pulse plays,
  then it hands off. It appears once per journey: after a successful
  sign-in/sign-up/Apple submit in `app/auth.tsx`, or once on cold open for an
  already-signed-in session in `app/_layout.tsx`'s `AuthGate` — never both,
  never as a separate pre-form splash, and never a bare `ActivityIndicator`
  anywhere in this flow.
- Every primary tab header, including Home, uses `ScreenHeader`'s same
  `LogoMark` + title treatment. While the player is checked in (D62) the whole
  bar turns `Colors.accent`, the logo inverts to `Colors.background`
  (`LogoMark tone="dark"`), and the far right shows `CheckInClock`: the time
  since check-in (m:ss, then h:mm:ss) over PUBLIC / FRIENDS / PRIVATE. A screen's
  `right` content sits on a dark chip next to it; a label too wide to share the
  bar (Schedule's week) passes `hideRightWhenLive`. Detail pages use `DetailHeader`, whose
  icon and title gap follows the source lockup geometry. Court detail replaces
  the star with a compact outlined `LOCAL` / `SET LOCAL` control whose selected
  state uses the action accent without becoming a second primary button.
- Home section content uses symmetrical vertical spacing beneath section
  dividers. Horizontal player tiles use `Space.lg` above and below so their
  visual boxes never touch either boundary.
- All functional icons come from the installed icon libraries. Do not draw icons, use emoji, or use Unicode arrows/checkmarks as substitutes.

## Color tokens

| Token             | Value     | Purpose                                           |
| ----------------- | --------- | ------------------------------------------------- |
| Background        | `#0D0D10` | App canvas                                        |
| Surface           | `#17171C` | Standard surface                                  |
| Surface high      | `#1F1F25` | Selected or elevated surface                      |
| Border            | `#27272D` | Hairlines and structure                           |
| Primary text      | `#F2F2F6` | Headlines and primary copy                        |
| Secondary text    | `#9C9CA6` | Supporting copy                                   |
| Muted text        | `#8A8A96` | Timestamps and metadata (4.5:1+ on every surface, Oct 17; was `#6E6E7A`) |
| LocalCheck orange | `#FC4C02` | Brand, live state, selected state, primary action |
| Win               | `#00E87A` | Positive result semantics only                    |
| Loss              | `#FF3B5C` | Negative/destructive semantics only               |

`#FC4C02` is the product action accent (tuned to the mocks, D33; derived
tints use `rgba(252,76,2,…)` through tokens only —
`scripts/check-design-consistency.mjs` flags raw values). The final supplied logo artwork
uses `#FD6A03` through the dedicated `Colors.brandMark` token; that value is
reserved for the canonical logo geometry and is never a screen action color.

Sport color is restrained metadata, not a theme:

- Basketball metadata: `#D8B58D`
- Pickleball metadata: `#9CCFBE`
- Sport color may tint a court-card highlight at 11% opacity. It never recolors navigation or primary actions.

## Typography

There are two font families and one role system:

- Oswald 700: major display names and hero statistics.
- Oswald 500–600: screen titles, section display text, compact statistics.
- Inter 400: sentences, activity actions, body copy, and input text.
- Inter 500: metadata, timestamps, and supporting labels.
- Inter 600–700: short controls and essential labels only.

Rules:

- Activity sentences use normal Inter weight. Player names may differ by color or interaction, not by making the entire sentence bold.
- Uppercase is reserved for display names, navigation, compact labels, and controls. Human sentences use sentence case.
- A timestamp is visually quieter than the event it describes.
- Use the semantic `TextStyles` roles from `constants/typography.ts`; do not
  reference font names or invent a component-local type scale in feature screens.
- Essential iOS text never renders below 11 points. Use color, weight, and
  spacing—not microscopic text—to make metadata quieter.

| Semantic role  | Family and size   | Product use                       |
| -------------- | ----------------- | --------------------------------- |
| `displayLarge` | Oswald 700, 36/40 | Major hero moments                |
| `display`      | Oswald 600, 28/32 | Screen and profile display titles |
| `title`        | Oswald 600, 22/26 | Card and section display titles   |
| `metric`       | Oswald 600, 24/28 | Court and hero metric values      |
| `stat`         | Oswald 600, 22/26 | Standard statistics               |
| `statSmall`    | Oswald 600, 18/22 | Dense row statistics and ELO      |
| `compactStat`  | Oswald 600, 14/18 | Secondary row counts              |
| `body`         | Inter 400, 16/22  | Primary readable copy             |
| `bodySmall`    | Inter 400, 14/20  | Compact readable copy             |
| `listName`     | Inter 600, 14/18  | Player and entity names in rows   |
| `metadata`     | Inter 400, 12/16  | Supporting information            |
| `caption`      | Inter 400, 11/13  | Dense supporting information      |
| `label`        | Inter 600, 12/16  | Controls and important labels     |
| `labelSmall`   | Inter 500, 11/13  | Compact captions and stat labels  |

## Layout and component ownership

- Minimum touch target: 44×44 points.
- Screen gutter: `Layout.screenGutter`.
- Use hairlines and spacing before creating nested cards.
- Root screen shells keep headers, tabs, and reachable actions stable. The
  smallest supported viewport, landscape, Dynamic Type, keyboard, and error
  states must still expose every control; use an adaptive outer scroll region
  when a fixed body would clip content.
- Sticky primary actions belong at the reachable bottom edge through `StickyActionBar` or `SpeedDialFab`.
- Every drawer is the Explore drawer (D57): `AppBottomSheetModal`, through
  `RunFlowSheet` or `FormSheet` (a form that brings its own scroll view uses
  `FormSheet`, which is `RunFlowSheet` with `scroll={false}`). No `Modal`
  pop-ups for content; `CompactSelect` menus and the crash screen excepted.

### Layout rules (hard)

- **Headers and filters stay fixed (D62).** A screen's header, tabs and filter
  rows never scroll with its list: Home pins the whole court block and the
  busy-times chart (under 720pt tall the chart scrolls with the page); Compete
  pins its tabs and sport / scope filters and scrolls only the ranking list.
  Build it as a fixed `View` above a `ScrollView`, never `stickyHeaderIndices`.
- **Back is the edge swipe (D62).** Detail screens use the standard iOS edge
  swipe back; `fullScreenGestureEnabled` is off so a vertical scroll that
  drifts sideways never leaves the page.

- **The tab bar is a floor for screens (D41); sheets open in front of it
  (D44).** One sheet host at the app root (CourtSheetHost) means every
  `AppBottomSheetModal` covers the tab bar; sheet content pads with
  `useSheetBottomPadding()` (home indicator only).
- **Tab bar floor, details.** Nothing on a screen renders under it.
  `components/ui/TabFloor.tsx` carries the real tab bar height (0 on stack
  screens). `AppBottomSheetModal` sets the sheet's `bottomInset` from it, so a
  sheet opened in a tab rises from the top of the tab bar. Sheet content pads
  its bottom with `useSheetBottomPadding()`; scroll content with
  `useBottomFloor(extra)`. Never add `Layout.tabBarClearance` or the safe area
  by hand inside a sheet.
- **No overlaps, no squish.** Every row that holds a name or number is built
  for a 24-character username and four-digit values: the text child gets
  `flexShrink: 1`, `minWidth: 0`, `numberOfLines={1}`; labels beside it get
  `flexShrink: 0`; equal columns use `flex: 1, flexBasis: 0`. Numbers that line
  up use `fontVariant: ["tabular-nums"]`.
- **One rhythm per list.** Section header to first row `Space.sm`, between
  sections `Space.xxl`, from a sticky filter row to the first header
  `Space.lg`.
- **Centre status labels optically.** A label between two edges gets equal
  space on both sides (set `lineHeight` so the font's ascender doesn't shift
  it).
- **No box inside a box.** Controls inside a card (switches, links) are bare
  rows; separate with hairlines and spacing.
- **Motion (D42):** nothing animates on open. Only `ShareLine` fills once,
  an ELO change counts when it happens live, and user-changed values animate.
- **Game state (D43):** state lives in `GameStateBanner` across the top of the
  card, same colours everywhere. Court names use the short slug except in
  court details. Names never go inside a sentence: name on its own line,
  status on the next.
- **Hidden scores (D40)** render as W / L wherever a number would be, and the
  change animates through `RollingNumber` (letters rise like digits roll).

Canonical component ownership:

| Product element                | Canonical component |
| ------------------------------ | ------------------- |
| Brand mark                     | `LogoMark`          |
| Tab header                     | `ScreenHeader`      |
| Detail/back header             | `DetailHeader`      |
| Court discovery card           | `CourtListItem`     |
| Home court hero                | `HomeCourtHero`     |
| Court line art (card, page)    | `CourtArt`          |
| Court 3-number strip           | `MetricStrip` (`size`: page, drawer, card) |
| Check in / Check out button    | `CheckInButton`     |
| Court › (drawer → court page; glass) | `CourtLinkButton`   |
| Local court (glass house beside Check in) | `LocalButton`   |
| LOCAL tag on a card            | `LocalTag`          |
| Checked-in timer + visibility  | `CheckInClock` (inside `ScreenHeader`) |
| Drawer section label + meta    | `SectionHead`       |
| Court/Home content tabs        | `CourtTabBar`       |
| Sport icon                     | `SportEmblem`       |
| Player avatar                  | `PlayerAvatar`      |
| Player list row                | `PlayerSummaryRow`  |
| Profile identity               | `ProfileHero`       |
| Profile metrics                | `ProfileStats`      |
| ELO value                      | `EloStat`           |
| Activity timeline event        | `ActivityRow`       |
| Court metric panel (old court page, no longer used there) | `MetricDashboard` |
| Scheduled game card            | `CourtGamesPanel`   |
| Compact menu                   | `CompactSelect`     |
| Primary two-mode switch        | `ModeTabs`          |
| Reachable multi-action control | `SpeedDialFab`      |
| Game/revision date             | `RecentDatePicker`  |
| Bottom sheet (any drawer)      | `AppBottomSheetModal` |
| Tab-bar floor / bottom padding | `TabFloor` (`useBottomFloor`, `useSheetBottomPadding`) |
| Hide score switch              | `HideScoreToggle`   |
| Press feedback                 | `PressableScale`    |
| Confirmation after an action   | `useToast()` (`Toast.tsx`) |
| Animated score / stat number   | `RollingNumber`     |
| Final score (1v1 and teams)    | `ScoreCard` (+ `GameStateBanner`) |
| Margin / series line           | `ShareLine`         |
| Inbox row with action          | `InboxActionRow`    |
| Choice chips                   | `ChoiceChips`       |

If one of these elements changes, update the canonical component and search the codebase for competing local implementations before finishing.

### Keyboard and typeahead contract

- Search suggestions render in the same surface, immediately beneath the field
  or active selector that owns them. Do not create a detached search box at the
  bottom of a form.
- Searchable screens use `KeyboardAwareScrollViewCompat`, keep result taps
  active while the keyboard is open, and support interactive iOS dismissal.
  The focused field and the first useful results must remain above the keyboard.
- Profile search replaces the ordinary Friends list while a query is active.
  Log Game opens its player field in place; an empty query prioritizes players
  actively checked in at the selected court and falls back to friends when the
  live roster is empty. Typed queries search all visible profiles while
  retaining court/friend relevance.
- Large choice sets use typeahead or a contextual list. Date selection uses
  `RecentDatePicker`. Do not expose a free-typed date field on iOS.

## Court card treatment

Since D56 (Oct 15) the Explore card is the court-flow card: `#121216`, 20pt
corners, one hairline, sport label, Oswald 30 name, city · distance, then On
court / Court hours · wk / Locals on a darker band. Live courts sort first.
Since D62 (Oct 28) the name and city are centred, the sport label sits centred
on the first line with a small LOCAL tag (`LocalTag`) at the right edge when it
is your local, and the court drawing is gone: a soft sport tint
(`basketballTint` / `pickleballTint`) fades from the top-right corner instead,
so nothing is drawn behind the text. The older treatment below is kept for
history.

Explore court cards use the supplied reference treatment:

- Base gradient: `#202027` to `#19191E` at 135 degrees.
- Subtle top-right sport tint fading to transparent.
- Border: `rgba(242,242,246,0.09)`.
- Radius: 16.
- Quiet elevation: an inset gloss highlight and a low-opacity black shadow.
- A low-contrast court-geometry watermark sits behind content, using the current sport's muted metadata tint; it is decorative and never carries state.
- Cards remain compact (128 px minimum): sport icon and label at top, shorthand court name, neighborhood, two optically centered live/locals metric columns, and one library chevron affordance.
- Only the current local court shows the neutral outline star. Other cards do not show an empty star; setting a local court lives on its detail page.
- Cards do not contain check-in or local-court buttons. Tapping opens the court drawer.

Home uses the same material language as a full-width hero, not a floating card. Its primary check-in action remains bright `#FF5500`.

## Court flow

Current (D56, Oct 15):

1. Explore shows court-flow cards, live courts first.
2. Tapping a card opens the drawer: sport + Your local / Set as local,
   centred name, city · distance, On court / Court hours · wk / Locals,
   Check in and Court ↗. Tapping the header or dragging expands it.
3. Expanded (92%): Here now, Up next, Today (planned visits in 2-hour bars),
   Recent activity, then Games / Players / Feed / Week chips that open the
   court page on that tab. Fixed height, never scrolls.
4. Not your local and no LocalPlus: the expanded area is blurred under the
   LocalPlus panel (white Unlock with LocalPlus, terms, "Or make this your
   local court — always free"). Court ↗ goes to the LocalPlus screen.
5. The drawer can set a local court; removing one lives on the court page.

Onboarding (Oct 15): welcome (what LocalCheck is, three rows), name + sport,
Pick your court on a map with pins (location ask sits on the map, city search
as a fallback), auto check-in on its own screen with the privacy explanation,
then alerts. No drawer in onboarding.

Player profile actions by friend state: not friends Log game | Add friend
(orange); they asked Log game | Accept request (orange); you asked Cancel
request | Log game (orange); friends remove icon | Log game | Challenge
(white). Log game opens as a sheet over the profile.

Home (D58, D60): one scrolling page, no tabs. Only the court name, city and
3-number strip (`HomeCourtHero`) stay pinned; the sport row with the local mark
(`HomeCourtTop`) scrolls away. Under the pinned part: Check in beside a centred
> (`HomeCourtActions`: the drawer's `CheckInButton` and `CourtLinkButton`),
Here now (`HereNowSection`), then
Up next (`UpNextSection`, plain text count, not a link), Today
(`CourtBusyChart`) and Recent activity (every court feed row, `ActivityRow`).
Here now and Up next are the Explore drawer's own sections
(`components/court/CourtOverviewSections.tsx`), shared with the drawer.

Feed rows (`ActivityRow`): 32pt tile, sentence + detail, score and time on
the right, all one height. The tile: small solid orange dot (8pt) for a
check-in, the same grey dot for a check-out, VS for a game result, the
calendar for a scheduled game, the people icon for a burst of check-ins.

Busy times (`CourtBusyChart`): past hours filled grey (check-ins), now
orange, later hours outlined (planned visits + game sign-ups). Hour labels
sit centred under their bar and may be wider than it ("Now" never clips).
`variant="header"` is today only: no title, day stepper or caption (court
page header).

Strip numbers with a unit ("38h", "8P") set the unit a size smaller after a
thin space (`MetricStrip`).

Week (`CourtSchedulePanel`, court page; D58): days across (Monday to Sunday,
today white), two-hour rows down (7A to 9P), in a Planned visits · this week
card with the Busiest slot at the top right and a Fewer → More ramp plus a
Game dot at the bottom. Cells are 34pt, five heat levels, past cells dim and
disabled, the selected cell outlined in white. The Today card below (title is
the selected slot) lists who's going with the + (adds or removes you) fixed on
the left of the faces, then each game in that slot with Join fixed on the left
of its title (opens the game page), so the actions stay put however many people
or games there are. Create a game is not here (it lives on Games and Schedule). The
panel scrolls on every phone; there is no bottom bar under it.

Small phones (D57): the Schedule tab keeps its full slot card and games row;
when that can't fit (iPhone SE) the page scrolls rather than squeezing or
clipping. The court page's Week panel always scrolls (D58). Floating
buttons get bottom clearance so nothing ends under them.

Schedule tab (D57): never scrolls as a page when it fits. One-line court dropdown (pin,
name, chevron). The selected-time card is one row of names with Add my time /
Remove my time beside them. Upcoming games are `ScheduledGameCard`s in one
row you swipe left and right, one card plus a peek of the next.

Game page (D57): the court name appears once (header), the format once
(strip); Submit result / View result / result status live in the pinned
footer, never below the roster.

Game activity rail (`GameActivityList`): the marker, the day/time and the
sentence share the centre of the sentence's first line. A bare played day
("2026-10-16") is a local day (`parseDayOrInstant`), never UTC midnight.

Tab bars: Home, the court page, both profiles use the same Inter-caps tabs
with an orange underline (`CourtTabBar` style).

Onboarding (D57): the welcome uses the sign-in artwork full bleed at the top,
fading into the page under the headline; the other steps (except the map)
show the court trace behind the step title.

Buttons (D56): 4pt corners, Inter bold uppercase labels, 50pt main actions
(`BrutalistButton`, `CheckInButton`). White is the neutral primary; orange
is for Check in, live and selection.

Before D56, kept for history:

1. Explore shows concise court cards.
2. Tapping a card opens a content-sized court drawer ending exactly at its disclosure rail, with identity, live metrics, equal **Check in** / **View court** actions, and no exposed expanded content.
3. Pulling the drawer to 92% reveals who is there, locals, planned visits, and upcoming runs.
4. Setting or removing a local court happens on the court detail page or through
   Settings typeahead—not on Explore cards or the preview drawer. Settings must
   save directly and must not route through the native Mapbox surface.

Explore also exposes a compact **Add** header action. Add Court uses the shared
`FormSheet`, requests a location, lets the player correct the derived address,
and requires a camera or library photo before verification. A successful
server response is inserted into the current court list and invalidates only
court discovery queries.

Explore map pins include quiet courts as well as courts with active check-ins.
The map status therefore says **No active check-ins in view** when pins are
present but nobody is checked in. **Find nearest court** uses device location,
the canonical geographic court service, and an animated camera move before the
same court drawer opens; it never substitutes a fabricated location after a
permission denial.

The court page (D55, Oct 14; header revised by D57, Oct 17) follows the court-flow design (`components/court/`). The header is fixed: back arrow and Your local pill; court line art pinned top right; sport label, name (Oswald, one line, shrinks to fit), city · distance on the left, a large live On court number on the right (orange with the live dot when anyone is on); then today's busy times (`CourtBusyChart` header variant: today only, no day arrows or caption) on every tab; the court trace behind the header is dimmed (`CourtArt` `faint`) so text stands out. Court hours · wk sits on Info, the next game on Games. Under it the tabs Live · Games · Players · Week · Info, with an orange underline on the active tab. There is no bottom bar (D58): Home and the Explore drawer own Check in. Only the selected tab's content scrolls:

- Live: On court tiles (busy times moved to the header, D57) ("Nobody yet. Check in and you're first." when empty), All / Games / Check-ins chips, then the activity timeline and game-result modal.
- Games: upcoming scheduled games by day (Today, Tomorrow, then the date), time, title, "x of y going" and a fill bar; tapping opens the game page. The list ends on a dashed Create a game row.
- Players (D58, `CourtPlayersPanel`): this court's locals only, no Here now
  section. A Ranking / Active / Newest control (`SegmentedControl` `compact`)
  and "N locals · ranked after every ranked game here". Each row: rank by
  rating (1-3 bright), avatar with an orange dot when checked in, name, "W–L at
  this court" (from `fetchCourtRecords`), ELO. Ranking is rating, then wins
  here; Active is checked in now, then latest check-in; Newest is the most
  recent to make this their local first (`profiles.local_court_changed_at`).
  Your own row ("You", W–L, points to the next rank) is pinned under the list
  with an orange left edge.
- Week: the heatmap and Today card above (`CourtSchedulePanel`).
- Info: map with Directions, Court hours · wk / Avg session / Locals, then Courts, Lights, Access. A value the database doesn't have shows a dash.

Home's court header uses the same pieces: line art, sport label, house marker, name, city · distance, On court / Court hours · wk / Locals, then Check in and Court (arrow pointing right).

Replaced by the above on Oct 14 (D55), kept for history: the court detail page keeps the brand/detail header, six-metric court panel, and tabs fixed. Metric values remain optically centered. A metric with comparison data uses a consistent top-right trend corner; tapping the full 44-point-or-larger tile reveals the percentage and comparison period, with an accessible expanded state and a reduced-motion crossfade. Only the selected tab's content scrolls when needed:

- Feed: paginated activity timeline and game-result modal.
- Locals: public presence, active locals, stale/inactive treatment, check-ins, and ELO.
- Schedule: a clean read-only heatmap and concise upcoming runs.
- Details: full name, shorthand, address, added date, status, mini map, and local-court action.

## People and profile system

- Initials are always derived through `normalizePlayerInitials`; every avatar shows two characters where possible.
- Checked-in emphasis is an orange glow on the initials, not an extra status dot or bracket.
- Friendship is a small star badge at the avatar's lower-right edge.
- Inactive locals use the muted avatar state after 90 days without a check-in.
- Me and other-player screens reuse `ProfileHero`, `ProfileStats`, and `EloStat`.
- ELO is large, centered, and white. Weekly delta is orange (red only when negative).
- Wins and losses may use green/red values because they are explicit result semantics.
- Player QR codes deep-link to profiles. A cold-start profile always offers a visible branded back action that returns to the tab app.
- A player profile keeps **Log Game** reachable even when the player was not
  loaded through the leaderboard. Report and block actions live in the same
  profile context and never replace the primary game/friend actions. Settings
  exposes **Blocked players** so an accidental block is reversible without
  making blocked identities visible in ordinary profile search.
- Other-player profiles use three mutually exclusive tabs: **VS YOU**,
  **ACTIVITY**, and **DETAILS**. The external profile hero omits the long
  username and moves member-since metadata into Details. Name/local-court copy
  and ELO remain vertically aligned in the hero.
- **VS YOU** uses its own contained series card instead of repeating the player
  row's win/loss colors and geometry. Its three-part scoreboard compares the
  viewer, win rate, and opponent at a glance. **Activity** lists persisted games.
  **Details** owns the local-court link, member date, global sport rank, a real
  90-day weekday check-in heatmap, and report/block controls.

## Activity timeline

- A thin continuous rail centers through every node.
- Filled neutral node: checked in.
- Outlined node: checked out.
- Filled orange node: game result.
- Sentences are human: `Player A checked in` and `Player A beat Player B, 11–7`.
- Team results join every player on each side with `+`.
- Player names/profile targets remain interactive; game events open the shared result modal.
- Timestamps remain smaller and quieter than the event sentence.
- Hype is a persisted one-per-user reaction. The count and highlighted state
  always hydrate from authoritative like rows; a tap never inflates local-only
  state.

## Schedule and run flow

- Schedule keeps a stable weekly heatmap footprint in view mode. Its one-hour
  time axis scrolls independently between two overlapping snap windows (8 AM–3 PM
  and 3–10 PM). A single directional chevron sits below the early window or above
  the late window and is also a tap target. Compact screens may scroll the body so
  selected-slot details and upcoming runs remain reachable.
- The reachable `SpeedDialFab` exposes **Add times** and **Create run** using the shared Reanimated component and Feather icons.
- Add-times mode supports multi-select cells and one save action.
- Scheduled run cards show localized 12-hour time, attendees, and remaining spots. They do not waste space on `VIEW` copy or a text arrow.
- Run detail keeps the two-column roster compact; its body scrolls when a full
  roster plus host controls exceeds the viewport, while the RSVP footer stays
  fixed and reachable. The header separates the game identity from three key
  facts—when, location, and creator. Going count belongs to the roster header,
  and every configured roster slot renders individually, including open slots.
- Compete uses the same `ModeTabs` interaction as Explore for **Rankings** and
  **Log Game**. The logging form is a first-class tab rather than a nested
  drawer, while profile and run deep links still prefill its existing context.
- Game logging is a shared form sheet reached from a player or run context, with opponent/court prefilled when available.

## Final score review

- A submitted result remains one match through every state; corrections update
  that row rather than creating a second game.
- **Review open** shows a visible three-day countdown above the centered score
  card. An opposite-side player may approve immediately; otherwise the result
  auto-approves at the deadline and only then changes profiles and ELO.
- **On hold** follows a dispute and shows a seven-day resolution countdown.
  Any participant, including any player from either team, can update the score,
  court, or date. The roster is stable for MVP dispute resolution.
- A corrected result notifies every participant and starts a fresh three-day
  review. The first and second disputes create a hold; the third dispute, or an
  unresolved hold deadline, voids the result permanently without profile or
  rating changes.
- `MatchReviewCard` owns the status, countdown, game identity, players, and
  score hierarchy. `MatchRevisionSheet` owns corrections through the shared
  `FormSheet`, `RecentDatePicker`, shared selector, and `StickyActionBar`.
  Status is communicated with text and structure, never color alone.
- Actions follow one hierarchy: Approve or Update is the prominent action;
  Dispute is a clearly labeled secondary action. Every touch target remains at
  least 44 points. The countdown sits above the game card. The policy
  explanation sits below it, is collapsed by default, and expands in place.

## Motion and feedback

Motion communicates hierarchy and confirmation; it is not decoration. Every
value comes from `constants/motion.ts`:

| Token | Value | Use |
|-------|-------|-----|
| `Springs.settle` | 400ms, damping 1 | Things coming to rest, no bounce |
| `Springs.snapBack` | 400ms, damping 0.8 | Released drags returning |
| `Springs.sheet` | 300ms, damping 0.8 | Toasts and sheet-like entrances |
| `Ease.out` / `CssEase.out` | `cubic-bezier(0.23,1,0.32,1)` | Enter / state changes |
| `Ease.inOut` | `cubic-bezier(0.77,0,0.175,1)` | Moves on screen |
| `Durations` | press 120, small 180, ticker 600 | |
| `PRESS_SCALE` | 0.97 | Press-down scale |

Table stakes, checked on every UI change:

- **Anything that looks like a drawer is a real drawer**: `AppBottomSheetModal`
  (gorhom), swipe down and tap-out dismiss it. No faked modals.
- **Every tappable card, row and button gives press feedback** through
  `PressableScale` (or `BrutalistButton`, which uses it).
- **Numbers that change roll** (`RollingNumber`): scores, ELO, stats.
- **Actions confirm with a toast** (`useToast().showToast`), a success haptic,
  swipe up or tap to dismiss, auto-hide at 3.5s. Check-in and score logging use
  it.
- Reduce Motion is honored everywhere (`useReducedMotion`): springs and rolls
  collapse to the final state.
- Only Expo Go-safe libraries (Reanimated 4 CSS transitions and springs,
  worklets `scheduleOnRN`, gesture-handler, expo-haptics).
- Court metric tiles: 220ms; Reduce Motion swaps the 3D flip for a crossfade.
- Signed-in cold starts use a 1.6-second mark sequence: pin → W → check.
  Signed-out cold starts give the artwork and lockup the full reveal before
  the form is interactive. Reduce Motion shows the final static state.

## Pattern provenance

These references ground interaction behavior; LocalCheck keeps its own tokens,
data contracts, accessibility labels, and installed SDK-compatible primitives:

- [Nexvyn Goo Dropdown](https://ui.nexvyn.dev/components/goo-dropdown) — compact
  anchored choice disclosure and clear selected state. LocalCheck's
  `CompactSelect` uses the same interaction model without importing its web-only
  implementation.
- [PanelUI](https://github.com/panel-ui/PanelUI) — cohesive mobile surface,
  sheet, and action hierarchy. The SDK 57/Uniwind package is reference-only for
  this SDK 54 app.
- [Expo Content Transition](https://github.com/rit3zh/expo-content-transition)
  — content continuity as an interaction principle. Its SDK 56 native module is
  not copied into the current binary.
- [Material UI Speed Dial](https://mui.com/material-ui/react-speed-dial/) — one
  reachable primary action that expands to labeled related actions. LocalCheck
  implements that established pattern with the Reanimated and icon packages
  already installed.
- [Mobbin sports patterns](https://mobbin.com/explore/mobile/app-categories/sports)
  — concise score, ranking, card, and team hierarchy used as cross-product
  pattern evidence rather than a visual template.

Reference code never overrides LocalCheck's supported Expo runtime or backend
contract. If a source requires a newer native runtime, reproduce the proven
interaction with supported installed primitives and record that decision here.

## Accessibility and verification

- WCAG AA contrast.
- 44×44 minimum interactive targets.
- Every icon-only control has an accessible name and hint.
- Color never carries state alone.
- Test Dynamic Type, VoiceOver labels, keyboard focus on web, reduced motion, and safe-area behavior.
- Every visual pass ends with typecheck, unit tests, a verified connected web
  export, and direct visual checks at standard and compact iPhone-sized
  viewports. Test multi-account realtime behavior separately on two
  authenticated clients.
- A screen does not pass because it looks similar in a screenshot. Headers,
  sheets, cards, buttons, and controls must use their canonical shared owner so
  their navigation, gestures, dismissal, loading, and disabled behavior remain
  consistent with the rest of LocalCheck.

## MVP scope guardrail

Do not trade the working product for unfinished complexity. Use established libraries already in the project, improve shared components instead of spot-editing screens, note non-blocking polish, and keep moving toward TestFlight external testing.

Local court button (D62, replaces the D60 / D61 corner mark): a small glass house
button (`LocalButton`) to the left of Check in on Home, the Explore drawer and
the court page header. Orange house when it is your local, light grey when it
isn't; a tap on a non-local court sets it, on your local it does nothing
(Settings changes it). The court button (`CourtLinkButton`) is a narrower glass
chevron to the right. Glass is `Colors.glass` with a `hairlineChrome` border,
48pt wide, the same height as Check in. The slot is also where saved courts will
go.

Drawers (D60): the Challenge and Log game drawers are the baseline for every
form drawer (`RunFlowSheet`, WHERE `CourtSearchPicker`, WHEN `RecentDatePicker`
+ `TimeStrip`, `SegmentedControl`, one accent button). Schedule a game
(`ScheduleGameSheet`) follows it. The expanded Explore drawer scrolls; its
LocalPlus panel is top-aligned.
