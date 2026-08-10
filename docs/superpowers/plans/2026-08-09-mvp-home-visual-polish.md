# MVP Home Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Do not
> begin Court, Schedule, or Compete while the Home slice is incomplete.

**Goal:** Establish LocalCheck's reusable MVP presentation system and prove it
on the signed-in Home journey without changing working backend behavior.

**Architecture:** Keep SDK 54 and current services/contexts. Move display
decisions into pure presentation helpers and reusable components, then compose
Home from a fixed header, compact court context, bounded social sections, and a
remaining-height activity list. Use current StyleSheet/token infrastructure and
installed animation/navigation dependencies; add no package in this slice.

**Tech stack:** Expo SDK 54, React Native 0.81, Expo Router, React Native
StyleSheet/Animated, Safe Area Context, Expo Haptics, existing Supabase
contexts, Node test runner, TypeScript.

---

## Constraints

- Preserve auth, check-in, presence, feed, run, and Realtime behavior.
- Do not change Supabase schema or functions.
- Do not add NativeWind or any other dependency in this slice.
- Remove replaced Home implementations rather than keeping old/new variants.
- Do not change `PlayerAvatar` in ways that break existing callers.
- Keep the current fonts centralized behind typography roles; final font/mark
  art can change through tokens/assets without another screen rewrite.
- Browser preview is required, but it is not proof of haptics, safe areas, or
  native transitions.

## Task 1: Add tested Home presentation helpers

**Files:**

- Create: `components/home/homePresentation.ts`
- Create: `components/home/homePresentation.test.mts`
- Modify: `package.json`

- [ ] Write failing tests for structured run identity and activity copy.

  ```ts
  import assert from "node:assert/strict";
  import test from "node:test";
  import {
    formatActivityCopy,
    formatRunIdentity,
  } from "./homePresentation.ts";

  test("derives basketball format from capacity", () => {
    assert.equal(
      formatRunIdentity({ sport: "BASKETBALL", maxPlayers: 10, skillLevel: "ALL LEVELS" }),
      "5V5 · ALL LEVELS",
    );
  });

  test("derives pickleball format from capacity", () => {
    assert.equal(
      formatRunIdentity({ sport: "PICKLEBALL", maxPlayers: 4, skillLevel: "INTERMEDIATE" }),
      "2V2 · INTERMEDIATE",
    );
  });

  test("falls back honestly for an unsupported capacity", () => {
    assert.equal(
      formatRunIdentity({ sport: "BASKETBALL", maxPlayers: 7, skillLevel: "ALL LEVELS" }),
      "OPEN RUN · ALL LEVELS",
    );
  });

  test("separates actor and action in court-scoped activity", () => {
    assert.deepEqual(
      formatActivityCopy({
        playerName: "Jesse Harrick",
        courtName: "Rancho Cienega Sports Complex",
        message: "JESSE HARRICK CHECKED INTO RANCHO CIENEGA SPORTS COMPLEX",
        type: "checkin",
      }),
      { actor: "Jesse Harrick", action: "checked in" },
    );
  });
  ```

- [ ] Run the focused test and confirm module-not-found failure.

  ```bash
  node --no-warnings --experimental-strip-types --test \
    components/home/homePresentation.test.mts
  ```

- [ ] Implement pure helpers. Derive basketball `1V1` through `5V5` and
      pickleball `1V1`/`2V2` only when `maxPlayers` maps exactly; otherwise use
      `OPEN RUN`. Never display the arbitrary stored title as primary Home
      identity. Format check-in/out/run-started actions from feed type, with a
      readable normalized-message fallback for game results.

- [ ] Add `test:home-presentation` and include it in `pnpm test` alongside the
      existing Realtime test.

- [ ] Run tests.

  ```bash
  pnpm test:home-presentation
  pnpm test
  ```

- [ ] Commit.

  ```bash
  git add components/home package.json
  git commit -m "test: define Home presentation contract"
  ```

## Task 2: Complete the shared layout and identity tokens

**Files:**

- Modify: `constants/colors.ts`
- Modify: `constants/typography.ts`
- Create: `constants/layout.ts`
- Create: `components/ui/playerIdentity.ts`
- Create: `components/ui/playerIdentity.test.mts`
- Modify: `components/PlayerAvatar.tsx`
- Modify: `package.json`

- [ ] Add named layout tokens for screen gutter, header content height, bottom
      tab clearance, minimum touch target, spacing, and restrained motion.

  ```ts
  export const Layout = {
    screenGutter: 20,
    headerContentHeight: 56,
    tabBarClearance: 88,
    minTouchTarget: 44,
  } as const;

  export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
  export const Motion = { fast: 180, standard: 240, deliberate: 320 } as const;
  ```

- [ ] Add missing semantic color tokens for pressed, selected, and quiet-live
      surfaces; reuse the existing palette values rather than adding a second
      orange or sport theme.

- [ ] Write tests for deterministic fallback identity. The same `playerId`
      must always select the same geometric marker; different IDs can select
      from a bounded set. Initial normalization must support long handles and
      empty values.

- [ ] Extend `PlayerAvatar` compatibly with optional `playerId`, `name`, and
      `status` props. Keep existing `initials` callers working. Render a quiet
      deterministic geometric corner mark plus normalized initials; remove
      decorative elevation/orange glow from the default state. Keep friend and
      ranked semantics explicit and accessible.

- [ ] Run tests and typecheck.

  ```bash
  pnpm test
  pnpm typecheck
  ```

- [ ] Commit.

  ```bash
  git add constants components/PlayerAvatar.tsx components/ui package.json
  git commit -m "feat: add durable layout and player identity tokens"
  ```

## Task 3: Stabilize the application header and screen viewport

**Files:**

- Modify: `components/ScreenHeader.tsx`
- Create: `components/ui/ScreenViewport.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] Refactor `ScreenHeader` around a fixed content row. Safe-area inset sits
      above that row; `right` content cannot change header height or title
      baseline. Home uses the same component as all other primary tabs.

- [ ] Keep `SectionHeader` in this canonical file, but give actions a minimum
      44x44 target and use a normal label/count API instead of preformatted
      arbitrary right-hand fragments.

- [ ] Add `ScreenViewport` with `flex: 1`, background, optional header slot,
      and a content region. It does not render a root ScrollView.

  ```tsx
  export function ScreenViewport({ header, children }: PropsWithChildren<{ header?: ReactNode }>) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.content}>{children}</View>
      </View>
    );
  }
  ```

- [ ] Normalize tab-bar clearance and ensure Home content is not hidden behind
      the absolute tab bar at browser and iPhone heights.

- [ ] Run typecheck and web export.

  ```bash
  pnpm typecheck
  pnpm export:web
  ```

- [ ] Commit.

  ```bash
  git add components/ScreenHeader.tsx components/ui/ScreenViewport.tsx app/'(tabs)'/_layout.tsx
  git commit -m "feat: stabilize LocalCheck screen chrome"
  ```

## Task 4: Create the shared Home-facing components

**Files:**

- Create: `components/ui/CourtSummary.tsx`
- Create: `components/ui/CheckInAction.tsx`
- Create: `components/ui/PersonTile.tsx`
- Create: `components/ui/RunPreview.tsx`
- Create: `components/ui/ActivityRow.tsx`
- Create: `components/ui/index.ts`

- [ ] Implement a flat Court Summary with court name, address, a precise sport
      symbol, and only two useful contextual facts: presence now and next/upcoming
      run state. Remove decorative shader, giant local-court pill, four-column
      stat grid, weekly-active query display, and square navigation button.

- [ ] Make the court name/summary itself the accessible court-detail action.
      Add a quiet chevron aligned with the title rather than a detached square.

- [ ] Implement `CheckInAction` as a compact reachable dock/pill above the tab
      bar. Labels are `Check in` and `Checked in · Check out`; loading disables
      duplicate taps. Haptics remain in the screen action handler.

- [ ] Implement `PersonTile` using `PlayerAvatar`, a single-line name, explicit
      active meaning from section context, and optional friend state. Do not
      repeat `ACTIVE NOW` under each person.

- [ ] Implement `RunPreview` using `formatRunIdentity`. Present format/level,
      date/time, attendance/capacity, and court only when the context is not
      already court-scoped. No orange side rail and no arbitrary run title as
      the primary line.

- [ ] Implement `ActivityRow` using `formatActivityCopy`. Present actor,
      readable action, and subordinate timestamp without the broken timeline
      rail. Only use orange for an explicit unread/current-user/live semantic.

- [ ] Ensure every Pressable has role, label, pressed state, and 44x44 target.

- [ ] Run typecheck and export.

  ```bash
  pnpm typecheck
  pnpm export:web
  ```

- [ ] Commit.

  ```bash
  git add components/ui
  git commit -m "feat: add reusable social and court components"
  ```

## Task 5: Recompose signed-in Home

**Files:**

- Modify: `components/HomeScreen.tsx`
- Modify: `services/checkInService.ts` only if the now-unused weekly helper is
  private to Home and can be deleted safely

- [ ] Remove Home-only duplicate component implementations and their obsolete
      styles: `SportBallMark`, `HomeCourtSection`, four-stat layout, custom run
      strip, custom activity timeline, shader, giant local-court pill, and
      global active-count header.

- [ ] Keep one fixed Home composition:

  ```text
  stable LocalCheck header
  compact court summary
  Who's Here row with explicit count
  optional next RunPreview
  Activity heading
  remaining-height activity FlatList
  reachable CheckInAction above tabs
  ```

- [ ] Use `FlatList` for the activity region with `ListEmptyComponent`, stable
      keys, no nested vertical ScrollView, and bottom content padding for the
      check-in action/tab bar.

- [ ] Keep roster horizontal scrolling bounded to the people row. Show up to
      six people plus a clear remaining/hidden count state.

- [ ] Preserve current focus refresh, Realtime presence, friend sort,
      check-in/check-out, haptics, court navigation, run navigation, and feed
      filtering.

- [ ] Delete the weekly-active fetch from Home because the value is no longer
      presented. Delete the service export only if `rg` proves it has no other
      caller.

- [ ] Verify signed-in Home with zero, one, and two visible active players and
      with/without an upcoming run.

- [ ] Run checks.

  ```bash
  pnpm check
  pnpm export:web
  git diff --check
  ```

- [ ] Commit.

  ```bash
  git add components/HomeScreen.tsx services/checkInService.ts
  git commit -m "feat: redesign Home around live social context"
  ```

## Task 6: Make detail navigation deliberate

**Files:**

- Modify: `app/_layout.tsx`
- Modify: `components/ui/CourtSummary.tsx`
- Modify: `components/ui/RunPreview.tsx`

- [ ] Use one restrained Router card animation for Court, Run, Player, and
      related detail routes. Preserve the dark underlay and interactive back
      gesture. Do not use a shader or shared-element dependency.

- [ ] Add pressed-state transform/opacity only where it confirms a detail
      transition; keep the no-motion state equivalent.

- [ ] Check Reduce Motion before adding component-level transform motion. If a
      reliable existing API is not already available, keep the Router-native
      transition and omit extra component choreography rather than building a
      motion subsystem.

- [ ] Run typecheck and export.

  ```bash
  pnpm typecheck
  pnpm export:web
  ```

- [ ] Commit.

  ```bash
  git add app/_layout.tsx components/ui/CourtSummary.tsx components/ui/RunPreview.tsx
  git commit -m "feat: clarify detail navigation motion"
  ```

## Task 7: Review the real browser state and document evidence

**Files:**

- Modify: `docs/product/design-qa/2026-08-09-mvp-walkthrough/MVP_REVIEW.md`
- Add: `docs/product/design-qa/2026-08-09-mvp-walkthrough/screenshots/home-after-web.png`
- Add after physical review:
  `docs/product/design-qa/2026-08-09-mvp-walkthrough/screenshots/home-after-iphone.jpg`

- [ ] Install exact dependencies and run the full local gate.

  ```bash
  pnpm install --frozen-lockfile
  pnpm check
  pnpm export:web
  ```

- [ ] Start the authenticated browser preview at the existing LocalCheck
      preview port and review at `430x932` and desktop width.

  ```bash
  pnpm start:web
  ```

- [ ] Capture browser evidence for: two active users, checked in, upcoming run,
      and activity populated.

- [ ] Verify on registered iPhone/TestFlight or an authorized development
      build: safe area, tab clearance, Check In/Out reachability, haptic,
      transition/back gesture, scrolling, and the same two-user state.

- [ ] Update the review doc with actual results and any deferred details. Do
      not claim physical verification before it happens.

- [ ] Run final checks and commit evidence.

  ```bash
  pnpm check
  pnpm export:web
  git diff --check
  git status --short --branch
  git add docs/product/design-qa/2026-08-09-mvp-walkthrough
  git commit -m "docs: record polished Home evidence"
  ```

## Completion criteria

- Home visibly follows the walkthrough direction, not merely new colors.
- The header, viewport, court summary, person tile, run preview, activity row,
  and check-in action are reusable components.
- The same information is not repeated in global header, metrics, and sections.
- Activity owns the remaining viewport and scrolls independently.
- No obsolete Home card/timeline implementation remains.
- Existing multi-user presence and Check In/Out behavior still work.
- Tests, TypeScript, and web export pass.
- Browser evidence is captured; native requirements remain explicitly pending
  until verified.
