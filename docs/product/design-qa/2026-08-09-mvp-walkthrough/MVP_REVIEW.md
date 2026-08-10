# MVP Visual and Interaction Review

Status: connected MVP interface pass implemented; visual acceptance in progress
Review ID: `MVP-WALKTHROUGH-01`
Captured: 2026-08-09

## Authority

This document is the cleaned product direction from the owner's 25-minute
walkthrough of authentication, Home, Court, Run, Schedule, and Compete. Where
an older design document describes a behavior or layout that conflicts with
this walkthrough, this review wins for the MVP polish pass and the older
document must be corrected during implementation.

The existing app is functionally valuable and its core interactions work. This
pass is not a frontend rewrite, SDK migration, or wholesale backend redesign.
It replaces weak presentation, information hierarchy, layout, and interaction
patterns inside the current SDK 54 application. Small backward-compatible data
contract additions are allowed when the approved experience genuinely requires
them; old documentation is not a reason to preserve a bad product decision.

## Product outcome

LocalCheck must feel like a social place players want to revisit, not a utility
that is opened only to tap Check In. The MVP presentation should make it easy
and pleasant to answer:

- Who is here now?
- Who comes here regularly?
- What is happening next?
- When are people planning to play?
- What changed recently?
- How do I join, check in, or organize a run?

## Final annotated pass — 2026-08-09

The owner's final 34-point browser review is now the acceptance authority for
this branch. The implemented cross-screen decisions are:

- Home court identity is full-width and uses the supplied graphite gradient,
  quiet sport tint, an outline library sport emblem, and a compact filled-star
  local label instead of a dark standalone card.
- Explore retains compact court cards and uses the same sport selector as
  Compete. The local star is filled.
- Activity uses one shared centered timeline rail: line above and below each
  node, solid check-in nodes, hollow checkout nodes, and orange game nodes.
- Court removes the duplicate sport/full-name strip. Its fixed header reuses
  the real LocalCheck mark as the back action, the shorthand court name, and an
  unboxed star. Schedule is read-only and non-scrolling; Details includes a
  styled Mapbox preview.
- Schedule is the only surface that edits local-court availability. Its root
  viewport does not scroll and its NativeCN-derived speed dial exposes `Add
  times` and `Create run`.
- Compete uses the same compact selector component as Explore and moves Log
  Game to the same reachable speed-dial component.
- Player identity is centralized in `PlayerAvatar`: two-letter normalization,
  ranked glow, one anchored friend badge, and no scattered award icons.
- Me shows notifications inline, removes the bronze hero pill, uses shorthand
  court names, keeps ELO centered, provides inline username search, and suggests
  recent opponents before active locals.
- QR deep links now escape safely to the tab app when there is no navigation
  history.

### Verification record

- `pnpm typecheck`: pass.
- `pnpm test`: 13/13 pass.
- `git diff --check`: pass.
- `scripts/doctor.sh`: pass; Watchman, EAS CLI, and Supabase CLI remain optional
  local-tool warnings rather than application failures.
- Fresh Expo web export: pass with production Supabase project host embedded.
- Preview routes `/`, `/auth`, `/court/:id`, `/schedule`, `/compete`, `/elo`,
  and `/explore`: HTTP 200.
- Production Supabase: court read, `short_name`, QA sign-in, authenticated
  profile read, notification inbox read, and sign-out all pass.
- Automated screenshot inspection in the Codex in-app browser is blocked by
  its admin localhost security policy. No alternate browser or policy bypass
  was used. Final visual acceptance therefore remains an owner appshot pass
  against the refreshed port-8081 preview.

The interface should feel premium, athletic, legible, intentional, and
delightful through small interaction details. Valuable information and social
activity should be easier to scan than the current repeated metrics and
all-caps event strings.

## Preserve

- Existing Supabase-backed product behavior and multi-user synchronization.
- Apple Sign-In and working authentication behavior.
- Atomic Check In/Check Out behavior and server auto-checkout.
- The working availability heatmap concept.
- Joining a run and the existing scheduled-run data model.
- Court-local Feed, Locals, Schedule, and Details concepts.
- Last-active information for court locals.
- LocalCheck graphite/orange identity direction.
- The useful parts of tabs for separating court information.
- Current TestFlight build as the rollback checkpoint.

## Replace across the application

### Stable application shell

- Primary-tab headers use one height, safe-area treatment, mark size, title
  baseline, and horizontal gutter.
- A back button cannot resize the mark or push the destination title into a
  different header grammar.
- Root screens use a fixed `flex: 1` viewport. Only the content region intended
  to move may scroll.
- Persistent tabs and primary actions do not drift or disappear because an
  entire page was placed in an unbounded `ScrollView`.
- Navigation into a court or run gets a short, crisp transition that makes the
  hierarchy understandable without theatrical motion.

### Shared component language

Create one implementation for each of these before screens fork variants:

- application header;
- screen/section header;
- court summary;
- metric/stat treatment;
- person/avatar tile;
- activity item;
- run preview card;
- run detail summary;
- tab/segmented control;
- primary and secondary action;
- contextual bottom sheet;
- focused form modal;
- empty/loading/error state.

Cards must not become the default container for every section. Use spacing,
dividers, typography, lists, and fixed regions when they communicate hierarchy
more clearly. When a card is appropriate, its alignment, spacing, radii,
states, and content model are shared across Home, Court, Run, and Schedule.

### Information hierarchy

- Do not repeat the same active-player count in the global header, court
  summary, and Who's Here section.
- Do not rely on learned ambiguity such as `3 THIS WEEK` or an unexplained
  orange dot.
- Labels describe the value directly and concisely.
- Person, action, place, and time are visually separable in activity text.
- Timestamp metadata is subordinate to the action.
- Orange communicates LocalCheck identity or a meaningful active/action state;
  it does not mark the newest arbitrary row.
- Metadata that should be assumed, such as `LOCAL TIME`, is removed.

## Screen requirements

### Authentication

#### Keep

- Email/password and Apple authentication behavior.

#### Change

- Replace the oversized/thick launch mark with the approved refined mark when
  supplied.
- Use the approved display/body fonts consistently.
- Remove the `Know who's running. Show up. Rank up.` copy. If authentication
  needs supporting copy, use the existing concise direction `Know before you
  go.` rather than inventing another campaign line.
- Remove explanatory cloud-persistence copy; synchronization is expected
  product behavior, not a selling point.
- Verify that both text fields use the same intended surface/state tokens.
- Use a conventional mobile authentication composition: identity and concise
  value proposition above, inputs and actions in a reachable lower region,
  with deliberate use of the full viewport.
- Keep Sign In, Create Account, and Apple Sign-In visually distinct without
  floating as an arbitrary block at screen center.

### Home

#### Global header

- Align the mark and header content on one baseline.
- Remove the redundant `N ACTIVE` global count unless later testing proves a
  distinct global presence value is useful.

#### Local-court summary

- Replace the current local-court card presentation.
- Remove the large `MY LOCAL COURT` pill. If local-court identity needs a cue,
  use a compact symbol with an accessible label.
- Remove the decorative background art and disconnected top/bottom borders.
- Replace the hand-drawn sport icon treatment with a precise vector/symbol or a
  subtle sport-specific texture that does not retheme the app.
- Align sport, court name, address, and metrics on a coherent grid.
- Prevent metric values from clipping behind rules or card boundaries.
- Reconsider the metrics. `Active now`, `Locals`, `Runs`, and `This week` may
  not all deserve equal weight, and `This week` is not a meaningful label.
- Keep Who's Here as the direct social proof. Avoid presenting the same count
  above it unless the duplication adds a distinct meaning.
- Make entry into the court detail feel like opening the court, not pressing an
  isolated square chevron.

#### Check In

- Make the primary action reachable with one hand.
- Do not assume the current full-width action at the top of the content is the
  final placement.
- Make checked-in state and Check Out behavior explicit enough that the user
  does not need to guess whether tapping again checks out.
- Keep server auto-checkout. A configurable auto-checkout duration is a later
  product task, not part of this visual slice.

#### Who's Here

- Use a stable section title with an explicit count.
- Replace the ambiguous `VIEW ALL 7` treatment with a recognizable action.
- Person tiles need a stronger identity system than one generic initial.
- People listed here are present now; do not repeat `ACTIVE NOW` beneath every
  name.

#### Next run

- Replace the current one-off card and its orange side stripe.
- Do not let organizers enter arbitrary run titles as the primary identity.
- Derive the display name from structured game format and access rules:
  - basketball: `1v1`, `2v2`, `3v3`, `4v4`, or `5v5`;
  - pickleball: `1v1` or `2v2`;
  - access: open, private, or rating-limited when applicable.
- Date/time, court, format, attendance, and access state must scan without
  opening the run.
- Use the same run preview component on Home, Schedule, and Court.

#### Activity

- Give court activity materially more useful viewport space.
- Do not constrain the only scrollable content to roughly the bottom third of
  the screen.
- Use pagination or progressive loading rather than a permanently tiny region
  or an unbounded initial fetch.
- Make each activity item quickly readable: person, action, and time have
  distinct visual roles.
- Replace the disconnected circle/dash timeline treatment.
- Do not color only the newest row orange unless that color communicates a
  user-relevant unread/live state.

### Court

- Replace the duplicated Home-like court card.
- Keep court identity and a compact action/status region stable while tab
  content changes.
- The summary may collapse intentionally during scroll, but must not simply
  disappear because the whole screen scrolls.
- Tabs are useful, but the final information architecture must remove
  redundancy between Home and Court.
- Home should answer `what matters now at my court`; Court should expose deeper
  Feed, Locals, Schedule, and Details information.
- Feed uses progressive loading and retains scroll position.
- Locals prioritize name, recognizable identity, and last visit; rating may
  remain but should not create a large empty center in each row.
- Remove redundant `HERE` and `CHECKED IN` labels.
- Fix the metric alignment and remove decorative orange rings around person
  tiles.

### Run detail

- Replace the current asymmetric title/metadata composition.
- Use equally sized metadata chips when their roles are peers; do not mix
  mismatched Basketball and All Levels chip heights.
- Remove unexplained live decoration.
- Make when, where, format, access, and time-until-run immediately clear.
- `Going` and `Spots left` should not consume two equal summary columns if one
  concise capacity statement communicates both.
- The attendee layout should use the available width and recognizable person
  identities.
- Keep team assignment/autobalancing out of this MVP. The information model
  should not prevent a future auto-balance option based on rating.
- Joining a run must be reflected clearly in Schedule.

### Schedule

#### Preserve

- The shared availability heatmap.
- Batch selection of multiple personal time slots.
- Visibility selection.
- Upcoming scheduled runs.

#### Heatmap presentation

- Distinguish the user's selected availability from aggregate group intensity
  without hiding either state.
- Replace the muddy current orange ramp with an accessible, intentional scale.
- Highlight the current day and current time consistently on their respective
  axes.
- Put the heat legend in the conventional/readable location and align it with
  the grid.
- Remove `LOCAL TIME` and instructional copy that restates an obvious tap.
- Make the selected cell's day/time relationship unambiguous without simply
  enlarging small text.

#### Selection detail

- The detail area below the heatmap keeps a stable footprint across empty,
  other-people, and `you are going` states.
- Selecting cells must not make the page jump or push Upcoming Runs up and
  down.
- Personal attendance and removal are explicit states/actions.
- The view/edit control must be a standard, understandable mode switch.
- Visibility controls must not unexpectedly reflow the entire screen.

#### Court selection and sheets

- Replace the current broken-looking, full-height drawer shell.
- Court selection provides the current court plus a short list of nearby
  courts before search.
- Search remains available but is not the only efficient selection path.
- Use one shared, safe-area-correct sheet/modal shell with intentional maximum
  height, corners, backdrop, keyboard behavior, and dismissal.

#### Upcoming runs

- Use the shared Run Preview component.
- Participant identity cannot depend only on a generic single-letter tile.
- Keep attendance stacks compact and recognizable.

### Compete

- Do not stack Leaderboard/Log Game, Local/Regional/Global, and sport controls
  as three competing tab systems.
- Keep quick access to Log Game, but present it as an action or a separate
  focused route rather than a peer navigation tab if that reduces hierarchy.
- Preserve leaderboard scope behavior and logging logic while redesigning the
  information architecture in a later slice.

## Person identity direction

The MVP needs a more recognizable fallback when no profile photograph exists.
A person identity may combine initials with a selected symbol, pattern, or
controlled visual trait. It must remain readable at small sizes and cannot
imply a real photograph. The same identity follows the person across Home,
Court, Run, Feed, and Compete.

This is a small bounded system, not unrestricted avatar generation. It needs a
defined accessible name and deterministic fallback.

## Motion direction

- Use motion to explain hierarchy, confirmation, and state change.
- Court and run navigation should feel like entering more detail.
- Check In, join, leave, and selection changes get subtle confirmation.
- Headers, cards, or rows must not bounce or resize unpredictably.
- Prefer opacity/transform motion with restrained durations and easing.
- Respect Reduce Motion and keep the no-motion state fully understandable.

## Styling implementation gate

NativeWind is optional infrastructure, not a rewrite requirement. The supplied
`Mobile-experiments` reference contains Expo SDK 54 / React Native 0.81.5 /
NativeWind 4.2.6 / Reanimated 4.1.1 examples matching LocalCheck's current core
runtime. Before adopting it, prove one LocalCheck primitive on web and physical
iOS while existing `StyleSheet` screens continue to work. If that narrow gate
fails or creates disproportionate tooling friction, build the same shared
components with the existing tokenized StyleSheet approach and keep moving.

SDK 56/57 repositories remain valid interaction and composition references.
Their code is not pasted blindly into SDK 54; compatible behavior is rebuilt
using LocalCheck's installed runtime and shared components.

## MVP boundary

### Now

- Shared fixed viewport/header/content shell.
- Shared typography, spacing, dividers, and action primitives.
- Shared court summary, run preview, activity row, person tile, and sheet shell.
- Authentication composition cleanup.
- Connected Home → Court → Run presentation.
- Schedule heatmap and selection-layout cleanup.
- Consistent Run previews across Home, Court, and Schedule.
- Browser and physical-iPhone verification with two signed-in users.

### Later

- Configurable auto-checkout duration.
- Team assignment and rating-based auto-balancing.
- Final profile-image/upload system.
- Broader Compete restructuring after the shared foundation proves itself.
- Optional decorative motion or experimental components that do not serve a
  specific user action.

## Implementation slices

### Slice 1 — Shared shell and component gallery

Create the stable header/viewport, typography roles, section header, action,
court summary, run preview, activity item, person tile, tab/segmented control,
sheet shell, and transition primitives. Prove their meaningful states in a
development-only gallery before feature screens depend on them.

### Slice 2 — Authentication and Home

Apply the shared system to authentication and Home. Preserve auth, check-in,
presence, run, and feed behavior. Produce a browser and iPhone comparison using
the same account state.

### Slice 3 — Court and Run

Remove Home/Court duplication, stabilize the Court header/tab behavior, apply
the shared activity/person components, and replace Run detail presentation.

### Slice 4 — Schedule

Apply the stable screen shell, redesign the heatmap states and selected-slot
region, standardize the run preview, and replace the court-selection sheet.

### Slice 5 — Compete information architecture

Remove nested navigation layers and apply the proven shared components without
changing leaderboard or game-logging behavior.

## Acceptance criteria

- Primary headers remain the same height and baseline across tabs and detail
  routes.
- No primary screen uses an accidental full-page `ScrollView` when a fixed
  region plus a bounded list is intended.
- Home does not show the same presence number three times.
- Court and Home have distinct purposes without duplicate summary screens.
- One Run Preview renders consistently on Home, Court, and Schedule.
- Schedule selection does not resize the lower page unpredictably.
- Personal heatmap availability is identifiable without tapping every cell.
- Check In, Check Out, join, leave, and navigation states are explicit.
- Person identity is recognizable and consistent across the connected journey.
- All changed controls meet 44x44 touch targets and provide accessible names.
- Reduce Motion preserves navigation and state meaning.
- Existing signed-in, multi-user, check-in, run, Schedule, and Realtime behavior
  continues to work.
- Browser and registered-iPhone screenshots show the same hierarchy at the same
  meaningful state.

## Evidence

- [Two-account Home comparison](screenshots/home-multi-account-side-by-side.png)
- [Home with two active players](screenshots/home-two-active.jpg)

## Implementation checkpoint — connected MVP interface pass

The connected visual-polish pass is implemented on `codex/mvp-visual-polish`.
It deliberately stays on Expo SDK 54 and preserves the existing Supabase,
presence, check-in/out, run, feed, leaderboard, friendship, and routing
behavior.

Completed in this pass:

- one fixed-height tab header grammar and bounded screen viewport;
- shared section dividers, semantic surfaces, touch targets, and motion tokens;
- deterministic player identities plus shared person, rating, sport-emblem,
  metric-dashboard, activity, sticky-action, and QR components;
- a simplified Home court card with a native map action, consistent local
  rows, progressive activity, and no duplicate upcoming-run summary;
- semantic activity rails: solid check-in, hollow check-out, orange game,
  readable sentence case, subordinate timestamps, and score-aware game rows;
- a distinct Court route with a fixed six-metric dashboard, fixed tabs,
  independently scrolling tab content, progressive feed loading, 90-day
  active-local treatment, Schedule heatmap, and complete Court Details;
- one shared locals/player row with consistent names, last-visit metadata,
  check-in count, rating treatment, inactive state, and ranked distinction;
- Compete simplified to one leaderboard hierarchy with a compact court picker
  and Log Game moved from a peer tab into a focused native sheet;
- equal-width sticky Player actions and Log Game deep links that open the sheet
  with the selected opponent;
- notifications moved into the Me navigation with an unread badge and an Inbox
  entry;
- a stable per-player QR deep link, available by tapping the profile avatar,
  for quick friend and Log Game access without a database field;
- decorative hand-built sport artwork and obsolete Home summary/action
  components removed rather than preserved behind compatibility layers.

Verification completed:

- all presentation, deterministic-identity, and Realtime hub tests pass;
- TypeScript passes with no emit;
- a production-style Expo web export completes with the existing authenticated
  environment;
- the production Supabase Auth endpoint is reachable and a disposable QA
  account (`codex.qa.1786285231370@example.com`) completed sign-up, sign-in,
  profile-trigger creation, and sign-out successfully;
- Home, Auth, and Court routes return successfully from the no-cache preview at
  `http://127.0.0.1:8081/`.

Deliberate contract boundary:

- the production `log_match` RPC remains the authoritative atomic 1v1 write and
  currently records the server time. Team participants and a user-selected
  historical played-at value require a reviewed migration plus RPC extension;
  the interface does not pretend those values are persisted or replace the
  working transaction with several unsafe client writes.

Still pending before this pass is accepted as real-device evidence:

- visually review the authenticated browser state and capture corrections;
- verify safe areas, sticky actions, QR camera handoff, haptics, interactive
  back gesture, sheet keyboard behavior, and bounded scrolling on the
  registered iPhone;
- extend and test the match RPC only if historical/team logging is retained in
  the MVP acceptance boundary;
- create the review commit and update the existing pull request after visual
  acceptance.
