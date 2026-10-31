# Current state

Last reconciled: 2026-10-14 against `origin/main` at `541632c` (#65), PR #67
(`codex/auto-check-in`), LocalCheckProd (read-only queries), the GitHub API and
the EAS build list.

Each claim says which of these it is, because they are often confused:

- **Decided:** Jesse approved it (`docs/product/DECISIONS.md`).
- **On #67:** the code is on the PR #67 branch, not on `main` and not in any
  installed build.
- **Live backend:** the database change or Edge Function is in production,
  checked by a query or the function list. Live backend applies to every
  installed build, merged or not.
- **Tested on device:** seen working on a real iPhone build, with the date.

## Production checkpoint

- Source truth: `origin/main` @ `541632c` — #65 squash-merged (forgot
  password, onboarding, Expo Go previews, court drawer + Yearly upgrade).
- PR #67 open (base `main`, app version 1.0.4): everything from #66 (other-
  player profile, Challenges, hide score, game card and real game sheet,
  motion pass, Yearly + Monthly picker, test-data hiding, store-review fixes)
  plus auto check-in (D35–D38) and the Oct 8 preview fixes (D39–D41). #66 is
  superseded; close it when #67 merges.
- Applied Oct 12 by Jesse: `20261010120000` and `20261012120000` (challenge
  time, short usernames, friend alert wording) and, at about 8:33 PM Central,
  `20261012180000_qstash_timers.sql` (D50, D51): timed work runs on QStash,
  the five polling jobs are gone, and `localcheck-timer-bookings` re-sends
  failed bookings every minute (`docs/SUPABASE.md` → "Timed work (QStash)").
  Deployed Oct 12: `timers` v1 and `send-notification` v5 (`data.category` →
  Hide / I'm still here buttons, `data.collapse_id` → "Check-in posted"
  replaces the arrival notice).
- Applied Oct 12, about 9:05 PM Central: `20261012200000_checkout_notice_for_all.sql`
  (D53: manual check-ins get the "Auto checked out" push too). Checked on a
  real check-in: Jesse's manual check-in ended at 9:14:29 PM by QStash and
  the push went out at 9:14:32 PM. Front-end handoff (includes the matching
  I'm still here change):
  `docs/handoffs/2026-10-13-frontend-timers-and-auto-check-in.md`.
- Docs check (Oct 13, D54): CI job `docs updated` fails any push to a pull
  request that changes anything outside `docs/` without adding lines to this
  file, and anything under `supabase/` without adding lines to
  `docs/SUPABASE.md` (`scripts/check-docs-updated.mjs`, rules in
  `scripts/docsCheckModel.mjs`, tests in `scripts/docsCheckModel.test.mjs`).
  The rule is at the top of `AGENTS.md` ("Docs on every push") and in the PR
  template. Found because #65 (Oct 6) merged with none of these docs updated,
  so `main`'s docs still describe September.
  Oct 14 audit: corrected README, GITHUB, SUPABASE, RELEASE, this file, the
  RevenueCat runbook and DECISIONS against the code, the live database, the
  GitHub API and the EAS build list. The docs check now also maps release and
  native config to `RELEASE.md`, CI to `GITHUB.md` and purchase code to the
  RevenueCat runbook, picks the range correctly after a force push (whole PR,
  merge-base diff), and `pnpm check` runs `scripts/check-docs-consistency.mjs`
  with regression tests for each error found. Neither check is required to
  merge, because `main` has no branch protection.
- Installed TestFlight build: `1.0.3` (33), built Sep 14 from #57. EAS build
  list on Oct 14: no iOS build since. Builds are manual only (D22). The release
  workflow was disabled in GitHub Oct 3 and enabled again Oct 14
  (`docs/RELEASE.md`).
- `main` has no branch protection and no ruleset (GitHub API, Oct 14), so no CI
  check is required to merge (`docs/GITHUB.md`).
- EAS project: `agenticjess-os/localcheck`
  (`9c906173-0258-45a9-a3fe-786cda373c66`).
- Supabase production project: `qkrnmyexzvaxiqfxwwfb`. Every migration in
  `supabase/migrations/` is in the live ledger except
  `20260812032141_skip_stale_pending_push_notifications.sql` (never applied).
  Some files are recorded under a different version (their apply time); match
  by name. All five Edge Functions in `supabase/functions/` are deployed
  (versions in `docs/SUPABASE.md`). Live jobs: `localcheck-notification-dispatch`
  and `localcheck-timer-bookings` only (Oct 14).
- Installed binaries use EAS Update with `runtimeVersion.policy = appVersion`.
- Court page and Home card, first design pass (Oct 14, Jesse asked for it
  before the 1.0.4 build), from the Claude Design court flow handoff:
  - Court page (`app/court/[id].tsx`): the 6-number dashboard is gone. New
    header: court line art, sport, name, city · distance, then On court /
    Court hours · wk / Next game. Tabs Live · Games · Players · Week · Info.
    Bottom bar: Plan visit (opens Week, now with "I'm coming" and Create a
    game) and Check in / Check out (same
    rules as Home, including the auto check-in waiting state). The jump to
    LocalPlus for a court that isn't yours, without Plus, is unchanged.
  - Games lists upcoming scheduled games at the court (`runs`, already
    loaded by AppContext); tapping one opens `app/run/[id].tsx`.
  - Info: map with Directions, Court hours · wk / Avg session / Locals, and
    Courts, Lights, Access from `courts.court_count`, `has_lights`,
    `access_type` (now read by `services/courtService.ts`); a missing value
    shows a dash.
  - Court hours = sum of the last 7 days' sessions, each capped at 4h, a
    session with no check-out closed at 3h (`lib/courtHours.ts`, tests in
    `lib/courtHours.test.mts`).
  - Home: the local court card uses the same pieces (`components/court/`):
    line art, Your local, On court / Court hours · wk / Locals, Check in and
    View court (arrow points right). Home's tabs use the same tab bar.
  - Docs: D55 in `docs/product/DECISIONS.md` (supersedes the Aug 9 read-only
    court route entry) and the court page section of `docs/product/DESIGN.md`.
  - Not in this pass: Players sorts (Active / Newest / All), the Live
    scoreboard rows, Phosphor icons, the drawer.
- Oct 31 court title row (D65; **on a branch**, `claude/explore-card-live`, not
  merged, not on a device). Frontend only.
  - `CourtTitleRow` (`components/court/CourtParts.tsx`): sport, name, city ·
    distance left, live On court number right. Used by `CourtListItem`, the
    drawer peek (`components/sheet/CourtSheetContent.tsx`) and the court page
    header (`app/court/[id].tsx`).
  - Explore card: no `MetricStrip`, no `LocalMark`; `hooks/useCourtHours.ts`
    removed (the card no longer shows court hours).
  - Drawer strip: Next game / Court hours · wk / Locals. `CourtSheetHost`
    tracks the expanded detent and the drawer shows `LocalMark` only there.
  - Visual QA: new `explore-drawer-expanded` screen in
    `scripts/visual-qa/screens.mjs`.
  - Follow-up after Jesse's review of the preview screenshots: court names
    back to full size (no step-down), `CourtArt` centred on the name
    (`top={-16}`), the drawer name at the court page size, the drawer strip on
    the darker `card` band with quieter 18pt values at a fixed height so units
    don't shift a cell. `LocalMark` lost its quarter-circle: a plain 44pt +
    / check placed by the caller (court page: the back-arrow row; expanded
    drawer and Home: top-right).
  - Second review: the local + / check is on the court page only (its
    back-arrow row); none on the card, drawer or Home. Home's pinned header
    (`HomeCourtHero`) is the shared title row plus Next game / Court hours ·
    wk / Locals on the card band, like the drawer; `HomeCourtTop` is gone.
    Court page art centred on the name. Strip values have a fixed height so a
    unit no longer drops its label. `nextGameLabel` moved to
    `lib/nextGameLabel.ts`.
  - `.claude/skills/ui-done` section 3 rewritten as the process: screenshot
    only what changed (preview vs live, `scripts/visual-qa/preview-shots.cjs`),
    measure spacing and alignment (`scripts/visual-qa/measure.py`), check one
    element looks the same everywhere, change only what was asked.
  - QA default (`.claude/skills/ui-done`): the PR's Vercel preview against
    `main`'s live link, only the screens the change affects.
- Oct 18 follow-up 3 (D61; **on a branch**, PR #77, not merged, not on a device;
  not checked in a render, Jesse is verifying). Frontend only.
  - `LocalMark` (`components/court/CourtParts.tsx`): corner quarter-circle with
    + / animated glowing check, a direct child of the card (court header,
    Explore card, drawer, Home's pinned header).
  - `components/court/SlotCard.tsx`: one thin row, `mode` view / plan / full;
    used by the court Week (view), Home's chart via `HourSlotCard` (plan) and
    the Schedule page (full). `CourtBusyChart` has `variant="inline"` and
    `maxBack` (Home: one set of arrows, "Most active at …", no past days).
  - Schedule page (`app/(tabs)/schedule.tsx`): all 14 hour rows fit with no
    inner scroll (row height from the window height, min 20); the Upcoming games
    row is gone; the AM/PM window arrows are gone.
- Oct 18 follow-up 2 (D60; **on a branch**, PR #77, not merged, not on a device;
  not checked in a render, Jesse is verifying). Frontend only.
  - Explore drawer (`components/sheet/CourtSheetContent.tsx`): the expanded
    detail area is a `BottomSheetScrollView`; the LocalPlus panel is top-aligned.
  - Schedule a game: `components/schedule/ScheduleGameSheet.tsx` (replaces
    `HostRunModal`), built on `RunFlowSheet`, the new shared
    `components/ui/CourtSearchPicker.tsx` (also used by `ChallengeSheet`),
    `RecentDatePicker`, `TimeStrip` and `SegmentedControl`. The optional note
    is gone.
  - Home: only `HomeCourtHero` (name + numbers) is a sticky header
    (`stickyHeaderIndices`); `HomeCourtTop` and everything else scroll.
  - `LocalMark` (`components/court/CourtParts.tsx`) replaces `LocalTag` and
    `LocalPill` (Home, Explore card, drawer, court page). `CourtLinkButton` is
    a centred ">".
  - LocalPlus: `app/localplus.tsx` retries sign-in before buying and only then
    alerts "Can't reach the store right now" (`services/purchasesService.ts`).
- Oct 18 follow-up (D59; **on a branch**, PR #77, not merged, not on a device;
  not checked in a render, Jesse is verifying). Frontend only.
  - Challenges: `lib/challengeModel.ts` `challengeAction` takes the time; an
    accepted challenge is `scheduled` (Call it off) until its game time, then
    `log_score` / `casual_on` with I missed it (`cancelChallenge`).
    `app/challenge/[id].tsx` no longer redirects to Compete; the inbox opens it
    for every open challenge (`app/(tabs)/elo.tsx`). Card text: `challengeCardLines`.
  - Home: tapping a Today bar opens `HourSlotCard` (shared `SlotCard`, also the
    court Week's card and, restyled in place, the Schedule tab's slot card).
  - Court page: `LocalPill` is an icon-only house square that only sets;
    Players ranks only players with a game here (`isRanked`); Info adds Date
    added; Schedule FAB shadow stronger; LocalPlus button keeps the price label
    when sign-in fails.
- Home and court page redesign (Oct 18, D58; **on a branch**,
  `claude/kind-pascal-4c174r`, PR #77, not merged, not on a device; checked in
  a local web render at 375x667, 393x852 and 430x932 against mocked data).
  Frontend only: no database, function or native change.
  - Home (`components/HomeScreen.tsx`): one scrolling page, no tabs. The court
    header scrolls away; Check in + Court and Here now pin at the top; Up next,
    Today and the full court feed scroll under them. The Plan | Check in |
    Court row, the Feed / Locals / Schedule tabs and `HomeCourtActions`' Plan
    button are gone.
  - Shared sections: `components/court/CourtOverviewSections.tsx`
    (`HereNowSection`, `UpNextSection`) now serve the Explore drawer and Home.
  - Feed icons (`components/ui/ActivityRow.tsx`): small solid orange dot for
    check-in, grey dot for check-out, VS for a game result.
  - Court page (`app/court/[id].tsx`): the Plan visit / Check in bottom bar is
    gone. Players is `components/court/CourtPlayersPanel.tsx`: locals only,
    Ranking / Active / Newest, record at this court, your row pinned
    (`lib/courtPlayersModel.ts`, tested in `lib/courtPlayersModel.test.mts`).
    Week is the rebuilt `components/CourtSchedulePanel.tsx` (Planned visits
    card + Today card; + and Join sit on the left; no Create a game here).
    The court header's busy chart is today only (no day arrows or caption),
    sits closer to the title, and the court trace behind it is dimmer.
  - Data: `fetchCourtRecords` (`services/courtService.ts`) reads confirmed
    `matches` + `match_participants` at the court, so a player's record is
    only what RLS lets the viewer see; `fetchLocalsWithLastCheckIn` now takes
    the court's sport (sport-specific rating) and returns `joinedAt`
    (`profiles.local_court_changed_at`, falling back to `created_at`). Both
    are reads of existing columns. Not checked against LocalCheckProd.
  - Visual QA: `scripts/visual-qa/screens.mjs` drops the Home Locals/Schedule
    rows and adds Home scrolled, Players sorted by Active and Newest, the
    Week Today card and the expanded Explore drawer. The court Week grid has
    56 cells under 44pt (seven columns cannot reach 44pt on a phone), so its
    `smallTarget` baseline went up at 375x667; see the PR.
- Pre-submission polish pass (Oct 17, D57; **on a branch**,
  `claude/kind-pascal-4c174r`, PR #77 into `main`; it carries #75, not merged, not on a device).
  Frontend only: no database, function or native change.
  - Court page header: live On court number and today's busy times on every
    tab (`app/court/[id].tsx`, `CourtBusyChart` `variant="header"`).
  - Home: house marker (`LocalTag`), Plan | Check in | Court one height.
  - Schedule tab: original court dropdown, one-row time card, games in a
    swipeable row; the page never scrolls (`app/(tabs)/schedule.tsx`,
    `ScheduledGameCard` from `components/court/CourtGamesPanel.tsx`).
  - Week heatmap (`components/CourtSchedulePanel.tsx`): readable labels,
    equal columns, shared buttons.
  - Game page: court and format shown once; result actions in the footer.
  - Drawers: `FormSheet`, `ReviewRulesModal`, `PlayerQrModal` are all
    `RunFlowSheet` / `AppBottomSheetModal` now.
  - UI definition of done (Oct 17): `.claude/skills/ui-done/SKILL.md` (Apple
    UI tips, the layout rules, UX checks) and `pnpm qa:visual`, which renders
    38 screens at 375x667, 393x852 and 430x932 against mocked data, fails on
    cut-off, clipped, overlapping or off-screen text and sideways scroll, and
    ratchets text under 11pt, contrast under 4.5:1 and targets under 44pt
    against `scripts/visual-qa/baseline.json`. Local only for now:
    the Explore drawer peek at 375x667 is flaky (about 1 run in 2).
  - Contrast: muted text #6E6E7A -> #8A8A96 (3.3:1 -> 4.8:1 on the dark
    surfaces); inactive tab labels use it; counts on the orange heatmap cells
    are dark.
  - Open for Jesse: about 500 labels per screen size are 9-10pt uppercase
    (below Apple's 11pt). Raising them is a type-scale decision, not done.
  - Fixes: game activity markers line up on web; a bare played day shows the
    right day (`parseDayOrInstant`); Me tab tabs; Settings switch thumb.
  - Onboarding welcome uses the sign-in artwork, centred on its subject.
  - Self-QA at 375×667, 393×852 and 430×932 with an automated clipped /
    overlapping text check (Oct 17): small phones scroll the week heatmap
    and Schedule tab instead of squeezing them; cut-off button and name text
    fixed; the court drawer settles on its measured height; Notifications
    uses the shared detail header.
- Court-flow UI pass, frontend only (Oct 15, D56; **on a branch**,
  `claude/court-flow-ui-pass`, not merged, not on a device). No database,
  function or native change.
  - Court drawer (`components/sheet/CourtSheetContent.tsx`) rebuilt to the
    design: sport + Your local / Set as local, centred name, city ·
    distance, On court / Court hours · wk / Locals, Check in + Court ↗.
    Expanded: Here now (4 + More), Up next (next game), Today (planned
    visits in 2-hour bars, read with `fetchCourtPlannedTimes`), Recent
    activity (3 lines), then Games / Players / Feed / Week chips that open
    the court page on that tab (`/court/[id]?tab=`). Gate: blurred content
    under "See who runs {court}", white Unlock with LocalPlus (Apple Yearly
    sheet, terms row kept) and "Or make this your local court — always free".
    The Set as local pill only sets; removing a local stays on the court
    page.
  - Explore card (`components/CourtListItem.tsx`): court art, sport, Your
    local pill, Oswald name, city · distance, On court / Court hours · wk /
    Locals. List orders live courts first (most on court), then nearest.
    Court hours for the list come from one read-only batched query
    (`fetchCourtsWeekSpans`, `hooks/useCourtHours.ts`).
  - Game page (`app/run/[id].tsx`): sport · format, Oswald title, when,
    where, Going / Avg ELO / Format strip, spots bar, Who's going (Host tag,
    W–L, ELO), details card (Teams, Level, Where, Host), white Join game;
    joined players get "You're in · Leave". Join, leave, sides, invites,
    edit, cancel and result flows unchanged.
  - Shared pieces: `CheckInButton`, `CourtLinkButton`, `SectionHead` and a
    `size` on `MetricStrip` in `components/court/CourtParts.tsx`; the court
    page and Home card use the same Check in button. `BrutalistButton`
    (every button) now uses 4pt corners, Inter bold labels, 50pt main size,
    white primary. `SectionHeader`, the shared sheet (`#121216`, 22pt
    corners, grab bar), notifications screen and Log game form restyled to
    the same tokens (new `Colors.tile`, `grabber`, `dashed`, `liveInk`,
    `inkSoft`, `checkOutDot`, `heat1–3`; `Radius.button/chip/row/panel/
    courtCard/sheet`). Orange is kept for live, check-in and selection only.
  - Checked: `pnpm typecheck`, `pnpm test`, `pnpm check:design`, web export
    compiles. Not checked: a connected preview or phone screenshots (this
    session had no `.env.local` or test sign-in).
- Second pass on the same branch (Oct 15, Jesse's feedback; frontend only,
  **on a branch**, not on a device):
  - Onboarding (`app/onboarding.tsx`): a welcome screen (check in, plan the
    week, log games), then name + sport, then Pick your court on a map
    (`components/onboarding/CourtPickerMap.tsx`: Mapbox static map fitted to
    you and the 8 closest courts, tappable pins, zooms in when location or a
    city comes back; math in `lib/courtPickerMapModel.ts` with tests), then
    a full-screen auto check-in step with the privacy explanation (only the
    150 m circle; turned on through `useAutoCheckIn().turnOn`), then alerts
    (Turn on alerts / Not now). The auto check-in sheet no longer pops up
    right after onboarding (`context/AutoCheckInContext.tsx`).
  - Player profile: one button layout per friend state (not friends: Log
    game | Add friend; they asked: Log game | Accept request; you asked:
    Cancel request | Log game; friends: remove | Log game | Challenge). Log
    game opens a sheet over the profile (`components/game/LogGameSheet.tsx`)
    instead of jumping to Compete. Head to head card is one compact row with
    the status in the middle; the existing sticky line still takes over on
    scroll.
  - Log game form moved to `components/game/LogGameForm.tsx` (Compete and
    the profile sheet share it): no repeated "Log game" title, court first,
    then the day, players, score; Hide score is no longer on the form (it
    stays on the pending game); the form clears the tab bar via TabFloor.
  - Busy times (`components/court/CourtBusyChart.tsx`, model
    `lib/courtBusyModel.ts` with tests): hour-by-hour bars for any day a week
    back to a week ahead; past hours from check-ins, later hours from planned
    visits plus players signed up for games, now in orange. Top of the court
    page's Live tab and Today in the expanded drawer. The Week heatmap stays.
  - Drawer Here now shows time on court ("38m"), from the active check-in's
    `checked_in_at` (now selected in `fetchActiveCheckIns`).
  - `StickyActionBar` restyled to the court-flow buttons.
- Third pass on the same branch (Oct 16, Jesse's feedback; frontend only,
  **on a branch**, not on a device):
  - Home: the local court is a full-width header, not a card (court art,
    sport, a Local tag hanging off the right edge, centred name, the 3-number
    strip), shorter than before. Plan / Check in / Court ↗ sit in one row
    pinned above the tab bar (`HomeCourtActions` in
    `components/ui/HomeCourtHero.tsx`); Plan opens the court page's Week.
  - Check-out label is just "Check out" with the live dot (no more
    "Checked in · Check out" spilling out of the button).
  - Feed rows (`components/ui/ActivityRow.tsx`, used by Home, the court page
    and profiles): equal-height rows, an icon tile (orange arrow in for a
    check-in, grey arrow out for a check-out or visit, the sport ball in the
    sport colour for a game, a calendar for a scheduled game), the sentence,
    a detail line ("Played 1h 40m", "Ranked"), score and short time on the
    right (`shortAgo` in `lib/activityPresentation.ts`). The rail is gone.
  - Court page Games tab cards follow the mock: time, title, faces, "x of y
    going" with a bar, Join / Going / Full (Join right from the card unless
    the game picks sides).
  - Court Info map: tilted, with the 150 m auto check-in circle drawn in
    orange with a soft glow (`lib/geofenceShape.ts`, tests), easing in on
    load. Stat values centred.
  - Explore map: legend, a slimmer Nearest button and locate-me share one
    bottom row; the live count sits top centre.
  - Inbox: a challenge that already has a logged game opens that game's
    score page (approve / dispute there), never Log game again.
  - Game score: with nothing to approve, Hide score sits at the bottom.
  - Log game: Log game button pinned above the tab bar; YOU · VS · OPPONENT
    columns with the QR scan on the right of the opponent box.
  - Challenge sheet: the day is the circle-day strip (today and the next
    days), the time a horizontal strip; `WheelPicker` removed. The chosen
    day circle is outlined in the sport colour (orange basketball, sea green
    pickleball) here and in Log game.
  - Explore card: the local court uses the same edge Local tag.
- Fourth pass on the same branch (Oct 16, before Jesse merges; frontend only,
  **on a branch**, not on a device):
  - Schedule tab (`app/(tabs)/schedule.tsx`) brought onto the court-flow
    look without touching its planning logic: court header (sport label,
    Oswald name, Change), "Who's going" label, the shared heat ramp and 6pt
    cells, white ring for the chosen slot, orange edge for the hour you're
    in. The page no longer scrolls: court, heatmap and the slot card stay
    put; only the games list (now `CourtGamesPanel`, same cards as the court
    page) or the edit summary scrolls. Each visit selects the current hour
    and moves the grid to it. `RunCard` removed (no longer used).
  - Slot card has one fixed height on both the Schedule tab and the court
    page's Week (`CourtSchedulePanel`), so tapping around never makes it
    jump; Week also scrolls to the current hour and marks it.
  - Court feeds (Home, court page): today keeps check-in and check-out as two
    rows (the check-out shows time played); earlier days collapse into one
    "played 1h 40m" row with the check-out time (`pairVisits(..,
    { splitToday: true })`, tested). Profiles still collapse every visit.
  - Explore map: the legend is one slim row centred under the live count;
    Nearest sits centred at the bottom with locate-me on the right.
  - Not built: favourite courts / switching Home between courts (needs a
    place to store favourites, so a backend change).
- Expo SDK 54 patches on #67 (Oct 14, Jesse's OK in chat): `expo` 54.0.37,
  `expo-constants` 18.0.14, `expo-updates` 29.0.20. Lockfile also moves
  `@expo/cli` 54.0.27, `expo-file-system` 19.0.24 and
  `expo-modules-autolinking` 3.0.27; nothing outside the SDK 54 patch line.
  `expo-updates` 29.0.20 rejects update assets whose name contains a path
  separator (native fix, so it only ships in a build). Checked: `npx expo
  install --check` clean, `pnpm check` passes, iOS bundle exports, and
  `expo prebuild` produces 1.0.4 with `UIBackgroundModes` fetch + location.
  expo-doctor still flags only the existing `ios.buildProperties` key, which
  was also in build 33's config.

## Current product contract

- Authentication: email/password and Apple Sign-In.
- Onboarding: a fresh signup lands on `app/onboarding.tsx` (claim username +
  pick a sport — Basketball or Pickleball, no "Both": the app has no
  both-sports concept anywhere downstream — then share location or enter a
  ZIP) before ever reaching the tabs. Gated by `lib/onboardingGate.ts` on
  profile age (≤30 min) OR the `profiles.onboarding_completed` flag — the age
  check alone guarantees no existing account is ever routed into it,
  and the `onboarding_completed` column is live. Location and push-permission prompts
  are suppressed app-wide while a profile still needs onboarding
  (`DeviceLocationProvider`'s `autoResolve` prop, `NotificationContext`'s
  push effect) — onboarding's own "Share location" button is the only thing
  allowed to trigger the native prompt during that window.
- Discovery: court list/search plus native Mapbox map. Map viewport queries are
  location-driven across market boundaries; Explore narrows market results in
  expanding geographic windows before sorting by distance. Denied/unavailable
  device location resolves to `null`, never a substitute city — Explore falls
  back to the saved local court, then an empty state prompting to share
  location or search by city/ZIP; the REGIONAL leaderboard scope falls back
  to the unscoped (GLOBAL-equivalent) board instead of anchoring on a wrong
  city.
- Presence: atomic check-in switching and server-driven expiration.
- Privacy: changing check-in visibility updates the active row and projected
  activity before the selector changes; relaunch hydrates the persisted mode.
- Schedule: planned visits and hosted runs.
- Social: profiles, friendships, persisted one-per-user activity hype, durable
  inbox notifications, production push delivery, and reversible block/report
  safety controls managed from Settings.
- Competition: sport-specific ELO and reviewed match lifecycle.
- Test data (D34): `TEST` and `REVIEWER` accounts, and test courts
  (`courts.is_test`), are hidden by RLS from every ordinary player. `TEST`,
  `REVIEWER` and `FOUNDER` see everything. Test courts: LA (Rancho Cienega,
  Cheviot Hills) and Houston (Fonde Rec, Jaycee Park). Kasmiersky Park
  (Conroe) is the one real court; other seeded courts are archived. Runbook:
  `docs/runbooks/ACCOUNT_TAGS.md`.
- Account tags: `profiles.account_tag` (`FOUNDER` / `STARTER` / `REVIEWER` /
  `TEST` / null). Only FOUNDER / STARTER show as a label or ME title.
  Server-managed.
- Challenges (D25–D27r, D50; **on #67, live backend**; the full two-phone flow
  is not yet tested): friends only, from a player's profile. Court,
  day and time required, up to 7 days ahead; unanswered ones expire at the
  game time; once accepted both players get a reminder 30 minutes before. **Ranked**: either player logs the score after, it goes through
  normal review and counts. **Casual**: just a time and place, no score,
  counts nowhere; closes with "We played" or after its day. Inbox shows them
  under CHALLENGES; notifications open `/challenge/<id>`.
- Hide score (D30): each player can hide the score for their side when
  logging, confirming, or later. Anyone outside the game then sees only who
  won. It still counts for ELO, rank, record and head-to-head.
- Game visibility (D31): a game shows outside its players only if every
  player is Public.
- Auto check-in (D35, D52, D53; **on #67, live backend, never tested on a
  device** — build 33 doesn't have it): one 150 m geofence on the
  player's local court. Arriving checks in privately and shows "Checked in at
  …" with Hide at once; 5 minutes later it posts (source `auto`, check-in time
  = arrival) with "Check-in posted"; leaving checks out at once; 1.5 hours
  after arrival it ends with "Auto checked out" / I'm still here. Offered once when a local court
  is picked (after onboarding) and in Settings → AUTO CHECK-IN. The auth
  session is stored readable after first unlock so the background task can
  call Supabase with the phone locked. A "Checked in automatically · Hide"
  line sits under the check-in button on Home and the court drawer ("Not
  here" was renamed Hide on Oct 12).
  Friend alerts need both "Share my auto check-ins" (sender) and "Friends'
  auto check-ins" (receiver) on, and never fire for Private (D37). The 1.5-hour
  backstop sends "Auto checked out" with I'm still here (D52).
- LocalPlus plans: Yearly $49.99 (preselected, "Save 17%") and Monthly $4.99,
  US only, with the auto-renew disclosure and Terms / Privacy links.
- Leaderboard membership: a profile is ranked in a sport only after ≥1 game in
  that sport (`hasRankedGame`), only with LocalPlus (`gateLeaderboard` on;
  LocalLite stays unranked, `TEST` counts as LocalPlus), and privacy
  (`visibility`) applies. REGIONAL falls back to
  the nearest court to the viewer's live location when no local court is set
  yet (`fetchNearbyCourts`, `app/(tabs)/compete.tsx`) — it used to return
  empty in that case, since the market lookup was anchored on the local court
  alone.
- Court insights gate: `app/court/[id].tsx`'s LOCALS and SCHEDULE tabs are
  blurred + locked (`CourtInsightsGate`, `expo-blur`) for any court that
  isn't the viewer's own local court, unless they have LocalPlus. This is the
  first real enforcement of that perk — `LocalPlusFlags.gateCourtInsights`
  used to be declared and marketed ("Travel Court Insights") but never
  consumed anywhere.
- Local court change cooldown: `LocalPlusFlags.localCourtCooldownDays` (7)
  is now actually read and shown (`lib/localCourtCooldown.ts`) — both on the
  court insights gate and in Settings' local-court picker — and LocalPlus
  bypasses it entirely. Enforcement is client-side only (the picker blocks
  the change and shows the remaining time); there is no server-side
  trigger yet, so it isn't hardened against a client that skips the UI.
- Realtime: private scoped Broadcast invalidation followed by authoritative
  refetch.

All durable product state comes from Supabase. There is no application API
server or local-data fallback. The Expo browser target renders this same app for
development and testing.

## Known release risks

- **Open bugs on #67, found Oct 13–14** (details in the project's PR 67 review
  doc): "I'm still here" after a *manual* check-in always calls
  `resume_auto_check_in` (`context/NotificationContext.tsx`, `auto_check_out`
  branch), which fails off the home court and starts 1.5 hours instead of 45
  minutes; the backend already sends `data.source` for the fix. Reported, not
  re-checked here: Hide doesn't stick if the app restarts while still at the
  court, and sign-out leaves the geofence running.

- **LocalPlus monetization is live and device-verified for Monthly only.**
  Every App Store row in `public.subscriptions` is the Monthly product (query,
  Oct 14); a Yearly sandbox purchase has not been seen yet. Migration applied,
  `revenuecat-webhook` deployed with a working auth secret (confirmed via a
  200 on RevenueCat's test event AND a real device sandbox purchase —
  `apply_subscription_event` writes correctly), FOUNDER + REVIEWER promo
  grants run. `app/localplus.tsx` was redesigned 2026-09-11: the primary
  action is pinned to the screen bottom (`StickyActionBar`, not floating
  mid-content), the redundant intro paragraph is gone, and perks lead with
  COURT VISIBILITY (was "Travel Court Insights" — that name and the word
  "travel" are retired everywhere, including `app/settings.tsx`'s LocalPlus
  row). Free tier is branded **LocalLite** in copy that's been touched so
  far — not yet swept across every surface.
  `useLocalPlus()` has no blanket dev-unlock fallback — a fresh account is
  genuinely locked unless a real `subscriptions` row says otherwise, with one
  named exception (`account_tag === 'TEST'`).
  Still open: Starter is automatic server-side per D12 (first 100 accounts,
  free year, no code, no auto-renew) — not built yet. Full history: `docs/runbooks/REVENUECAT.md`.
- **Settings gained self-service account changes (2026-09-11):** username
  (`public.update_username` RPC — format + a denylist-based moderation check
  + uniqueness, all server-side; not exhaustive, a starting baseline) and
  password (`supabase.auth.updateUser`, hidden for Apple-only accounts, which
  have no password). A tier badge (LOCALPLUS/LOCALLITE) now shows at the top
  of Settings; ELO was dropped from the header (redundant with the ME tab).
- **Fresh-install permission sequencing:** the push-notification permission
  request (`context/NotificationContext.tsx`) now fires ~2.5s after mount
  instead of immediately, so it doesn't visually stack with the location
  permission prompt that fires around the same point in a cold, signed-in
  launch. Both are still automatic on first launch — no onboarding carousel
  exists to defer them to a later, feature-triggered moment.
- Mapbox, push notifications, Apple Sign-In, and SecureStore require physical
  iOS verification; browser success does not prove them.
- Crash visibility: the RN `ErrorBoundary` + a global JS / unhandled-rejection
  handler write best-effort to `public.client_errors` (authenticated INSERT
  only, no user id, size-capped, 300/hr ceiling, no read access). **Submission
  action:** `app.json` now declares Crash / Other-Diagnostic data (not linked,
  not tracking) — the App Store Connect privacy answers must be set to match
  before submit. Stopgap; a real reporter (Sentry) is still recommended for
  native crashes and release-health.
- `app/auth.tsx` rejects empty email/password and enforces a 6-character
  minimum, but has **no email-format check and no password-strength rules**;
  Supabase Auth leaked-password protection (HaveIBeenPwned) is also off — a
  dashboard toggle. Client-side format/strength validation is the code gap.
- The old Add Court modal that called a dead `/api` route remains retired. The
  2026-08-11 physical attempt failed because `verify-court` was absent from
  LocalCheckProd and returned HTTP 404. The authenticated function and its
  database contract were deployed on 2026-08-12; a signed-in accepted and
  rejected live-photo test still gates production proof of the Gemini path.
- Push registration and background delivery are proven on build 14: a physical
  iPhone registered after the production OTA and received a real friend-request
  alert. Foreground routing, cold-start navigation, retry/receipt handling, and
  invalid-token cleanup still need explicit device/provider evidence.
- Account deletion is done: the in-app DELETE ACCOUNT flow (`settings.tsx` →
  `deleteCurrentAccount` → the `delete-account` Edge Function) removes the
  Supabase user and passes a fresh Apple authorization code so the function
  revokes Apple's token first. Confirmed acceptable for release by Jesse,
  2026-09-05 — no longer a release blocker.

## Pull-request quarantine

PR #25 and PR #26 were large, overlapping changes with unresolved review and
runtime risk. Do not merge either wholesale. Recover an individual change only
after restating its current product contract, rebasing it onto current `main`,
and verifying it independently.

PR #28 was consolidated into `main` and produced TestFlight build 14. PRs #25–27
remain historical/superseded inputs and must not be merged wholesale. Recover a
specific missing behavior only after verifying it against current `main`.

## Release 1 production state

- Add Court, block/report, sport-specific ELO review, three-day automatic
  confirmation, and durable push delivery have been recovered into the clean
  root-level app and covered by focused source and unit contracts.
- The approved splash artwork is present; signed-out launch uses the full
  reveal and signed-in launch completes pin → W → check in 1.6 seconds.
- Detail-header logo geometry is explicitly clipped to its requested square,
  the Me notification bell is restored while Inbox remains, and profile Log
  Game fetches an opponent by ID rather than leaderboard membership.
- GitHub CI no longer requires runner-provided `rg`. All four EAS workflow files
  validate with the Expo schema/CLI.
- Expo's connected GitHub base directory was changed from `/artifacts/mobile`
  to `/` on 2026-08-10 and visibly confirmed as saved, so EAS now resolves the
  cleaned root-level repository.
- `main` is not currently protected (still true Oct 14). PR #28 therefore
  treated explicit approval, a clean `quality` check, and a clean Codex review
  as mandatory operational gates before merge.
- Push delivery is active in LocalCheckProd. The durable delivery migration is
  applied, `send-notification` version 1 was deployed (version 5 since Oct 12), the webhook secret is held
  in Supabase/Vault, and a direct database-to-function dispatch returned HTTP
  200 before the physical friend-request alert succeeded.
- The registration fix prompts only when iOS permission is undetermined,
  repairs an enabled account with an existing grant, and respects both LocalCheck
  opt-out and iOS denial. It requests the Expo token with EAS project id
  `9c906173-0258-45a9-a3fe-786cda373c66`.
- Add Court no longer asks new submissions to classify a court as free, paid,
  or private. Existing values on all 56 courts are unchanged; new verified
  rows use a nullable field through the service-role-only
  `create_verified_court_v2` RPC. `verify-court` version 2 was active (version
  10 on Oct 14, writing through `create_live_court_submission_v4`) with JWT
  enforcement and rejects unauthenticated requests with HTTP 401.
- Block/report is active in LocalCheckProd: both RLS tables, the caller-scoped
  RPCs, blocked-relationship read filters, and social/run write guards are
  deployed.
- Connected signed-out auth/splash QA passed at 390×844 and 1280×900 with no
  overflow. Signed-in browser QA remains the fast surface for focused follow-up
  changes; native-only acceptance remains on TestFlight.

## Focused follow-up — shipped

Everything in this section landed on `main` via PRs #35, #41, #42, #44, and #45
(see "Production checkpoint" above). It is kept as a record of what those
changes covered; it is no longer pending and the "source-only / not production
behavior" caveats in the bullets below are historical.

- The Profile/Compete work implements the approved release
  references at 402×874 and 430×932 comparison viewports. Profile uses the
  canonical tab header, opens QR from the avatar, keeps Settings in the header, and
  separates actionable Inbox items from informational notifications. Compete
  uses equal-height sport/scope controls, quieter ranks, compact tier/record
  metadata, right-aligned ELO, and a same-height dimmed private-rank row.
- The same branch now keeps every primary tab on `ScreenHeader`, aligns its
  title with the 24px logo mark, orders Profile metadata as `sport · court`,
  balances Profile stat padding, and keeps Explore map controls above the tab
  bar on web and native.
- Log Game now places Court and its authoritative ranked Sport on one row,
  replaces the full native calendar with the shared compact week selector,
  supports 1v1, 2v2, 3v3, and 5v5 rosters through the same player search/QR
  selector, and uses a centered score review with an animated five-second
  auto-send trail plus equal-width Edit and Confirm actions. Player suggestions
  stay attached to the active slot, prioritize the selected court's live
  presence roster and friends, and use the shared keyboard-aware scroll owner.
- Profile Friends search now replaces the ordinary list with results directly
  beneath the search field while the keyboard is open. Settings accepts a
  five-digit ZIP and searches/saves a local court in place, without routing
  through Explore or requiring Mapbox. ZIP persistence is source-only until
  `20260829120000_add_profile_postal_code.sql` is applied.
- The 1v1 client retries the previously deployed `log_match` signature only
  when PostgREST explicitly reports that the new `p_played_on` signature is
  missing. A connected 12–4 submission was saved through this compatibility
  path on 2026-08-27; unrelated database errors are not masked or retried.
- The current source now replaces terminal `rejected` results with the
  canonical pending → held → pending/voided lifecycle in
  `20260828120000_match_dispute_resolution.sql`. The score screen has a shared
  status/countdown card, approve/dispute actions, a held-game correction sheet,
  and the complete MVP policy. This remains source-only until the prerequisite
  match/team migrations and this migration are applied in ledger order and the
  two-account flow is verified.
- Legacy pending/held rows without explicit deadline columns derive their
  three-day/seven-day countdowns from persisted timestamps. The score-review
  policy is collapsed by default and expands in place; the countdown remains
  above the canonical score card.
- Ad-hoc team submission/review/rating source is additive in
  `20260827143000_add_ad_hoc_team_matches.sql`. Team writes are not live until
  that migration and its prerequisite participant-review migration are applied.
- Score review reads no longer depend on a single nested PostgREST relationship
  query. RPC match IDs normalize both supported composite return shapes so a
  valid response cannot route to `/match/undefined`.
- TypeScript, focused backend/notification/release-model tests, design checks,
  and a fresh connected web export pass. Log Game has two current 430×932
  visual passes covering 1v1, 2v2, date-input semantics, countdown progression,
  Edit cancellation, and a saved 1v1 result. The receiving account's current
  Inbox notification opened the persisted match by `match_id` and rendered its
  0–11 review state on 2026-08-27. Native QR scanning was previously confirmed
  by the product owner and must be regression-checked in the release build;
  database migration deployment remains pending. Team submission is not
  production behavior until those migrations are applied and the native client
  is released.

- PR #35 uses the final supplied LocalCheck vector assets through the shared
  brand component. Home now matches the established mark + title treatment on
  every other primary tab. The supplied chevron remains the detail back icon;
  W/L variants remain intentionally unused. Court detail uses the source
  lockup's spacing and an edge-aligned LocalCourt label.
- Home's horizontal player roster now uses equal tokenized spacing above and
  below each tile, matching the section-header rhythm at compact and expanded
  widths.
- Player profiles now use the same 24px mark and 8px lockup gap as shared app
  headers. The compact hero omits the long username and member-since line,
  keeping the player name, local court, and ELO on one clear axis.
- Player profile content is split into `VS YOU`, `ACTIVITY`, and `DETAILS`.
  The first tab uses a visually distinct series card; Details owns member
  since, local court, global sport rank, real trailing-90-day check-in activity,
  and the existing report/block controls.

- Compete retains the `main` Local/Regional/Global behavior. The current task
  adds the missing honest sport membership rule: a saved preferred sport wins;
  otherwise the saved home court's sport is used; accounts with neither are
  excluded. Local and Regional return no rows when the viewer has no home court.
- Home's no-court `EXPLORE COURTS` action returns to rectangular button geometry.
- (Historical) These were source-only when written; all are now released on
  `main` per the PRs listed at the top of this section.

## Tracked launch feedback

This is the canonical recovery list for explicit product-owner feedback that is
not already closed by production evidence. `Source` means it exists only on the
focused branch; `pending` means no completion claim has been made.

### Profile and shared visual system

- **Current-source verified at 430×932 and 402×874:** Me and public player profiles use the
  compact shared `ProfileHero`; QR opens from the avatar, ELO is owned by the
  shared hero, and the public profile no longer uses the old `TAP FOR QR`
  treatment. Compact stats preserve space above and below the panel.
- **Current-source verified:** the Settings action uses a 16-point
  glyph inside a restrained 32-point visual container while retaining a
  44-point press target. This is owned by `ScreenHeader`, not the Me screen.
- **Current-source verified at 430×932:** friend and suggested-player rows share
  `PlayerSummaryRow`; court metadata uses one token and ELO is right-aligned.
- **Source, cross-screen acceptance pending:** Home, Schedule, Compete, Explore,
  and Profile use `ScreenHeader` with the same 24-point mark, title size, and
  optical vertical alignment. Review sibling screens whenever this owner changes.
- **Pending:** confirm Profile Activity, Friends, and actionable Inbox states at
  compact and tall iPhone sizes with no clipping or bottom-only scroll trap.
- **Pending:** informational events such as accepted requests stay in the
  notification bell; game reviews, pending friend requests, and future game
  invites stay in the actionable Profile Inbox.

### Home, Explore, Schedule, and sheets

- **Pending:** Home court-card sport/city tags need tighter corner placement;
  unchecked Check In and View Court actions must have identical geometry.
- **Pending:** Home Locals rows need smaller side gutters, one typography set,
  and no clipped identity or metadata text.
- **Source, release-gated:** Settings accepts a ZIP and provides direct court
  typeahead/local-court selection without opening Explore. The profile ZIP
  migration is applied (live ledger, Aug 30). **Pending:** add the explicit device-location
  toggle and make Explore list/map consume the same resolved location instead
  of silently defaulting to Los Angeles.
- **Pending:** Explore must show all courts for the resolved city, keep the
  Active Now/sport legend above the bottom tab bar, and restore a low-profile
  nearest-active-court action centered above that bar.
- **Pending:** Schedule's canonical `SpeedDialFab` must remain compact and
  anchored above the tab bar. Its actions are `Add times` and `Create run`; the
  oversized/disconnected `Schedule game` menu is not the product contract.
- **Pending:** Court and run drawers must use the shared
  `AppBottomSheetModal` owners already used by Schedule; no parallel sheet shell.

### Competition, release, and operations

- **Current-source verified:** notification `match_id` maps to
  `AppNotification.matchId`, routes to `/match/<matches.id>`, and the receiving
  account rendered the persisted score review. The old one-shot nested
  PostgREST read could collapse a valid match to `SCORE NOT FOUND`; the current
  required-row-first read removes that failure coupling.
- **Source, release-gated:** Log Game includes the compact current/previous-week
  date selector, inline keyboard-aware player typeahead, QR selection, equal
  review actions, five-second animated review, and team-format source. The team
  migrations are applied (live ledger, Sep 3); one complete 2v2 lifecycle on
  two accounts is still required before calling team logging tested.
- **Pending:** preserve the already-working 1v1 notification path while testing
  edit, confirm, object, auto-confirm, and score-history states on two accounts.
- **Pending:** restore green GitHub/Expo workflow evidence and review open PRs
  for superseded overlap before merge. Dependabot updates are not launch fixes
  merely because their timing overlaps a workflow regression.
- **Release-gated:** none of the focused-branch changes are in TestFlight until
  the branch is pushed, its PR is approved/merged, migrations are deliberately
  applied, and the documented iOS build/submission workflow completes.

## Immediate gates

1. Fix the open #67 bugs above that Jesse approves, then merge #67 and run one
   TestFlight build (1.0.4).
2. On that build: auto check-in (arrive, Hide, leave, 1.5-hour checkout),
   manual check-in checkout at 45 minutes, and a challenge sent, accepted and
   reminded on two phones.
3. Exercise one accepted and one rejected Add Court live photo on a signed-in
   iPhone; verify the accepted court appears and the rejection inserts nothing.
4. Complete foreground/cold-start push routing plus receipt/retry/invalid-token
   evidence without reopening the already-proven registration path.

History: until Oct 14 gate 1 read "apply the participant-review, game-date and
ad-hoc-team migrations"; all three were applied Sep 3 (live ledger).

## Next-agent starting point

- Until #67 merges, begin from `codex/auto-check-in` (PR #67); `main` is
  older. Do not resume PR #25, #26, or #27.
- The installed baseline is TestFlight `1.0.3` (33), Sep 14 (EAS build list,
  Oct 14). Build 14 was the August baseline.
- Push token registration and one background friend-request delivery are
  verified. Preserve that path while completing the remaining native matrix.
- Small visual follow-ups must improve the shared owner named in
  `docs/product/DESIGN.md`, include browser and iPhone evidence, and avoid
  introducing a parallel component or token.
