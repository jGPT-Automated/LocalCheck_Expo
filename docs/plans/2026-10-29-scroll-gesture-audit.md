> Oct 29 correction and approved follow-up: blank bands in Jesse's screenshots
> were exposed by active overscroll, not permanent layout spacing. Any spacing
> investigation inferred from those captures is withdrawn. Evaluate movement,
> anchored controls and bounce separately from responsiveness. His iPhone
> report confirms accidental Back; no further reproduction is needed to accept
> that report. Implementation: `2026-10-29-scroll-gesture-fixes.md`.

# LocalCheck scroll, layout and gesture audit

**Status: audit and proposed fixes, not implemented.** Inspected October 29, 2026 against `main` at `d5d9ebc`, served by `pnpm preview:web`. The only earlier working-tree changes were the requested browser-rule clarification and its current-state note. No app code or backend changes were made for this audit.

## Verdict

The app has useful shared visual components, but it does not yet have a consistent shared layout and scroll contract. It alternates between a large permanent header, an oversized sticky header, controls embedded in lists, and sheets with no overflow path. That inconsistency explains much of the friction Jesse reported.

The highest-impact fixes are shared navigation gesture policy, reachable sheet content, persistent task controls, tab-specific scroll state, and measured bottom clearance. A wholesale redesign, a new UI library, or an Expo upgrade is not necessary to address these.

## Scope and evidence

- Read all four requested pages in full before inspecting the app. Retrieved only those pages; did not follow their linked documentation or search for additional web sources.
- Signed in with the supplied test account. Inspected real server-backed content. Did not create games, challenges, check-ins, courts, friendships or accounts; did not change privacy, passwords, subscriptions or other settings. Typing into search and opening forms was local inspection only.
- Cloud Chromium through Playwright: 375×667, 393×852 and 430×932 phone viewports, plus 852×393 as a short-height stress test. The native app is explicitly portrait-only and does not support tablets (`app.json:7`, `:13`). Landscape is a web stress test, not a supported native orientation or a release blocker by itself. Viewport resizing is evidence of web reflow, not proof of physical-device behavior.
- Read layout and scroll ownership for all **19 screen routes**, their reachable subtabs and shared sheets. **16 routes were rendered**; Onboarding, the camera stage of Add Court, and a real scheduled-game detail were source-only boundaries, described below.
- Evidence includes saved top/scrolled screenshots, DOM scroll-region bounds and offsets, and source references. The companion HTML report groups the screenshot gallery by surface. Rejected launch/loading captures and captures of the wrong route are excluded.
- Browser evidence cannot establish native iOS swipe sensitivity, Android nested-scroll handoff, software-keyboard behavior, native map gestures, VoiceOver/Dynamic Type behavior, or device FPS. Those have explicit acceptance checks, not assumed passes.

### Requested references and what they establish

| Reference | What was learned | Limit when applying it here |
| --- | --- | --- |
| [Expo universal ScrollView](https://docs.expo.dev/versions/latest/sdk/ui/universal/scrollview/) | Vertical/horizontal containers; platform implementations differ; Android implementation renders all children. | Fetched page describes SDK 58 `@expo/ui`. LocalCheck uses SDK 54 and RN ScrollView. Do not install `@expo/ui` to solve these problems. |
| [React Native ScrollView](https://reactnative.dev/docs/scrollview) | A bounded viewport needs bounded ancestors, normally flex layout. ScrollView mounts every child; FlatList lazily renders long lists. Sticky header APIs, keyboard tap/dismissal policies, insets and axis locking have distinct jobs. | Several properties are iOS-only or Android-only. `nestedScrollEnabled` is Android-specific; `directionalLockEnabled` is iOS-specific. Neither establishes a native navigation gesture policy. |
| [Gesture Handler getting started](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/getting-started/) | Gestures and their relationships must share a GestureHandlerRootView; Reanimated is recommended for UI-thread interactions; native modal content needs appropriate root setup. | Fetched page is Gesture Handler 3.x. Installed version is 2.28.0. Reuse compatible APIs and existing setup, not the new hook examples verbatim. |
| [Expo gesture tutorial](https://docs.expo.dev/tutorial/gestures/) | Gesture root, gesture detectors, animated components, bounded movement, explicit simultaneous recognition where intended, and web/native touch differences. | A sticker drag tutorial is not a specification for navigation, collapsible headers, tab paging or bottom sheets. Its simultaneous pan/tap example should not be copied indiscriminately onto vertical pages. |

These pages do **not** say that every search field must stick, every header must collapse, every tab must swipe, or back must be edge-only. Those are product recommendations in this report, supported by the observed loss of space and controls. The native-stack option descriptions were also inspected locally in the installed package; no extra web documentation was fetched.

## Proposed shared behavior contract

These are recommendations for approval, not a claim that the current app already follows them.

1. **One primary vertical scroll owner per surface.** Bound the body with `flex: 1` and `minHeight: 0`. Short fixed content may use ScrollView. Growing result/activity/player lists should use FlatList or SectionList. Do not put a vertical virtualized list inside a same-axis ScrollView.
2. **Navigation stays available; decorative context yields space.** Keep Back and a compact identity available. Let large court/player summaries scroll into a compact row where useful. Avoid keeping a large hero and a second app header permanently above a tiny list.
3. **Task controls stay with the task.** Keep active tabs, result-changing filters and search reachable while reviewing their results. Group related controls into one opaque persistent band. Not every section title or statistic needs to be sticky.
4. **Preserve useful context when a planner scrolls.** Keep its selected day/time context visible, or show it in a compact selected-slot row. Long grids may scroll; do not squeeze targets merely to force the whole grid onto the screen. A week overview can coexist with an accessible selected-day list.
5. **Separate scroll directions deliberately.** Horizontal rosters and time strips own horizontal drags inside their own bounds; ordinary vertical/diagonal reading drags belong to the page. Use compatible library coordination when a real conflict exists. Do not blanket-disable ScrollView responders or make all gestures simultaneous.
6. **Back is deliberate.** For LocalCheck's scrolling detail screens, start with an edge-restricted back gesture while keeping the visible Back button. An interior mostly-vertical drag should not pop a route. Test the actual installed binary/iOS version before deciding activation distances; the supplied pages do not specify thresholds.
7. **Sheets share their vertical gesture with their content.** Use the installed Gorhom sheet scrollables for overflow, preserve a reachable action/footer, and let sheet drag/dismiss and content scrolling coordinate. A downward drag from content scrolled below the top should first return through the content; handle/backdrop dismissal remains available. Verify the exact handoff on native.
8. **One owner for every inset.** Tab screens use the actual tab-bar floor. Stack pages clear the safe area, not an imaginary tab bar. Sheets clear their home-indicator/keyboard boundary. A footer in normal flex flow already reduces body height; add only needed breathing room, not a second guessed footer height.
9. **Keyboard-aware forms have an explicit policy.** Keep focused fields and the next action reachable; handled child taps should work on the first tap; dismiss on drag using the existing platform policy where appropriate. Reuse the keyboard wrapper on pages and sheet-aware keyboard/scroll handling inside sheets.
10. **Scroll state belongs to the selected tab and data scope.** Switching to a different list must not inherit an unrelated offset. Restore that tab's own position, or deliberately reset it. A search/scope change should reveal the controls and the beginning of its new results.
11. **Measure and reflow.** React to available body height, safe areas, keyboard, window width and text size. Use the existing max-content-width token for reading surfaces where appropriate; let maps and planner overviews use their space. Do not use a minimum child height larger than its remaining viewport.
12. **Collapsing is a shared behavior, not a screenshot trick.** Animate from real scroll offset on the UI thread when animation is needed, reserve space for the compact row, keep control hit regions stable, and respect Reduce Motion. An absolute overlay that hides the first result is not a complete collapse pattern.

## Screen-by-screen layout inventory

**Health:** Needs fix = observed failure or structurally misplaced control; Improve = valid basic implementation with a consistency/space opportunity; Sound = no scroll-structure defect observed in the tested state; Source only = not rendered in that state.

| # | Surface and current state | What scrolls / what stays | Size handling and health | Source owner |
| --- | --- | --- | --- | --- |
| 1 | Home, populated local court | ScreenHeader is fixed. One ScrollView contains sport, court hero, actions, Here now, Up next, Today and activity. `stickyHeaderIndices={[1]}` pins the full court name/place/three-number hero. Check in and Court actions scroll away. | Bounded flex body and bottom-floor hook are good. Hero does not collapse and consumes space on short screens. **Needs fix / F02.** | `components/HomeScreen.tsx:157`, `components/ui/HomeCourtHero.tsx:25` |
| 2 | Schedule, View | Header fixed; court selector, instructions, day headings, heatmap and selected slot all belong to the outer ScrollView. The inner grid ScrollView has scrolling disabled. Floating actions remain fixed. | Row pitch is calculated from window height minus a guessed 330px chrome budget, clamped to 20–28; cells become 17–25px tall. On small screens the outer page scrolls and the court/day context can disappear. **Needs fix / F04, F08.** | `app/(tabs)/schedule.tsx:602`, `:1045`, `:1105` |
| 3 | Schedule, Add times/Edit | Same outer scroller, plus another vertical ScrollView for selected-time summary/visibility. Cancel/Save is absolute at the bottom. | Inner editor has `flexGrow` and a 140px minimum rather than a measured body allocation. In the empty-selection capture it expanded without its own overflow; independent nested scrolling with a long selection is a **source risk**, not a reproduced conflict. Bottom action buttons are partly under the tab bar. **Needs fix / F04, F06.** | `app/(tabs)/schedule.tsx:1239`, `:1353`, `:1865` |
| 4 | Compete, Leaderboard | ScreenHeader and main Leaderboard/Log game tabs fixed. Sport picker, Friends/Local/Regional controls and place label are inside the leaderboard ScrollView with the rows. | Main tabs already behave correctly. Scope controls can scroll away on a longer list. The tested Local scope has only one row, so long-list disappearance is **source-proven**, not reproduced in that short state. No virtualization. **Needs fix / F03; scale risk F09.** | `app/(tabs)/compete.tsx:236`, `:368` |
| 5 | Compete, Log game | Header and mode tabs fixed; sport/court/date/matchup/score form scrolls in KeyboardAwareScrollViewCompat. Submit is a sibling footer above the tab floor. | Good basic form ownership. In 852×393 the form viewport is only 72px because permanent chrome and footer consume the rest. **Improve / F02, F10.** | `components/game/LogGameForm.tsx:991`, `:1190` |
| 6 | Explore, List | Fixed ScreenHeader, sport/search band and List/Map tabs; list alone scrolls. My local and discovered-court cards are list content. | This is the strongest existing example of persistent task controls. Bottom padding is guessed 84/110 rather than the shared floor. Expanding results mounts all cards. **Mostly sound; F04, F09 at scale.** | `components/CourtsScreen.tsx:321` |
| 7 | Explore, Map | Same persistent search/mode controls; map fills remaining body. Map owns pan/zoom. Court drawer is a separate modal surface. | Cloud map rendered. Native Mapbox and conflicts with sheet/map drags require a device. Keep search outside map scrolling. **Sound structure; native boundary.** | `components/CourtsScreen.tsx`, `components/MapScreen.web.tsx`, `components/NativeMapScreen.tsx` |
| 8 | Me, Activity | Header, ProfileHero, statistics and Activity/Friends/Inbox tabs all fixed. Activity alone scrolls in one keyboard-aware scroller shared by all three tabs. | Unnecessarily large permanent profile area; at 852×393 only 82px remain before accounting for the overlaid tab bar. **Needs fix / F02, F07.** | `app/(tabs)/elo.tsx:351`, `:436` |
| 9 | Me, Friends/search | Same fixed profile and tabs. Search is the first child **inside** the shared scroller, followed by friends/suggestions or search results. | Search disappears during scrolling. More seriously, switching from scrolled Activity can open Friends already scrolled past search and real friends. Reproduced at 375×667: Activity y=383 → Friends y=345. **Needs fix / F03, F07.** | `app/(tabs)/elo.tsx:515` |
| 10 | Me, Inbox, Pending and All | Profile/tabs fixed. Pending/All selector and inbox search are **outside** the shared scroller; challenges/reviews/requests/notifications scroll. | Control placement is better than Friends and should be reused. Large permanent hero and shared offset still apply. **Improve / F02, F07.** | `app/(tabs)/elo.tsx:411`, `:436` |
| 11 | Court, Live | Full Back/identity/live count/busy chart and all five tabs fixed. Roster, All/Games/Check-ins filters and activity scroll below them; roster scrolls horizontally. | Header is 283px in the web capture, with no collapse. Filters disappear in the observed scrolled state. **Needs fix / F01, F02, F03.** | `app/court/[id].tsx:219`, `:265` |
| 12 | Court, Games | Same full fixed header. Only Games panel scrolls; no upcoming games in this account's court state. Create action is inside panel. | Correct bounded body, excessive fixed header. Populated/many-games layout was source-reviewed only. **Improve / F02.** | `app/court/[id].tsx:328`, `components/court/CourtGamesPanel.tsx` |
| 13 | Court, Players: Ranking / Active / Newest | Same fixed header. Sort controls and note are inside Players ScrollView with rows. Own-player row is pinned below it. | Good pinned own row; sorting disappears at compact height. At 852×393 list viewport is only **21px** between header and own row. Ranking, Active and Newest were rendered. **Needs fix / F02, F03.** | `components/court/CourtPlayersPanel.tsx:64` |
| 14 | Court, Week | Same fixed header. One CourtSchedulePanel ScrollView contains the week heading, day headings, 8 two-hour rows, legend and selected-slot card. | At 375×667 the selected card needs scrolling; day headings then disappear. Fine to scroll the grid, but not to lose day/selection context. Fixed cell height is 34px. **Needs fix / F02, F08.** | `components/CourtSchedulePanel.tsx:190` |
| 15 | Court, Info | Same fixed header. Map preview (150px), stat strip and venue facts scroll together in the body. | No same-axis nested scrolling. Chart/live summary remains fixed even when reading venue facts; compact header would recover space. **Improve / F02.** | `app/court/[id].tsx:355`, `components/court/CourtInfoPanel.tsx` |
| 16 | Other player, Head to head | DetailHeader, ProfileHero, stats, tabs and bottom actions fixed. H2H summary and games scroll in the body. Code adds an absolute compact H2H overlay after the summary exits. | It already attempts collapse for the H2H summary, but leaves the profile hero permanent. Overlay does not reserve body space. Sample profiles have zero/one shared game; long-series collapse remains a source risk. **Improve / F02, F07, F12.** | `app/player/[id].tsx:387`, `:417`, `:522` |
| 17 | Other player, Activity / Details | Same fixed hero/tabs/actions; one shared body scroller changes children between tabs. Details holds account facts, heatmap and safety controls. | Details scrolls on small phones; footer stays available. Offset policy is not defined per tab. **Improve / F02, F07.** | `app/player/[id].tsx:159`, `:417` |
| 18 | Game score, confirmed | Fixed DetailHeader; score card and activity timeline scroll; Hide score is a sibling footer. Pending/held code uses StickyActionBar. | Confirmed state has good separation and responds to small height. Pending actions reserve an additional hardcoded 180px inside a body already shortened by the sibling footer: likely excess space, not an observed overlap. **Sound confirmed state; F04 cleanup.** | `app/match/[id].tsx:292`, `:313` |
| 19 | Challenge detail, accepted/game-on | DetailHeader and I missed it/Log score actions fixed; matchup card scrolls independently. | Clear body/footer ownership at tested sizes. Other status-specific footer states were source-reviewed. **Sound**, subject to shared F01 gesture policy. | `app/challenge/[id].tsx:186` |
| 20 | Scheduled game detail | Source: fixed custom nav row, title/stats/roster/details/manage controls in one ScrollView; RSVP/result actions in a separate footer. | No real run detail was reachable from the current account's upcoming-games state. A historical “scheduled a game” Home event opened the actor profile, so it is **not run evidence**. Layout appears structurally reasonable; guessed bottom padding and custom header need reconciliation. **Source only.** | `app/run/[id].tsx:214` |
| 21 | Settings main | ScreenHeader fixed; profile row and all grouped settings scroll in KeyboardAwareScrollViewCompat. | Good simple document/form pattern. Large bottom padding is guessed. Tested without changing values. **Sound main-page structure.** | `app/settings.tsx:281` |
| 22 | Notifications | DetailHeader and Read all fixed; phone-alert prompt and notification rows scroll together. | Controls remain usable; long notification list mounts every row. Prompt scrolling away is reasonable for an informational callout. **Sound current layout; F09 scale risk.** | `app/notifications.tsx:68` |
| 23 | Blocked players | Fixed DetailHeader, bounded ScrollView; empty explanation/list. | Empty state good; max-content-width already used. Populated unblock list not available and no one was blocked for testing. **Sound empty state.** | `app/blocked-users.tsx:73` |
| 24 | LocalPlus | Fixed DetailHeader, one flex-growing scroll body, purchase/manage action footer. Restore/redeem links live at bottom of content. | Compact portrait can reach links. Web purchase state is “Not available yet”; priced plans/real purchase flows are native-only evidence gaps. **Sound current structure.** | `app/localplus.tsx:199`, `:327` |
| 25 | Hidden Feed route, Activity / Leaders | Custom large header with activity/leaders/sport controls fixed. Activity uses FlatList; Leaders uses ScrollView, with an extra horizontal court strip inside. | Activity is an existing virtualized-list example. Header/chrome differs from current design system and is expensive on short screens; Leaders court selector can scroll away. Route is hidden from tab bar, not deleted. **Improve / F03, F09, F11.** | `app/(tabs)/feed.tsx:33`, `:113`, `:134` |
| 26 | Auth: shared sign-in/create-account form, empty-field validation, reset request | Artwork and form are in a keyboard-aware scrolling surface; mode actions remain within form flow. | Tested the shared form, its empty-field validation, and reset-request view at phone/landscape sizes without creating an account or sending reset email. Scrolling is appropriate for keyboard/short-screen recovery. Code-verification/password-reset submission states source-only. **Sound basic pattern; native keyboard still unverified.** | `app/auth.tsx:210` |
| 27 | Onboarding: welcome/name/court/auto check-in/alerts | Source: persistent step nav/actions. Name is keyboard-aware; auto-check-in explanation scrolls; welcome, court picker and alert explainer use fixed/flex views. | Existing account is correctly gated away. No fresh account created. Fixed explanatory/picker stages lack the overflow recovery present on name/auto-check-in; court search keyboard and large text need validation. **Source only / F10.** | `app/onboarding.tsx:415`, `:488`, `:608`, `:634` |
| 28 | Add Court route/camera/details | Entry is Explore's intro/location sheet; direct route without context returned to Explore. Source: staged camera workflow, details in plain ScrollView with submit in content. | Intro was rendered; location/camera/accepted-photo path needs live location and camera/device evidence. Plain details ScrollView has tap handling but not the shared keyboard-aware wrapper. **Source only for camera/details / F10.** | `app/add-court.tsx:117`, `:528` |
| 29 | Not found | Centered flex message and Home link; no scrolling or shared app header. | Rendered. Short text fits tested compact state; low-priority consistency/large-text recovery check. **Sound current state.** | `app/+not-found.tsx` |

## Drawer, picker and form inventory

| Surface | Current implementation | Evidence and recommended treatment |
| --- | --- | --- |
| Court peek/expanded, local court | AppBottomSheetModal + BottomSheetView; persistent full peek header/actions; fixed-height BottomSheetScrollView detail window; bottom chips outside it. | Rendered at all four sizes. Detail uses correct sheet-aware scroller. `drawerDetailHeight` nevertheless enforces a 240px minimum even when less space remains. At short height, lower content/footer goes beyond the available sheet. Compact header + measured flex body; **F05**. |
| Court expanded, nonlocal gate | Same shell; gate replaces detail content and opens LocalPlus. | Gated Sand Branch Courts drawer rendered at 375px; same minimum-height constraint. Keep gate content reachable; do not set a court or buy anything to audit it. |
| Schedule a game / Challenge creation | `RunFlowSheet dynamic`; content rendered in a plain BottomSheetView, including search, day/time strips, options and submit. | Rendered compact/regular/large/landscape for Schedule; compact/landscape for Challenge. Horizontal time strip scrolls; vertical overflow has no sheet scroller. On short-height views the top/header can leave the visible sheet. **F05**. |
| Player QR | `RunFlowSheet dynamic`; fixed 220px QR plus 18px padding each side, copy in plain BottomSheetView. | Rendered 375px and landscape. No vertical overflow path; tall QR content can push the sheet title out of reach. Needs accessible close and content overflow. **F05/F13**. |
| Final game result | Separate `AppBottomSheetModal dynamic` + BottomSheetView; max height 86% rather than RunFlowSheet's 82%. | Real 1v1 result rendered. More player rows/larger text/short height may exceed cap; do not assume 1v1 fit proves team result fit. Consolidate overflow behavior without changing ScoreCard. **F05 source risk for larger states**. |
| Score-review rules | `RunFlowSheet dynamic`, five explanatory paragraphs in a non-scrolling BottomSheetView. | At 375px captured only the first three explanations in the visible sheet; paragraphs 4–5 exist in DOM but have no vertical sheet scroller. This is a concrete reachable-content failure. **F05, highest-confidence sheet example**. |
| Privacy / Primary sport editors | Fixed percentage detents (62% / 46%); RunFlowSheet's normal branch uses BottomSheetScrollView below a fixed header. | Rendered compact, regular and landscape. Correct scroll-aware branch exists already; reuse its mechanics. Need explicit close/focus/keyboard checks. |
| Local court editor | Fixed 82% sheet with shared scroll body; current-court card, search and results all in that body. | Rendered. Search can leave with results; pin it for a long picker list. No court was selected/removed. **F03**. |
| Username / Change password editors | Dynamic RunFlowSheet; BottomSheetTextInput fields and Save in non-scrolling dynamic body. | Rendered without entering/saving values. Sheet keyboard behavior exists, but tall keyboard/text+short-screen overflow lacks a scroller. **F05/F10**. |
| Auto check-in settings | Dynamic RunFlowSheet; geofence illustration plus toggle/location rows in non-scrolling body. | Web layout rendered; switches unchanged. Short-screen illustration/title/copy overflow needs same shared fix. Real iOS permission prompts/geofencing untested. **F05**. |
| Auto check-in offer | Same dynamic sheet pattern as intro; feature-permission actions in content. | Source-reviewed; not triggered by changing a court. Include in shared overflow acceptance. |
| Add Court intro/location | Dynamic RunFlowSheet, plain view body and action. | Intro rendered at 375/393/landscape. Later location screen not advanced to camera. Same overflow contract **F05**; location buttons must remain reachable when explanations wrap. |
| Schedule court picker | FormSheet → 92% RunFlowSheet with `scroll={false}`; child plain RN ScrollView contains local-court row/search/results. | Rendered. Bounded flex space is good; scroll owner inside sheet is not sheet-integrated. Search is in results body. **F03/F06**. |
| Log game from profile | FormSheet → fixed 92% detent; LogGameView brings its own KeyboardAwareScrollViewCompat and sibling submit. | Rendered with real opponent prefilled, without submitting. Reuse existing form rather than build another. Need a sheet-compatible scroll adapter instead of assuming page scroll mechanics coordinate with sheet pan. **F06**. |
| Match revision / scheduled-game edit/result / legacy planned-visit form | Source-reviewed: match revision has ScrollView plus keyboard/tap props and sticky actions; scheduled-game edit/result and planned-visit forms use shared FormSheet with child RN scrollers. | No authorized/live editable scheduled run or pending/held match used to render these. Preserve server behavior; make sheet-aware overflow and keyboard treatment part of the common adapter. **F06/F10**. |
| CompactSelect / opponent picker / horizontal time and roster rows | Anchored selector measures window bounds; opponent choices are inline form content; TimeStrip is horizontal RN ScrollView with Android `nestedScrollEnabled`; rosters/avatars have horizontal containers. | CompactSelect already uses useWindowDimensions. Horizontal containers are legitimate; do not remove them or pretend Android nestedScrollEnabled fixes iOS back. Test them against the new navigation/sheet policy. |

## Findings, causes and surgical fixes

### F01 — Back gesture competes across the whole detail screen (P1)

**Evidence:** Jesse's report plus `app/_layout.tsx:71–78`: shared detail options explicitly enable `fullScreenGestureEnabled: true`, `gestureEnabled: true`, `animationMatchesGesture: true`, and `slide_from_right`. Court, run, player, match, challenge, notifications, settings and LocalPlus use it. Court has no custom pan responder that explains this independently.

**Confirmed behavior and cause (updated after Jesse's correction):** Jesse reproduced accidental Back during normal interior vertical scrolling on his iPhone. This explicit option enables the navigation recognizer across the screen and creates the reported conflict; accepting the bug does not depend on a second reproduction. Installed native-stack descriptions distinguish iOS 18-and-earlier from iOS 26 defaults, so the fix explicitly sets false rather than relying on omission. Cloud screenshots cannot record the post-change native recognizer.

**Fix implemented on branch:** Explicit `fullScreenGestureEnabled: false`, remove `animationMatchesGesture`, preserve `gestureEnabled: true` and Back buttons. No custom pan or activation threshold. See the literal configuration diff and verification record in `2026-10-29-scroll-gesture-fixes.md`.

**Acceptance:** Interior vertical and mildly diagonal drags never pop Court Live/Players/Week/Info or peer profile; deliberate edge back still succeeds; horizontal rosters/time strips work; back over a sheet dismisses/returns in the expected order. Record iPhone, iOS and build.

### F02 — Large permanent context consumes the scrolling viewport (P1)

**Evidence:** Home pins the full hero but loses actions; Court pins its full 283px web header on every tab; Me pins profile+stats. The web short-height stress test gives Court Players a 21px list viewport at 852×393, Me 82px before tab-bar occlusion, and Log game 72px. Supported compact portrait instead gives Court Players 295px, Me 356px before tab-bar occlusion, and Log game 346px. Landscape alone is not a native defect: the app is portrait-only. The compact-portrait loss of controls and large pinned sections remains directly observed. See `home-375x667-scrolled`, `court-players-852x393-top`, `me-852x393-top`, `log-game-852x393-top`.

**Fix:** Reuse existing court/player visual parts, with one shared expanded-to-compact identity behavior. On Home retain compact court/live identity and a reachable Check in action. On Court let large identity/chart yield to compact Back+court/live identity while keeping route tabs. Me/peer profile should yield nonessential stats/hero space to the selected task. Do not stack multiple independent sticky bands until they recreate the same problem.

**Acceptance:** Small-height list/form has useful room; all controls remain reachable at each target size; compact and expanded states have identical authoritative data; no hidden first row or abrupt layout jump.

### F03 — Related controls have inconsistent scroll ownership (P1)

**Evidence:** Friends search and Court Live filters visibly disappear after scrolling. Court Players sort disappears at 375px. Compete scope filters are in the same ScrollView as rankings. Inbox and Explore correctly keep equivalent controls outside results.

**Fix:** Lift Friends search into the existing persistent band, matching Inbox's structure. Lift Compete's sport/scope/place controls into one band below ModeTabs. Lift Court Live filters and Players sort into the active tab's persistent control area, kept compact. Keep Local-court picker search with its results controls. For Week/Schedule, use F08 rather than pinning the entire grid. Do not make informational notices sticky by default.

**Acceptance:** Changing query/scope/sort is possible at any result offset with one tap; controls remain visible without consuming most of the compact viewport; first result begins below the band.

### F04 — Bottom clearance is guessed in several independent places (P1)

**Evidence:** TabFloor already knows actual bar height, but Schedule uses 72px content clearance, absolute editing actions, and separate web/native offsets. Explore uses 84/110; Compete 84/bottom+100; Me 92/bottom+104. Schedule's selected slot and floating menu can visually crowd/overlap each other. A compact probe at maximum scroll placed slot action bottom at y=582 while the 88px tab bar starts at y=579; the floating action also overlaps the slot's right side. Editing screenshots show button bottoms under the tab band.

**Fix:** Use TabFloor/useBottomFloor for tab surfaces; have the screen allocate the footer above that floor in normal layout where possible. Measure floating-action/selected-slot clearance together instead of separate magic numbers. Stack/sheet routes should use safe-area/sheet inset only. Remove redundant large content padding from match/run where a sibling footer already shortens the body.

**Acceptance:** Last content/action clears the bar and floating actions at maximum scroll; safe-area changes do not change correctness; no unnecessary footer-sized blank tail. Probe corners and centers, not just button centers.

### F05 — Shared dynamic sheets have no vertical overflow recovery (P1)

**Evidence:** `RunFlowSheet.tsx:103–114` sets an 82% maximum but renders the dynamic body in BottomSheetView. Score-review rules lose later paragraphs in the compact capture. QR/intro/auto-check-in/scheduling sheets expose short-height clipping or displaced headers. Court drawer separately forces detail height to at least 240px even when the available sheet remainder is smaller (`lib/courtDrawerLayout.ts:37`). GameResultModal repeats its own 86% dynamic sizing and plain body.

**Fix:** Fix the shared shell first: dynamic sizing may choose initial height, but overflow must have one bounded BottomSheetScrollView/FlatList with a reachable header/action. Subscribe to window-size changes rather than reading Dimensions only opportunistically. Replace the Court drawer's minimum-height arithmetic with a measured flex body that can shrink; collapse its large header in the short-height state. Reuse the overflow behavior in GameResultModal while preserving its ScoreCard.

**Acceptance:** All five review explanations are reachable; every field/action is reachable in short height, with keyboard and larger text; sheet scroll offset changes during content drags; no content below the sheet's reachable bounds; peek/full detents and backdrop/drag dismissal still work.

### F06 — Page scroll mechanics are reused inside sheets without a shared handoff contract (P1 native risk / P2 structure)

**Evidence:** FormSheet deliberately delegates scrolling to its children; LogGameView uses the page keyboard-aware scroller; Schedule court picker and other forms use plain RN ScrollView. Schedule Edit also contains two same-axis vertical ScrollViews. The current short selection did not overflow its inner editor, so native gesture conflict is not claimed as reproduced.

**Fix:** Give existing forms a page/sheet scroll-container adapter, selecting the library-compatible sheet scroll owner and retaining keyboard support/footer. Do not create second versions of the forms. Remove the unnecessary disabled grid ScrollView in favor of a View; flatten Edit's summary into the primary body unless a separately bounded pane is intentional.

**Acceptance:** On-device upward/downward/diagonal drags over fields, rows and blank space have one predictable owner; sheet stays open while its scrolled content is being read; dismissal from the intended handle/top boundary remains available. Android and iOS checked separately.

### F07 — A new tab inherits another tab's scroll offset (P1)

**Evidence:** Me uses one scroller for three sets of children with no per-tab scroll restore/reset. Live reproduction: scroll Activity to y=383, tap Friends, Friends opens at y=345 with search and main friends above the viewport. Peer profile reuses a scroller and resets collapse flags, not scroll offset; that analogous failure is source-indicated.

**Fix:** Store/restore offsets per tab and query/scope, or explicitly reset on tab changes; make this policy consistent. Keep controls outside the list regardless. Court switches currently mount separate tab bodies and generally reset; decide deliberately whether restoring each tab's position is preferable.

**Acceptance:** Activity → Friends always shows its search/results context; changing tabs never opens mid-list accidentally; going back restores the intended list position; a new search does not hide its first results.

### F08 — The planner trades away targets and context to fit a screenshot (P1 accessibility / P2 layout)

**Evidence:** Schedule's estimated chrome budget forces 17–25px cell heights; measured compact cells are about 38.6×17px. Outer page scrolling loses selected court/day labels. Court Week's 34px rows and headings scroll together; its selected-slot card can start below the compact viewport.

**Fix:** Calculate body space from actual laid-out chrome. Let the grid scroll instead of shrinking targets excessively. Keep day headings/selected-day context with the grid and make the selected-slot row reachable without losing the chosen time. Retain the week overview, with an accessible selected-day/slot list or equivalent larger controls when seven columns cannot meet touch requirements. Do not fix height by introducing another accidental vertical scroll pane.

**Acceptance:** Day/time identity is visible while choosing a slot; selected-slot details/actions clear the floor; compact and larger-text layouts have a usable alternative to tiny heat cells; overview still shows real counts and keeps current-time meaning.

### F09 — Growing lists use eager rendering (P2 scale risk)

**Evidence:** Home feed, Compete rankings, Me friends/activity/inbox, Court activity/players and notifications map rows inside ScrollView. Court feed caps fetched items at 50 and reveals 12 at a time, which bounds that example; this is not evidence of infinite data or measured dropped frames. Hidden Feed Activity already uses FlatList.

**Fix:** Convert growing collections to FlatList/SectionList when touching their scroll ownership. Put collapsible content in list headers and persistent controls outside or in supported sticky headers. Keep finite forms and small grids as ordinary scroll content. Preserve server limits, fetch behavior, keys and row components.

**Acceptance:** Large real/dedicated test lists keep controls stable and memory/render work bounded; visible position survives Realtime refreshes; profile/result navigation and accessibility order remain correct. Measure native performance before claiming an FPS gain.

### F10 — Keyboard and overflow policy varies by surface (P2; source-only for unvisited stages)

**Evidence:** Auth, Settings and Log game use KeyboardAwareScrollViewCompat; match revision has explicit tap/dismiss props; Add Court details uses plain ScrollView; Onboarding court/alerts stages are fixed views. Dynamic field sheets rely on shell keyboard movement without a body overflow path. Browser cannot reproduce the iOS software keyboard.

**Fix:** Reuse the existing keyboard-aware page wrapper for field pages and integrate a sheet-aware equivalent with F05/F06. Give non-map onboarding explanatory content a bounded overflow path; retain map gesture ownership in the court picker. Keep a consistent handled-tap and drag-dismiss policy per platform.

**Acceptance:** With keyboard up on the smallest supported phone, focused field, validation message and next action remain reachable; tapping a handled result works once; dismissing keyboard does not move the form to an unrelated offset.

### F11 — Shared visual tokens do not yet govern layout composition (P2)

**Evidence:** ScreenViewport, ScreenHeader, DetailHeader, TabFloor, keyboard wrapper, ModeTabs, CourtTabBar and shared court/profile parts exist. Court/run still hand-roll navigation rows; hidden Feed has a separate header system. `Layout.maxContentWidth` is used on match/revision/blocked surfaces but not most reading surfaces. Several tab/sort implementations have independent sizing/placement rules.

**Fix:** Define a small shared composition contract around existing components: fixed chrome, optional collapsing identity, persistent control band, one scroll body, optional footer. Use variants for list/detail, keyboard form and map, not a giant configurable screen framework. Apply readable width caps to list/form copy where useful; keep maps/planners intentionally wide. Centralize floor and header measurements.

**Acceptance:** All touched routes use the same inset, footer and control-placement rules; long court/player names wrap or truncate deliberately; compact, large-text and wider views do not depend on one screenshot's dimensions.

### F12 — Existing H2H collapse is an overlay, not a reusable layout contract (P2 source risk)

**Evidence:** Peer profile tracks summary exit using React state in onScroll and renders `stickyH2h` absolutely at top 0 of the scroll wrapper. It does not allocate a 44px slot for that overlay and does not collapse the permanently fixed profile. Short zero/one-game sample states do not establish long-series behavior.

**Fix:** Retain its useful compact score idea, but implement sticky/collapsing ownership through the same measured header/body contract as F02. Reserve compact-row space; use UI-thread offset animation where animation is needed, with reduced-motion behavior. Avoid per-screen threshold/setState implementations that drift.

**Acceptance:** First game row is never hidden under compact score; no threshold flicker; tab switch resets/restores both offset and collapse state together; long series tested on a real device.

### F13 — Gesture-only sheet dismissal lacks an explicit alternative (P2 accessibility)

**Evidence:** RunFlowSheet deliberately omits a close button; AppBottomSheetModal supplies pan-down and backdrop close. Backdrop dismissal was exercised in the browser, but drag handoff is not native-verified, and neither is an explicit labeled close action. Full focus trapping/restoration and screen-reader dismissal were not tested.

**Fix:** Add a consistent accessible close/dismiss affordance to the shared sheet header and appropriate platform back/escape handling; restore focus to the opener. Keep drag and backdrop close. Existing UI sign-off rules apply before implementing visible changes.

**Acceptance:** Every sheet can be dismissed without performing a drag or precisely tapping uncovered backdrop; keyboard/screen-reader users return to the correct opener; forms do not accidentally submit or save on dismissal.

## What is already worth keeping

- The root already uses GestureHandlerRootView with bounded flex and Reanimated/Worklets installed. No missing-global-root diagnosis is supported.
- Explore and Inbox already separate their primary controls from result scrolling.
- ScreenViewport and several child panels already use `flex: 1`/`minHeight: 0`.
- TabFloor/useBottomFloor already supply the correct shared primitive; adoption is the problem.
- Court Players has a useful pinned own-player row.
- Game score, Challenge and Log game already separate main actions from scrolling content.
- Fixed-detent RunFlowSheet already has a BottomSheetScrollView branch; use it as the starting point for safe overflow.
- Real Gorhom sheets provide actual drag/backdrop behavior; replace the constraints, not the entire sheet library.
- KeyboardAwareScrollViewCompat already centralizes much of the page keyboard behavior.
- Hidden Feed Activity provides an existing FlatList example.

## Surgical implementation sequence

Each row is a separately verifiable outcome. This is a proposal, not authorization to ship changes. Show Jesse the changed compact/expanded states before implementing visible layout changes, as required by the repo's UI sign-off rule.

| Order | Bounded change | Files/components to change first | Evidence required before moving on |
| --- | --- | --- | --- |
| 1 | Restrict accidental detail back | `app/_layout.tsx` shared detail options | Actual portrait iPhone vertical/diagonal/edge drag matrix on Court + peer profile; compare supported iOS versions. |
| 2 | Make all sheet content reachable | `components/sheet/RunFlowSheet.tsx`, `AppBottomSheetModal.tsx`, `components/ui/GameResultModal.tsx` | Review rules 1–5, QR, username/password, schedule/challenge forms at compact/regular/large/short height and keyboard; drag/backdrop/close checks. |
| 3 | Repair Court drawer size budget | `CourtSheetContent.tsx`, `CourtSheetHost.tsx`, `lib/courtDrawerLayout.ts` | Peek/full/local/gated; compact header and footer chips reachable at every size. |
| 4 | Correct floor/footer ownership | `TabFloor.tsx`, tab routes, Schedule footer/FAB, affected stack padding | Last row and every action unobstructed, including corners; short phone and nonzero native safe area. |
| 5 | Fix Me controls and tab state | `app/(tabs)/elo.tsx`, existing profile/search/tab parts | Reproduce Activity y=383 → Friends; search stays visible and list starts/restores intentionally; Inbox All/Pending works. |
| 6 | Fix Compete persistent scopes | `app/(tabs)/compete.tsx`, existing ModeTabs/CompactSelect | Populate enough real test rows to scroll all scopes; mode tabs and sport/scope context remain reachable. |
| 7 | Introduce shared compact identity and migrate Home/Court/Me/peer | `ScreenViewport.tsx`, `ScreenHeader.tsx`/`DetailHeader.tsx`, `HomeCourtHero.tsx`, `ProfileHero`, Court parts | Before/after approved at all three portrait phone sizes; Back/tabs/actions available; useful body space; reduced motion; long names. |
| 8 | Flatten planner scroll ownership and retain context | `app/(tabs)/schedule.tsx`, `components/CourtSchedulePanel.tsx`, `SlotCard.tsx` | View/Edit/long selections; day/time context; no nested same-axis grab; accessible selected-day alternative. |
| 9 | Reuse page/sheet form adapter | `FormSheet.tsx`, `KeyboardAwareScrollViewCompat.tsx`, `LogGameForm.tsx`, child pickers/forms | Same form correctness on page and sheet, with keyboard and native pan handoff; no duplicate business logic. |
| 10 | Virtualize growing collections and normalize remaining routes | Existing row components + Home/Me/Court/Compete/Notifications/Explore/hidden Feed owners | Long-list performance and Realtime position checks; no nested vertical virtualization; consistent headers/width/insets. |

No database migration, server function, RevenueCat configuration, OTA or native build is required merely to write this audit. The proposed fixes mostly concern JavaScript layout/gesture options, but their native acceptance requires an appropriate installed build. Do not upgrade Expo/Gesture Handler or add a new native dependency as a shortcut.

## Acceptance matrix for the eventual fixes

| Test | Expected result |
| --- | --- |
| Three portrait phone sizes + keyboard-reduced height; separate web landscape stress | Key controls/actions reachable, no overlapping bars, compact identity yields space, no body reduced to a token-height strip. |
| Increased system text size / long usernames and court names | Headers, controls, sheet forms and bottom actions reflow; important information is not made usable only by shrinking text. |
| iOS vertical and diagonal reading drag, start near center and edges | Interior reading scrolls; deliberate back works in its intended activation region. |
| Horizontal roster/time row inside vertical page or sheet | Horizontal movement stays local; vertical movement is not hijacked; no accidental back. |
| Sheet content above/below top, handle drag, interrupted drag, backdrop and explicit close | Content and sheet cooperate; user can reach every item/action and dismiss predictably. |
| Keyboard + search/result tap + validation error | Focused content and next action visible; first handled tap works; no lost scroll context. |
| Tab/scope/query changes, detail open/back, realtime refresh | Each list restores/resets intentionally; controls and first results are visible; reading position does not jump unexpectedly. |
| Large populated lists | Virtualized result collections remain responsive; no speculative FPS/compliance claim without measurement. |
| Screen reader / keyboard / Reduce Motion | Logical focus order and restoration, named controls, non-gesture dismissal, stable compact states. |

## Explicit limits and remaining checks

- The native swipe-back complaint is **not fixed or device-reproduced** by this audit. Its shared source configuration is identified and should be tested first.
- Onboarding's fresh-account stages were source-reviewed without forcing the existing account through setup or mutating onboarding flags.
- Add Court intro was rendered. Direct `/add-court` without its entry context returns to Explore; those resulting Explore screenshots were rejected as Add Court evidence. Location/camera/details require the real entry sequence and camera/device access.
- No upcoming run existed in the current local-court state. Clicking the historical scheduled-game activity opened the actor profile; that is a separate navigation observation, not proof of run detail. Scheduled-game detail/edit/result are source-only.
- Pending/held match revision, subscription purchase/priced native plans, real native map gestures, push/location permission screens and actual software keyboard were not verified.
- Long-list virtualization issues are identified from eager row rendering; no native performance benchmark was run. Tiny touch targets are measured/visible risks; this is not a complete accessibility compliance audit.
- No layout fix was implemented. The audit proposes changes to the shared owners and explicitly preserves real server state and current business flows.
