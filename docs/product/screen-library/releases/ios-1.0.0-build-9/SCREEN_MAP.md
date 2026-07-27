# iOS 1.0.0 (Build 9) Screen Map

Status: Capture in progress
Captured: 2026-07-26
Distribution: TestFlight
Source: `jGPT-Automated/LocalCheck_Expo` `main` at `249c926`, tag `v1.0.4`
Backend: LocalCheckProd (`qkrnmyexzvaxiqfxwwfb`)

## Release purpose

This is the pre-UI-pass baseline containing the current native Mapbox build and PR #19's scoped Postgres Changes implementation. It is the comparison point for the upcoming Broadcast migration and collaborative redesign.

## Flow map

```text
Signed out
└── Sign in / Create account / Sign in with Apple
    └── Home
        ├── Find a court empty state
        ├── Explore courts
        │   ├── Court list
        │   ├── Court preview sheet
        │   └── Full court profile
        ├── Schedule
        ├── Compete
        │   ├── Local / Regional / Global leaderboard
        │   ├── Player profile
        │   │   ├── Add Friend (broken in build 9)
        │   │   └── Log Game
        │   └── Log Game form
        └── Me / Profile / Settings
```

## Screenshot index and current observations

| # | Area | Screen/state | Screenshot | Current observation |
| --- | --- | --- | --- | --- |
| 00 | Distribution | TestFlight update available | `screenshots/00-testflight-update-available.png` | Confirms build 9 reached Jesse's tester account. Internal release evidence; contains account imagery and is not a marketing asset. |
| 01 | Auth | Sign in | Pending capture | Email/password, Create Account, and Apple Sign-In share one screen. |
| 02 | Home | No home court | Pending capture | Central `Find a Court` empty state leads to Explore. |
| 03 | Home | Password-save system prompt | Pending capture | OS prompt obscures the empty state; internal evidence only. |
| 04 | Explore | Court list, no home court | Pending capture | Nearest court and nearby courts use different card densities. |
| 05 | Explore | Court list, checked in / home court | Pending capture | Check-in and home-court states alter the primary actions. |
| 06 | Explore | Court preview sheet | Pending capture | Bottom sheet exposes Check In, Set Local, people, and Full Court Profile. Its shell does not visually match the app's form sheets and feels unnatural on mobile. |
| 07 | Court | Full court profile, empty activity | Pending capture | Current long-scroll structure mixes identity, counts, live roster, upcoming runs, details, and sticky Check In. Approved working direction is a stable summary plus Feed, Locals, and Details tabs. |
| 08 | Compete | Local and regional leaderboard | Pending capture | Rank filters and hidden-user/LocalPlus states are mixed into the same surface. |
| 09 | Compete | Log Game form, empty | `screenshots/09-compete-log-game-empty.png` | Court, sport, opponent, score, notes, and disabled submit are visible. |
| 10 | Player | Public profile | Pending capture | Add Friend and Log Game actions appear at the bottom. **Add Friend does nothing in build 9; it previously worked.** |
| 11 | Schedule | Weekly availability grid | `screenshots/11-schedule-weekly-grid.png`, `screenshots/11b-schedule-slot-selected.png` | Current build selects one slot at a time and surfaces a separate confirmation card. Approved direction is a multi-select `Edit My Times` mode with one `Done` action. |
| 12 | Me | Profile/settings routes | Pending capture | Not yet captured in this batch. |
| 13 | Map | Native map, markers, selection, sheet | Pending capture | Highest-priority physical quality check for build 9. |
| 14 | Schedule | Host a Run form | Pending capture | Current page-sheet form uses custom day and time grids and feels unintuitive. Replace with standard native date/time controls and the shared modal shell. |
| 15 | Home/Court | Navigation transition capture | `screenshots/15-home-court-layout-overflow.png` | Build-9 checkpoint evidence showing Home and Court surfaces during a navigation transition. Review transition containment and edge behavior; do not use as marketing art. |
| 16 | Compete/Player | Navigation transition capture | `screenshots/16-compete-profile-transition-overflow.png` | Build-9 checkpoint evidence showing Compete and Player surfaces during transition. Review horizontal containment and back behavior. |
| 17 | Map | Add a Court — step 1 | `screenshots/17-add-court-safe-area-overlap.png` | Large unused top region before the form makes the presentation feel detached and wastes mobile space. |
| 18 | Map | Annotated map direction | `screenshots/18-map-layout-annotations.png` | Jesse's working direction: retain the shared Explore header, make List/Map the primary view switch, and remove redundant banner, legend, and floating add affordances. |
| 19 | Map | No courts in area | `screenshots/19-map-empty-state.png` | Honest empty state exists, but the screen loses Explore context and leaves the legend/add controls competing with the message. |
| 20 | Explore | Annotated court sheet terminology | `screenshots/20-court-sheet-terminology-annotations.png` | Jesse flagged inconsistent Check In/on-court/visit/live/active terminology and duplicated counts. Requires one product vocabulary and one source for live presence. |

## Known functional failures

### Add Friend does not work

- Surface: another player's Profile screen.
- Expected: tapping `Add Friend` creates or reflects the friendship/request state and updates both relevant clients.
- Actual: the button produces no visible result in build 9.
- Regression: Jesse confirms this action worked in an earlier release.
- Required follow-up: trace the button handler and current LocalCheckProd friendship contract; include it in the two-client Realtime/Broadcast acceptance flow.

## Cross-screen UI and accessibility defects

### Scrolling content enters the iOS status area

- Observed: when an entire page scrolls, headings and body content travel behind the time, Dynamic Island, signal, Wi-Fi, and battery area.
- Why this fails: the app is not protecting the top safe area or containing scrolling beneath a stable screen header. This harms legibility and makes the interface feel unfinished.
- Expected baseline: account for both top and bottom insets. ScrollView, FlatList, and SectionList should use automatic inset adjustment where appropriate, or an explicit safe-area/header structure when the screen design requires it.
- Audit scope: inspect every route for safe-area handling, scroll ownership, fixed versus scrolling headers, tab-bar clearance, keyboard avoidance, and modal/sheet insets.

### Required table-stakes audit for every mapped screen

- safe areas and Dynamic Island/status-bar clearance;
- 44-point minimum interactive targets and adequate spacing between targets;
- readable type size, Dynamic Type behavior, and no clipped or hidden text;
- contrast and state communication that does not rely on color alone;
- accessible names, roles, focus order, and screen-reader announcements;
- predictable back, tab, modal, sheet, and scroll behavior;
- loading, empty, populated, disabled, error, offline, and reconnect states;
- keyboard and form behavior, including input focus and submit feedback;
- reduced-motion behavior and purposeful motion only;
- consistent components and terminology across routes.

### Primary tab headers lack a coherent identity

- Observed on Schedule: the small mark, generic heavy `SCHEDULE` title, and top-right profile avatar read as unrelated elements.
- Approved working direction: pair the mark and current tab title as one lockup on every primary tab; style the title with the same typographic system as the LocalCheck wordmark.
- Remove the header avatar. The bottom `Me` tab already provides profile navigation.
- The final font is still undecided; this rule establishes token and composition consistency, not approval of the current heavy display face.

### Schedule availability is too confirmation-heavy

- Current behavior: tap one grid square, review/confirm that individual selection, then repeat for every planned time.
- Approved working direction: default shared heatmap plus `Edit My Times` multi-select mode. Tap multiple slots, tap again to remove, then `Done` once.
- Preserve both layers in edit mode: the player's pending choices and the group's existing heat.
- Save failures must retain pending edits. Successful saves must update other active clients through the approved Broadcast path without tab switching.

### Schedule scroll and hierarchy are inconsistent

- Positive baseline: the Schedule header remains fixed and does not scroll behind the iOS status area.
- Defect: the remaining page has awkward vertical scrolling; scroll ownership and content height do not feel intentional.
- Defect: title, date range, day/time labels, heatmap legend, selection summary, section heading, empty-state text, and actions use inconsistent size, weight, tracking, padding, and emphasis.
- Required direction: use one named type ramp, shared horizontal gutters, and a deliberate spacing rhythm. Only the content region scrolls, and only when necessary.

### Home people row breaks under real names

- Defect: a long one-word player name is visibly cut off in the compact Who's Here row.
- Defect: the terminal `View All` control is a larger bordered card than the adjacent player tile, so the row loses rhythm and implies the secondary action is more important than a person.
- Required direction: equal-width/equal-footprint person and View All tiles; single-line tail truncation in the compact row; full name for accessibility and on the player profile; two-line handling where the context has room.
- Scope: hard-polish the whole module—alignment, label baseline, spacing, tap targets, friend/hidden states, overflow, empty state, and horizontal-scroll ending—not only these two symptoms.

### Court preview and task-form sheets are inconsistent

- Current court preview: `@gorhom/bottom-sheet` with fixed 46% and 92% snap points, a small-radius bordered shell, and in-sheet scrolling.
- Current Host a Run: React Native `Modal` with `pageSheet`, a different header/close treatment, and custom day/time grids.
- Defect: both presentations feel independently styled and neither reads as a polished, natural mobile pattern in build 9.
- Required direction: retain the proven bottom-sheet primitive for quick contextual court information and use a standard modal/form presentation for creation flows. Unify the visual shell, safe-area behavior, keyboard handling, title/close grammar, motion, and scrolling.
- `Host a Run` specifically uses Expo-supported native date/time pickers instead of custom day/time grids.

### Accent and component values drift across screens

- Canonical identity accent is `#FF5500`, but build 9 also contains alternate sport/error/accent-like values and duplicated component styling.
- Required direction: one brand orange and shared semantic tokens. Sport labels do not create a second orange theme. Green/red remain limited to live/success/win and destructive/error/loss.
- Audit every hard-coded product color and every locally styled button, field, tab, card, sheet, and header before approving the component system.

### Court page is one long mixed-content scroll

- Current structure combines live roster, upcoming runs, venue details, and actions in one vertical page.
- Approved working direction: court identity/live summary and primary action above a tab view with `Feed`, `Locals`, and `Details`.
- Feed contains court activity and upcoming runs; Locals contains the court community; Details contains verified venue/access information.
- Preserve tab state and scroll position; make the court tab bar sticky/reachable without competing with the global bottom tabs.

### Map loses Explore context and duplicates controls

- Build 9 opens a separate map surface with a floating back button instead of retaining the shared Explore identity.
- The map includes a `NO LIVE COURTS IN VIEW` banner, a Map/List segmented control, a three-item legend, locate action, and floating add button; the combined chrome competes with the map and the courts themselves.
- Jesse's annotated direction: keep the shared mark + `EXPLORE` header and promote `List` / `Map` to the main view tabs. Remove controls that duplicate status or navigation; decide the Add Court entry point as part of the shared Explore flow rather than leaving an unexplained floating plus.
- The empty map state should preserve Explore navigation and give one useful next action without crowding the map.

### Presence terminology and counts are inconsistent

- The court sheet currently mixes `LIVE`, `ON COURT`, `VISITS`, `ACTIVE`, `WHO'S HERE`, and `CHECK IN` in one compact surface.
- `On court` and `active` can describe the same live presence twice, while `visits` reads as a lifetime/history metric but sits beside current-state numbers.
- Required direction: define and use one vocabulary across cards, sheets, court pages, and activity—`Check in` for the action, `Here now` for current presence, `Locals` for home-court community, and an explicitly labeled historical metric only where it helps a decision.
- Every displayed count must trace to one canonical data meaning so duplicated UI cannot disagree after realtime events.

## Realtime baseline

- Build 9 subscribes with `postgres_changes`, not Broadcast.
- Physical-test signal: Jesse reports build 9 feels substantially more realtime than the older polling/tab-switch experience. Preserve this gain; do not confuse it with completion of the Broadcast migration.
- Required observation: whether check-in, court counts/rosters, planned visits, runs, friendship state, and game results update on a second active client without tab switching.
- Do not call Realtime complete until the Broadcast migration and two-client plus two-phone tests pass.

## Marketing-use notes

- These captures are valuable composition and product-story references for the website and App Store screenshots.
- Test usernames, hidden states, zero-data states, location, time, battery level, and system prompts must be reviewed or replaced before public use.
- Final App Store frames should tell one benefit per image and use current, truthful product behavior.
