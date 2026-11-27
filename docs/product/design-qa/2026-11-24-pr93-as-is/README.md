# PR #93 — as-is visual audit, November 24

**Audit only. No application/UI source changed.** Captured application commit: `5b877ad0e38f742f38ba484d0f7535f7bf672979`, branch `codex/restore-compact-explore-cards`, [draft PR #93](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/93).

226 accepted screenshot states across **375×667, 393×852 and 430×932**, rendered at 2x. Use [the complete screen index](SCREENS.md) or [the local interactive gallery](index.html). Findings are proposals for review, not implemented fixes or design approval.

## Method and boundaries

- Confirmed PR head against checkout before capture. Started a fresh `pnpm preview:web` build of that exact source. The Vercel connector could not resolve the old branch alias (404), so these are locally served PR-source captures, not screenshots of a verified Vercel deployment.
- Used existing visual-QA fixtures, fixed October 17 clock and additional clearly synthetic notification/challenge/long-court states. All external service requests were fulfilled/blocked by the harness; no live backend writes or real purchases. Mock profile updates were used only to navigate onboarding; their success does not prove persistence.
- Opened every available route family and the major tabs/drawers listed in SCREENS.md, reviewed the actual screenshots, inspected crowded layouts at phone scale, measured element boxes, and ran the existing clipping/contrast/target audit against each capture. Repeated variants share owners; they are not independent product validations.
- Discarded loading frames, wrong-route captures, unreachable scripted actions and over-limit username stress from accepted product findings. Replacement captures are included. Reasons are retained in [manifest.json](manifest.json); original attempts remain in the workspace. A successful click alone was not treated as reaching a screen.
- Valid long-name case: username `abcdefghij` (10 characters), legacy display name `Alexandria Montgomery Jr.` (24 characters), full court name `Rancho Cienega Sports Complex` with no short alias. The original 26-character account stress is excluded from the accepted gallery.
- These are **web renders**, not iPhone/Android screenshots. Native text metrics, actual safe areas, Dynamic Type/font scaling, soft keyboard, permission dialogs, camera capture, Maps tiles, purchases and push delivery remain device checks. The city-field focus ring is browser behavior, not evidence of native styling.
- Remaining visual coverage: later onboarding location-success/auto-check-in/push steps, granted-camera/add-court review/result states, other challenge lifecycle states and network-loading/error permutations. The camera permission screen is captured; no real camera permission was granted. This report is not exhaustive App Store acceptance.

## Findings — 14 review items

P2 = meaningful consistency/readability/interaction concern; P3 = cosmetic/balance review. A preference is not an Apple rule or an automatic bug. Existing issues are not all regressions introduced by this PR. No P0/data-loss conclusion is supported by this visual audit.

| ID | Priority | Finding | Evidence |
| --- | --- | --- | --- |
| [A01](#a01) | P3 | Me: search area spacing differs across tabs | [Screenshot](screens/393/me-friends-measured.png) |
| [A02](#a02) | P2 | Me Inbox: section headers, cards and notification rows lack one content rhythm | [Screenshot](screens/393/me-inbox-content.png) |
| [A03](#a03) | P2 | Me hero: full court-name fallback is ellipsized | [Screenshot](screens/393/me-valid-long.png) |
| [A04](#a04) | P2 | Me activity: long court context disappears in one-line rows | [Screenshot](screens/393/me-valid-long.png) |
| [A05](#a05) | P2 | Settings: enlarged labels are not an accepted visual target | [Screenshot](screens/393/settings.png) |
| [A06](#a06) | P2 | LocalList drawer: Default controls are detached from the court | [Screenshot](screens/393/settings-locallist.png) |
| [A07](#a07) | P3 | LocalList drawer: repeated explanation and loose vertical composition | [Screenshot](screens/393/settings-locallist.png) |
| [A08](#a08) | P2 | Settings drawers: enabled switch thumb differs from main Settings | [Screenshot](screens/393/settings-auto-check-in.png) |
| [A09](#a09) | P2 | Shared labels: several roles are below the documented 11pt minimum | [Screenshot](screens/393/home-feed.png) |
| [A10](#a10) | P2 | Schedule cells and purchase links need touch-target review | [Screenshot](screens/393/schedule.png) |
| [A11](#a11) | P3 | Home and expanded drawer: Here now roster leaves a large right-side gap | [Screenshot](screens/393/home-feed.png) |
| [A12](#a12) | P2 | Schedule opens on a time window that excludes its selected slot | [Screenshot](screens/393/schedule.png) |
| [A13](#a13) | P3 | Explore: section headings and court cards use different outer gutters | [Screenshot](screens/393/explore.png) |
| [A14](#a14) | P2 | Settings footer and authentication support note have weak contrast | [Screenshot](screens/393/settings-bottom.png) |

## What should stay intact

- Shared court names/counts fit the ordinary short-name cases; Explore cards remain equal **116pt** high at 375/393/430. The numeral remains centered in its court-art circle. Preserve that approved work.
- Me metric columns and the three tab hit areas have equal widths. Search inputs are centered in their own frames; A01 concerns the surrounding rhythm.
- Main Settings trailing controls have an inset and remain vertically centered in the sampled browser layouts. The typography is still under review (A05); the native switch remains unverified.
- Player/run/score primary columns remain readable in sampled standard-name states. Partially visible intermediate rows while scrolling are not automatically clipping defects; the scroll endpoint must be checked before a footer-overlap claim.
- Empty list space, bottom-pinned primary actions and the centered camera-permission block are intentional layouts, not defects merely because they contain unused space.

## Proposed order after review

1. Me: A01–A04, one shared spacing/text-fitting checkpoint with matched Friends/Inbox/Activity screenshots.
2. Main Settings: settle A05’s compact typography and A08’s shared switch presentation, preserving notification behavior.
3. LocalList management: A06–A07; persistence/default saving remains separate functional work.
4. Home/Explore spacing: A11/A13, preserving hero geometry.
5. Schedule: A10/A12 as a separate interaction/viewport checkpoint.
6. A09/A14: role-by-role compact legibility/contrast corrections across their callers, without a global font enlargement.

## Official guidance used

- [Apple UI Design Dos and Don’ts](https://developer.apple.com/design/tips/): content fits without horizontal scrolling, text avoids clipping, touch targets at least 44×44pt and text at least 11pt. These are guidance/check criteria, not an assertion that every label should be 17pt.
- [React Native 0.81 Text](https://reactnative.dev/docs/0.81/text): review numberOfLines, ellipsizeMode, allowFontScaling and fitting behavior on the installed SDK54 stack. A web truncation check does not validate native fitting.
- [Expo safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/): physical notches, status bars and home indicators require actual inset handling and device verification.

All box measurements here use the browser’s logical CSS-pixel coordinates. Native point measurements are not inferred from the PNG’s 2x physical pixels. Contrast/target checks are audit evidence, not comprehensive accessibility certification.

## Detailed findings

### A01

**Me: search area spacing differs across tabs** — P3; Measured inconsistency / balance review.

- Evidence/location: Friends: tabs end y311; search frame y325–371 (14pt above); first player avatar begins about y398.5 (27.5pt below the field). Inbox search starts flush at y311 and is 44pt tall. Both inputs are centered within their own frames. [Actual screenshot](screens/393/me-friends-measured.png).
- Impact: Uneven surrounding rhythm makes the Friends field appear detached, while Inbox feels compressed beneath the tabs.
- Proposed correction: Use one approved Me control-area rhythm: consistent outer gutter, tab-to-control gap and control-to-content gap. Keep the compact text sizes; do not resize text to solve this.
- Shared/source owner: [app/(tabs)/elo.tsx:1007](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/app/(tabs)/elo.tsx#L1007).
- Verification after approval: Compare Friends and Inbox at all three widths; measure visible gaps and field/icon centerlines.

### A02

**Me Inbox: section headers, cards and notification rows lack one content rhythm** — P2; Observed inconsistency.

- Evidence/location: GAMES heading ends y386; the review card starts y390: 4pt. FRIEND REQUESTS ends y604; its first visible avatar starts about y618.5. Game/request groups use 20pt outer gutters, while the invite notification is a full-width row with its text starting x38 and its timestamp centered on the full row. [Actual screenshot](screens/393/me-inbox-content.png).
- Impact: Related inbox sections change density and edge treatment; notification time does not share the title baseline.
- Proposed correction: Define one section-title-to-content gap and one row shell. Attach notification time to a deliberate title or metadata baseline; retain the marker gutter and existing wording.
- Shared/source owner: [app/(tabs)/elo.tsx:1141](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/app/(tabs)/elo.tsx#L1141).
- Verification after approval: Compare pending/all, review cards, friend requests and invites; measure section gaps and timestamp baselines.

### A03

**Me hero: full court-name fallback is ellipsized** — P2; Observed truncation.

- Evidence/location: With the 10-character username abcdefghij and a 24-character legacy display name, the valid full court fallback Rancho Cienega Sports Complex is cut to Rancho Cienega Sports Co… at 375/393/430. The display name itself fits two lines. [Actual screenshot](screens/393/me-valid-long.png).
- Impact: The user cannot read the full local-court identity in the hero.
- Proposed correction: Preserve the short-name preference; allow an appropriate second metadata line when only a long full name exists, keeping the ELO column stable.
- Shared/source owner: [components/ui/ProfileHero.tsx:97](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/components/ui/ProfileHero.tsx#L97).
- Verification after approval: Repeat with a real short alias and a long full-name fallback; full identity visible and ELO position stable.

### A04

**Me activity: long court context disappears in one-line rows** — P2; Observed truncation.

- Evidence/location: Played 45m at Rancho Cienega Sports Complex and Scheduled a game at Rancho Cienega Sports Complex are ellipsized. Confirmed at 375/393/430 using the same valid-length username fixture. [Actual screenshot](screens/393/me-valid-long.png).
- Impact: The action is readable but its court context is incomplete.
- Proposed correction: Keep the score/time columns reserved; move long court context to a second line or the existing metadata row. Adjust the shared ActivityRow so other callers stay consistent.
- Shared/source owner: [components/ui/ActivityRow.tsx:133](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/components/ui/ActivityRow.tsx#L133).
- Verification after approval: Check Me and peer Activity, short/long court names, with score/time columns and tab-floor clearance.

### A05

**Settings: enlarged labels are not an accepted visual target** — P2; User-rejected design choice.

- Evidence/location: Current PR uses 14pt label/value text and 12pt descriptions, up from 11pt labels/descriptions. Jesse rejected the larger result on November 24. Current code fitting does not establish visual approval. [Actual screenshot](screens/393/settings.png).
- Impact: The page feels heavier and gives long values less horizontal room than the requested compact treatment.
- Proposed correction: Review a compact typography correction against the earlier Settings screenshot while preserving the shared row owner, safe switch inset and intrinsic switch. No blanket 17pt rule. Agree the exact scale visually before implementation.
- Shared/source owner: [components/ui/SettingsRow.tsx:76](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/components/ui/SettingsRow.tsx#L76).
- Verification after approval: Matched original/current/proposed screenshots at 375/393/430, identical data, with long court fallback.

### A06

**LocalList drawer: Default controls are detached from the court** — P2; Observed ownership/grouping defect.

- Evidence/location: A small star plus Default label and a separate large star sit in their own row above the court card, unlike Explore’s attached default marker. [Actual screenshot](screens/393/settings-locallist.png).
- Impact: The action/state appears to belong to an empty row rather than the court it controls.
- Proposed correction: Attach the default state/action to its court management row, including removal on a second saved court. Reuse the underlying LocalList actions.
- Shared/source owner: [app/settings.tsx:738](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/app/settings.tsx#L738).
- Verification after approval: One/two courts, default/non-default, default/remove controls adjacent to the correct row; persistence remains a separate functional task.

### A07

**LocalList drawer: repeated explanation and loose vertical composition** — P3; Known pending layout / hierarchy review.

- Evidence/location: The title has an orange explanatory subtitle; another explanatory paragraph follows the large discovery-style card; the remaining drawer is mostly unused. The explanatory footer is not anchored to the bottom. [Actual screenshot](screens/393/settings-locallist.png).
- Impact: Management controls compete with discovery-card styling, and the explanation appears duplicated.
- Proposed correction: Use compact court management rows, a single aligned search/header rhythm and one explanatory footer in the approved location. Any removal of wording requires review first.
- Shared/source owner: [app/settings.tsx:738](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/app/settings.tsx#L738).
- Verification after approval: Compare one/two-court layouts, long names, empty search and small-phone scrolling without a floating control row.

### A08

**Settings drawers: enabled switch thumb differs from main Settings** — P2; Observed web consistency defect; native unverified.

- Evidence/location: Main Settings push switch is white/orange in web. Friends’ check-ins in the auto-check-in drawer is teal/orange. Both configure native thumbColor; only the new SettingsRow maps RN Web’s separate enabled-thumb property. [Actual screenshot](screens/393/settings-auto-check-in.png).
- Impact: Identical on/off controls have visibly different styling.
- Proposed correction: Consolidate the existing native Switch presentation in one owner, preserving values, callbacks and disabled states. Validate iPhone intrinsic sizing separately.
- Shared/source owner: [components/autoCheckIn/AutoCheckInSettingsSheet.tsx:139](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/components/autoCheckIn/AutoCheckInSettingsSheet.tsx#L139).
- Verification after approval: ON/OFF comparisons in main Settings, auto-check-in and score Hide controls; phone verification for actual native size.

### A09

**Shared labels: several roles are below the documented 11pt minimum** — P2; Measured legibility debt.

- Evidence/location: Examples: Home/court stat captions 7.5pt; Me stats 9pt and tabs 9.5pt; court/player tab labels around 9pt; schedule weekday labels 9pt. Run and score metadata also contain sub-11pt roles. These are existing compact-design debts, not all introduced in PR #93. [Actual screenshot](screens/393/home-feed.png).
- Impact: Important supporting labels become difficult to read despite fitting their boxes.
- Proposed correction: Review only the affected semantic roles with compact references: reduce redundant copy or rebalance layout where needed. Approve exact sizes per role; do not enlarge every label or use 17pt across the app.
- Shared/source owner: [components/court/CourtParts.tsx:479](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/components/court/CourtParts.tsx#L479).
- Verification after approval: Read actual phone-scale screenshots; verify legibility, contrast, wrapping and row height after each separately approved role change.

### A10

**Schedule cells and purchase links need touch-target review** — P2; Measured target-size concern.

- Evidence/location: Schedule heat cells measure about 39×20 at 375, 41×35 at 393 and 46×42 at 430. The grid cells have no hitSlop. LocalPlus links have 14pt-high visual boxes with hitSlop 10, yielding about 34pt vertical reach rather than 44. In contrast, the 32pt Going button already has hitSlop 6: do not flag it as a new defect. [Actual screenshot](screens/393/schedule.png).
- Impact: Dense controls can be difficult to select accurately.
- Proposed correction: Review the grid interaction at small width rather than squeezing text. Provide an adequately sized selection alternative or approved grid reflow. Give purchase links a true 44pt-high target without enlarging their text.
- Shared/source owner: [app/(tabs)/schedule.tsx:1190](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/app/(tabs)/schedule.tsx#L1190).
- Verification after approval: Measure effective hit areas, test adjacent-cell selection on a phone and keyboard/screen-reader navigation. Browser rectangles alone cannot certify native hitSlop.

### A11

**Home and expanded drawer: Here now roster leaves a large right-side gap** — P3; Observed imbalance / preference.

- Evidence/location: Four roster cells are fixed at 58pt with 8pt gaps: total 256pt inside a 353pt content lane at 393. They occupy x20–276, leaving 97pt before the right gutter. The unused space increases on wider phones. [Actual screenshot](screens/393/home-feed.png).
- Impact: The row is left-weighted under a full-width heading despite the requested evenly distributed treatment.
- Proposed correction: Review equal-width roster columns or an explicitly aligned compact strip; preserve avatar size and apply the same owner to Home and expanded court drawer.
- Shared/source owner: [components/court/CourtOverviewSections.tsx:132](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/components/court/CourtOverviewSections.tsx#L132).
- Verification after approval: Compare 0/1/2/4/5+ players at all widths, including the More control and longest visible first names.

### A12

**Schedule opens on a time window that excludes its selected slot** — P2; Observed state/viewport inconsistency.

- Evidence/location: Initial screenshot shows 4 AM–3 PM while the slot card says SAT 17 · 6 PM. Scrolling the heat area to its other window exposes the 6 PM selection. [Actual screenshot](screens/393/schedule.png).
- Impact: The selected detail and visible grid do not initially explain each other.
- Proposed correction: Make the initial heat window contain the selected/current time, preserving the existing morning/evening scrolling model.
- Shared/source owner: [app/(tabs)/schedule.tsx:604](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/app/(tabs)/schedule.tsx#L604).
- Verification after approval: Cold-open before/after noon; selected slot visible or explicitly indicated, and manual window scrolling remains usable.

### A13

**Explore: section headings and court cards use different outer gutters** — P3; Measured edge inconsistency / preference.

- Evidence/location: LOCAL LIST and market headings begin x20; card frames begin x16 and end width−16. Home’s card/body lane uses x20. Hero internals and numeral centering currently look consistent. [Actual screenshot](screens/393/explore.png).
- Impact: Stacked elements have a small but visible edge drift.
- Proposed correction: Review one body-gutter rule at the parent level. Preserve the approved compact hero geometry and fit behavior; do not add page-specific offsets.
- Shared/source owner: [components/CourtsScreen.tsx:542](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/components/CourtsScreen.tsx#L542).
- Verification after approval: Measure heading/card/search edges on list and empty results at 375/393/430, then compare Home and the drawer.

### A14

**Settings footer and authentication support note have weak contrast** — P2; Measured contrast debt.

- Evidence/location: LOCALCHECK 1.0.4 and the authentication note Your account stays signed in on this device measure about 2.4:1 against their backgrounds in the browser audit. They are supporting text, not disabled controls. [Actual screenshot](screens/393/settings-bottom.png).
- Impact: The text is difficult to read even at its current size.
- Proposed correction: Use the existing readable secondary/muted token that meets the intended contrast. Correct color rather than increasing text size.
- Shared/source owner: [app/settings.tsx:490](https://github.com/jGPT-Automated/LocalCheck_Expo/blob/5b877ad/app/settings.tsx#L490).
- Verification after approval: Recheck actual foreground/background contrast and visually compare on phone brightness/dark mode.
