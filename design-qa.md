# Design QA — MVP visual consolidation

Date: 2026-08-09
Branch: `codex/mvp-visual-polish`
Status: **AUTOMATION PASS; RENDER COMPARISON BLOCKED — owner appshot required**

## Reference set

- LocalCheck Brand Asset Sheet: canonical mark, `#FF5500` accent, graphite surfaces, Oswald display and Inter body typography.
- Court-card reference: 16 px card radius, quiet sport tint over `#202027` → `#19191E`, centered metrics, library icons.
- Profile reference: identity and QR at the top, prominent white ELO, semantic win/loss color, separated recent activity.
- Speed-dial reference: one reachable floating action expanding to labeled library-icon actions.
- Owner browser annotations from the 2026-08-09 walkthrough are the acceptance authority where they are more specific than an older document.

## Build checks

| Check | Result |
| --- | --- |
| TypeScript | PASS |
| Realtime tests | PASS — 5/5 |
| Home presentation tests | PASS — 8/8 |
| Player identity tests | PASS — 2/2 |
| Schedule model tests | PASS — 3/3 |
| Design consistency guard | PASS |
| Production-style Expo web export | PASS |
| Fresh preview at port 8081 | PASS — HTTP 200 |
| Handcrafted SVG/text-symbol icon scan | PASS — shared library/brand components used in edited surfaces |
| Supabase email auth smoke | PASS — temporary account create, sign in, profile read, sign out |
| EAS workflow schema validation | PASS — all four workflows against the current official schema |

## Four-pass source and interaction audit

### Pass 1 — hierarchy, geometry, and scrolling

- Home, Explore, Court, Schedule, Compete, Me, Player, and Run keep their
  screen shell fixed while the intended content region scrolls.
- Home Schedule is heatmap-only; Court Schedule is read-only; the primary
  Schedule tab owns time editing and run creation.
- Sticky actions clear the tab bar and safe-area inset. Drawers, result cards,
  selectors, and QR surfaces use bounded widths and consistent gutters.

### Pass 2 — typography, color, brand, and component ownership

- Oswald is limited to headings/numeric emphasis; Inter owns body, labels,
  helper copy, timestamps, and rows through `Typography` tokens.
- `#FF5500` and every translucent orange state resolve through `Colors`.
- The canonical source mark is rendered only by `LogoMark`; back affordances
  reuse the extracted brand frame plus the installed Feather chevron.
- Avatar, player row, profile hero/stats, ELO, activity, court card, selector,
  speed dial, detail header, and sticky action ownership are centralized.

### Pass 3 — actions, state, and navigation

- Selector menus render above rows and consume their own presses; the previous
  leaderboard touch-through path is removed.
- Check-in, court details, schedule editing, run creation/joining, friend
  actions, game result inspection, QR display, and inline inbox routes were
  traced to their handlers and authoritative service calls.
- Player/court deep links expose a branded back action and replace into the tab
  shell when there is no navigation history, preventing a QR-opened profile
  from trapping the user.
- A non-functional QR-scan control was removed rather than shipped as a fake
  action; the working player QR remains available and camera-scannable.

### Pass 4 — fresh senior-design consistency review

- Rechecked every edited screen for duplicated primitives, one-off icon glyphs,
  raw accent values, mismatched number/label alignment, hidden touch targets,
  accidental military time, and page-level scroll ownership.
- Fixed the Home active-player check-in lookup discovered during this pass;
  active rows now receive the same persisted check-in metric as local rows.
- Removed the obsolete Friends route after confirming that friends, suggestions,
  search, and requests now live inside the Me tab.
- Rejected a one-off drawn back icon and derived the frame from the real brand
  asset instead.

## Visual comparison result

Automated visual comparison is **blocked**. The Codex in-app browser refused a
fresh localhost screenshot because its admin-enforced security policy could not
be verified. The preview itself is serving normally. No alternate browser,
Playwright process, or policy bypass was used.

Because a fresh screenshot is not available, spacing, clipping, density, and
reference fidelity are not marked as passed. The owner should complete one
appshot pass at the iPhone-sized PR preview before external TestFlight testing.

## Owner acceptance route

1. Home — full-width local-court hero, sport emblem, local label, Check In, activity typography.
2. Explore — compact court cards, centered metrics, filled local star, drawer peek height and actions.
3. Court — branded back action, shorthand title, metric panel alignment, tabs, non-editable schedule, map preview.
4. Schedule — fixed root layout, localized times, shared run cards, shared speed dial.
5. Compete — BB/PB compact selector, consistent leaderboard rows, reachable Log Game speed dial.
6. Me and Player — shared profile hero/stat components, QR, inline notifications/friends, deep-link escape.
7. Run — fixed root viewport, compact participant grid, localized time, sticky action.

Any visible mismatch should be captured as an appshot annotation and fixed
before App Store submission work begins.
