# Scroll and gesture fixes — approved implementation plan

Approved in chat October 29, including the correction that blank bands in the
user's screenshots were exposed during overscroll, not permanent spacing.

Scope: edge-restricted Back on pushed pages; one integrated court-drawer
scroller, pinned footer, stable opening detent and shared spring; anchored
Friends search, Compete scopes and Court filter/sort controls; tab scroll reset;
responsive Log game which only scrolls when content exceeds available height.
Evaluate bounce separately from responsive layout. No manual refresh is added.
Existing realtime reads/invalidation remain authoritative.

1. Capture baseline visual suite against the unchanged main export. Reproduce
   the Friends offset/control regression and Log game overflow in browser checks.
2. Change app/_layout.tsx's shared back option to explicit full-screen false;
   remove animationMatchesGesture. Preserve Back buttons and horizontal rows.
3. Extend AppBottomSheetModal only with optional footer/animation props. Court
   drawer owns one BottomSheetScrollView and BottomSheetFooter. Replace detail
   window math and layout-driven re-snapping with a stable opening detent. Use
   the existing Springs.sheet. Cover geometry bounds with behavior tests.
4. Move task controls outside list scrolling: Me Friends, Compete leaderboard,
   Court Live and Players. Reset the Me list when changing tabs. Disable bounce
   where content fits; keep page chrome outside overscrolling content.
5. Measure Log game body content/viewport, use flex and compact spacing where
   appropriate, disable scroll/bounce if it fits. Preserve overflow recovery for
   small screens, extra players, search, keyboard, and errors. Keep submit clear.
6. Check baseline/changed screenshots at 375x667, 393x852 and 430x932; exercise
   list controls after scroll, switching tabs, drawer open/expand/scroll/dismiss,
   form fit/overflow. Run pnpm check and full visual QA. Update current state,
   feedback and design docs. Inline final screenshots, not download-only links.

Files: app/_layout.tsx; components/sheet/{AppBottomSheetModal,CourtSheetHost,
CourtSheetContent}.tsx; lib/courtDrawerLayout.ts and its existing tests;
app/(tabs)/{compete,elo}.tsx; app/court/[id].tsx;
components/court/CourtPlayersPanel.tsx; components/game/LogGameForm.tsx;
existing shared keyboard wrapper only if required for measured scrolling;
related docs and proportional browser regression/visual-QA cases.

Verification distinction: Jesse's actual iPhone report establishes the failing
Back behavior. Automation after the change is regression evidence, not a
prerequisite for accepting his report. Discover available native targets and
record actual native results or concrete tooling failures; do not relabel web
results as iOS. Do not build/release an EAS binary, OTA or backend change.

## Literal Back configuration comparison

The four supplied pages cover scroll ownership, gesture roots/detectors,
coordination and platform differences. They do not prescribe native-stack's
Back configuration. The installed native-stack/screens option types establish
what our flags mean. This app had explicitly opted into starting Back anywhere:

```diff
 const detailScreenOptions = {
   gestureEnabled: true,
-  fullScreenGestureEnabled: true,
-  animationMatchesGesture: true,
+  fullScreenGestureEnabled: false,
 };
```

False is explicit because installed native-stack documents different defaults
across iOS versions (including full-screen default on iOS 26). Removing the
flag alone could retain the defect on that runtime. Interior vertical/diagonal
reading gestures now remain outside Back's activation region; the native edge
Back and visible Back button stay enabled. The horizontal roster also uses
iOS directional locking. No custom full-screen pan recognizer or guessed
velocity threshold has been added.

## Verification record

- Main baseline: full visual suite, 40 states × 3 phone sizes, zero hard
  failures; 23 above-baseline accessibility entries already present. Baseline
  was not raised. Reports `/tmp/localcheck-visual-before/report.md`.
- RED Friends regression before the fix: switching from scrolled Activity
  placed the search field at y=-6. After the fix search stays at y=339 at
  375×667, including after scrolling results.
- agent-device iOS discovery attempted, returned `UNSUPPORTED_PLATFORM`:
  `Apple tools are only available on macOS`. Host is Linux, no remote Apple
  target configured. No post-change native recording claimed.

- `pnpm check`: passed; 263 tests across the suite, plus type/design/docs checks.
  Detent tests also rerun after their descriptive assertion cleanup: 3/3.
- Connected-preview browser assertions passed at 375×667, 393×852, 430×932:
  Friends search anchored; Compete scope/Court sort positions unchanged after
  scroll input; drawer footer pinned through expansion and scrolling; opening
  footer position unchanged between post-open and later data-settle samples.
- Log game measured body/content in connected preview: 346/347 (one-pixel rounding tolerance), 531/531,
  611/611 respectively, with scrolling disabled. At 375×667 3v3 content is
  451px in a 346px body and scrolling stays enabled. No page errors recorded.
- Independent read-only review found no actionable regressions in Back,
  installed Gorhom integration, sticky controls, tab resets or form logic.

- Final review follow-up identified lost keyboard recovery after anchoring
  Friends search: the old KeyboardAwareScrollView cannot move an input outside
  its subtree. Me now uses the installed keyboard-controller visibility hook
  to hide its profile summary while Friends' native keyboard is open and
  restores it when closed. No focus-only layout movement or new gesture added.
  Native keyboard runtime remains unavailable on this Linux host.
- Full changed visual run: 44 × 3 = 132 captures, zero hard failures. Two
  additional ratchet entries came from newly visible existing small score
  labels/low-contrast separator on compact Log game. Score labels increased
  to 11pt and separator contrast corrected; targeted rerun recorded below.

- Final form visual rerun after accessibility correction: 4 states × 3 sizes,
  zero hard failures and zero above-baseline entries. Raw full-suite report
  remains preserved with its original 25 entries; two were resolved by this
  follow-up, leaving the same 23 above-baseline entries seen on unchanged main.
  No accessibility limits were raised. `/tmp/localcheck-visual-final-form`.
- Drawer footer Players navigation, sheet dismissal and browser Back to Explore
  exercised successfully. These are web navigation checks, not native swipes.
- Final source review confirms the keyboard-controller hook has safe web no-op
  bindings and that Friends search stays mounted during profile-summary changes.

Ruling: keep explicit false rather than merely omitting the full-screen flag,
so native-stack's iOS 26 default cannot reactivate interior Back. Cost: the
app deliberately opts out of that OS full-screen convention to satisfy the
confirmed reading-scroll behavior Jesse requested.

Ruling: allow Friends' profile summary to yield only during native keyboard
visibility. Moving search out of the keyboard-aware list otherwise loses
recovery on short phones. Cost: the summary temporarily disappears while
searching; query/focus stay mounted and the summary returns on hide.

Release status: local branch/workspace only; no merge, push, OTA, native build
or backend mutation. Connected preview remains on 127.0.0.1:8081.

- Final Me rerun: 11 matching states × 3 sizes (the name filter also matched
  Home and several game states), zero hard failures. Its five above-baseline
  entries are the same Home entries present on main; no Me/form regression.
- Combined final results replace the affected states in the full sweep with
  their reruns: 132 unique captures/states, zero hard failures, 23 preexisting
  above-baseline entries. Official visual command remains nonzero for that
  existing debt; this is not an all-green accessibility claim.
