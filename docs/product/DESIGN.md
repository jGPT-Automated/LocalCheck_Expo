# LocalCheck Design System

Status: Authoritative MVP contract

Version: 3.0.1
Last verified: 2026-08-10

This document describes the current product. It replaces earlier competing design notes. The reproducible source artwork and specs live in the LocalCheck Brand Asset Sheet; app tokens live in `constants/` and shared components live in `components/ui/`.

## Product idea

**Know who is running. Show up. Rank up.**

LocalCheck makes a local court legible: what is happening now, who belongs there, what is scheduled next, and how play changes a player's standing.

The product should feel premium, athletic, editorial, local, and direct. It should not feel like a glossy SaaS dashboard, a hacker interface, or a collage of unrelated cards.

## Identity

- The bracketed check mark in `assets/brand/logo-mark.png` is the canonical in-app mark.
- Render it only through `components/brand/LogoMark.tsx`. Replacing that asset updates every in-app lockup.
- The mark is icon-only; do not recreate it with text glyphs, CSS art, or a
  second in-product implementation. The cold-start `SplashReveal` is the one
  approved motion exception: it reuses PR25's source paths to move from pin to
  W to the canonical check, then hands off to `LogoMark`.
- `assets/brand/splash-artwork.png` is the approved signed-out reveal artwork.
  It is composited at its natural portrait aspect ratio and is not stretched
  into a landscape hero.
- Primary tab headers use `ScreenHeader`. Detail pages use `DetailHeader`, whose bracketed `LogoMark` back variant combines canonical brand geometry with the icon library's chevron.
- All functional icons come from the installed icon libraries. Do not draw icons, use emoji, or use Unicode arrows/checkmarks as substitutes.

## Color tokens

| Token | Value | Purpose |
| --- | --- | --- |
| Background | `#0D0D10` | App canvas |
| Surface | `#151519` | Standard surface |
| Surface high | `#1E1E26` | Selected or elevated surface |
| Border | `#28282F` | Hairlines and structure |
| Primary text | `#F2F2F6` | Headlines and primary copy |
| Secondary text | `#9A9AAA` | Supporting copy |
| Muted text | `#72728A` | Timestamps and metadata |
| LocalCheck orange | `#FF5500` | Brand, live state, selected state, primary action |
| Win | `#00E87A` | Positive result semantics only |
| Loss | `#FF3B5C` | Negative/destructive semantics only |

`#FF5500` is the only identity orange. Never introduce a logo orange, button orange, or screen-specific orange.

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
- Use `constants/typography.ts`; do not reference font names inside feature screens.

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

| Product element | Canonical component |
| --- | --- |
| Brand mark | `LogoMark` |
| Tab header | `ScreenHeader` |
| Detail/back header | `DetailHeader` |
| Court discovery card | `CourtListItem` |
| Home court hero | `HomeCourtHero` |
| Sport icon | `SportEmblem` |
| Player avatar | `PlayerAvatar` |
| Player list row | `PlayerSummaryRow` |
| Profile identity | `ProfileHero` |
| Profile metrics | `ProfileStats` |
| ELO value | `EloStat` |
| Activity timeline event | `ActivityRow` |
| Court metric panel | `MetricDashboard` |
| Run summary | `RunCard` |
| Compact menu | `CompactSelect` |
| Reachable multi-action control | `SpeedDialFab` |

If one of these elements changes, update the canonical component and search the codebase for competing local implementations before finishing.

## Court card treatment

Explore court cards use the supplied reference treatment:

- Base gradient: `#202027` to `#19191E` at 135 degrees.
- Subtle top-right sport tint fading to transparent.
- Border: `rgba(242,242,246,0.09)`.
- Radius: 16.
- Quiet elevation: inset highlight and a low-opacity black shadow.
- Sport icon and label at top, shorthand court name, neighborhood, centered live/locals metrics, and one library arrow affordance.
- Only the current local court shows the neutral outline star. Other cards do not show an empty star; setting a local court lives on its detail page.
- Cards do not contain check-in or local-court buttons. Tapping opens the court drawer.

Home uses the same material language as a full-width hero, not a floating card. Its primary check-in action remains bright `#FF5500`.

## Court flow

1. Explore shows concise court cards.
2. Tapping a card opens a 40% court drawer with identity, live metrics, **Check in**, and **View court**.
3. Pulling the drawer to 92% reveals who is there, locals, planned visits, and upcoming runs.
4. Setting or removing a local court happens on the court detail page—not on Explore cards or the preview drawer.

Explore also exposes a compact **Add** header action. Add Court uses the shared
`FormSheet`, requests a location, lets the player correct the derived address,
and requires a camera or library photo before verification. A successful
server response is inserted into the current court list and invalidates only
court discovery queries.

The court detail page keeps the brand/detail header, six-metric court panel, and tabs fixed. Only the selected tab's content scrolls when needed:

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

## Activity timeline

- A thin continuous rail centers through every node.
- Filled neutral node: checked in.
- Outlined node: checked out.
- Filled orange node: game result.
- Sentences are human: `Player A checked in` and `Player A beat Player B, 11–7`.
- Team results join every player on each side with `+`.
- Player names/profile targets remain interactive; game events open the shared result modal.
- Timestamps remain smaller and quieter than the event sentence.

## Schedule and run flow

- Schedule keeps a stable weekly heatmap footprint in view mode. Its one-hour
  time axis scrolls independently, and compact screens may scroll the body so
  selected-slot details and upcoming runs remain reachable.
- The reachable `SpeedDialFab` exposes **Add times** and **Create run** using the shared Reanimated component and Feather icons.
- Add-times mode supports multi-select cells and one save action.
- Scheduled run cards show localized 12-hour time, attendees, and remaining spots. They do not waste space on `VIEW` copy or a text arrow.
- Run detail uses a fixed layout and two-column roster so open slots do not create a long scrolling page.
- Game logging is a shared form sheet reached from a player or run context, with opponent/court prefilled when available.

## Motion

- Motion communicates hierarchy and confirmation; it is not decoration.
- Standard transition: 180–320ms, ease-out.
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
