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
  `LogoMark` + title treatment. Detail pages use `DetailHeader`, whose
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
| Surface           | `#151519` | Standard surface                                  |
| Surface high      | `#1E1E26` | Selected or elevated surface                      |
| Border            | `#28282F` | Hairlines and structure                           |
| Primary text      | `#F2F2F6` | Headlines and primary copy                        |
| Secondary text    | `#9A9AAA` | Supporting copy                                   |
| Muted text        | `#72728A` | Timestamps and metadata                           |
| LocalCheck orange | `#FF5500` | Brand, live state, selected state, primary action |
| Win               | `#00E87A` | Positive result semantics only                    |
| Loss              | `#FF3B5C` | Negative/destructive semantics only               |

`#FF5500` remains the product action accent. The final supplied logo artwork
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
- Drawers use `@gorhom/bottom-sheet`; focused forms use the shared `FormSheet`.

Canonical component ownership:

| Product element                | Canonical component |
| ------------------------------ | ------------------- |
| Brand mark                     | `LogoMark`          |
| Tab header                     | `ScreenHeader`      |
| Detail/back header             | `DetailHeader`      |
| Court discovery card           | `CourtListItem`     |
| Home court hero                | `HomeCourtHero`     |
| Sport icon                     | `SportEmblem`       |
| Player avatar                  | `PlayerAvatar`      |
| Player list row                | `PlayerSummaryRow`  |
| Profile identity               | `ProfileHero`       |
| Profile metrics                | `ProfileStats`      |
| ELO value                      | `EloStat`           |
| Activity timeline event        | `ActivityRow`       |
| Court metric panel             | `MetricDashboard`   |
| Run summary                    | `RunCard`           |
| Compact menu                   | `CompactSelect`     |
| Primary two-mode switch        | `ModeTabs`          |
| Reachable multi-action control | `SpeedDialFab`      |
| Game/revision date             | `WeekDatePicker`    |

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
- Large choice sets use typeahead or a contextual list. Date selection uses the
  compact `WeekDatePicker`: this week is visible as one row, and swiping left
  reveals prior weeks. Do not expose a free-typed date field on iOS.

## Court card treatment

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

The court detail page keeps the brand/detail header, six-metric court panel, and tabs fixed. Metric values remain optically centered. A metric with comparison data uses a consistent top-right trend corner; tapping the full 44-point-or-larger tile reveals the percentage and comparison period, with an accessible expanded state and a reduced-motion crossfade. Only the selected tab's content scrolls when needed:

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
  time axis scrolls independently and snaps to the 28-point row pitch, and compact screens may scroll the body so
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
  `FormSheet`, `WeekDatePicker`, shared selector, and `StickyActionBar`.
  Status is communicated with text and structure, never color alone.
- Actions follow one hierarchy: Approve or Update is the prominent action;
  Dispute is a clearly labeled secondary action. Every touch target remains at
  least 44 points. The countdown sits above the game card. The policy
  explanation sits below it, is collapsed by default, and expands in place.

## Motion

- Motion communicates hierarchy and confirmation; it is not decoration.
- Standard transition: 180–320ms, ease-out.
- Court metric detail tiles use the standard 220ms transition; Reduce Motion
  replaces the 3D flip with a crossfade.
- Check-in state may use a restrained spring confirmation.
- Bottom sheets and speed dials use their established gesture/animation libraries.
- Honor reduced-motion settings.
- Signed-in cold starts use a 1.6-second mark sequence: pin → W → check.
- Signed-out cold starts give the approved artwork and LocalCheck lockup the
  full reveal before the form becomes interactive. Reduce Motion collapses
  both paths to the final static state.

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

## MVP scope guardrail

Do not trade the working product for unfinished complexity. Use established libraries already in the project, improve shared components instead of spot-editing screens, note non-blocking polish, and keep moving toward TestFlight external testing.
