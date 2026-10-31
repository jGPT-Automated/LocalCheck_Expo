---
name: ui-done
description: LocalCheck's definition of done for any change a player can see (layout, spacing, type, colour, copy placement, a component, a sheet, a screen). Load before starting UI work and again before saying it is finished, pushing, or opening a PR. Holds the bar (Apple's UI dos and don'ts, the app's hard layout rules, the UX checks), the mandatory visual QA run (`pnpm qa:visual`, three phone sizes), the no-regression procedure, and what the PR must show Jesse. Use for "polish", "fix the UI", "make it look right", "redesign this screen", any screenshot or annotation from Jesse, or any change to a shared component.
---

# UI definition of done

Jesse makes product decisions. He does not catch cut-off text, overlapping
labels, off-centre art or a layout that breaks on a small phone. If he finds
one, the work was not done. Nothing reaches him until it passes everything
below, on the rendered screen, at three phone sizes.

"It typechecks", "it looked fine at one size" and "I reviewed the code" are
not evidence. A screenshot of every screen you touched, at every size, is.

## 1. The bar

### Apple's UI dos and don'ts (developer.apple.com/design/tips)

| Rule | How it is checked here |
|---|---|
| Content fits the screen: no zooming, no sideways scrolling | `qa:visual` fails on sideways page scroll and off-screen text |
| Touch controls feel natural (real buttons, switches, sheets) | Review: shared components only (section 2) |
| Hit targets at least 44 x 44pt | `qa:visual` counts small targets (ratchet); use `hitSlop` to reach 44 when the visual must stay small |
| Text at least 11pt | `qa:visual` counts text under 11px (ratchet). New or changed text is 11pt or larger |
| Ample contrast | `qa:visual` counts text under 4.5:1 (3:1 for 18pt+, or 14pt+ bold) (ratchet). New text passes |
| Text never overlaps; spacing keeps it legible | `qa:visual` fails on overlap, cut-off and clipped text |
| High-resolution images | Assets at @2x and @3x; never upscale a small asset |
| Images keep their aspect ratio | Review: `resizeMode` contain/cover, never stretch |
| Controls sit next to what they change | Review (UX checks below) |
| Alignment shows what belongs together | Review: shared left edges, equal gutters, centred means centred on the screen |

A **failure** blocks the change. A **ratchet** count may never go up on any
screen (scripts/visual-qa/baseline.json); lower it when you can and commit
the new baseline in the same PR.

### LocalCheck hard rules (docs/product/DESIGN.md "Layout rules")

- The tab bar is a floor; sheets open in front of it. Nothing renders under it.
- Every row holding a name or a number is built for the longest username
  (10 characters, the signup limit) and four-digit values. No ellipsis on a
  name that short, no clipped button label at any size.
- One rhythm per list; equal columns use `flex: 1, flexBasis: 0`; numbers
  that line up use tabular figures.
- Centre status labels optically. No box inside a box.
- Motion: nothing animates on open (D42).
- Reuse the canonical component (DESIGN.md table). A look-alike is a defect.
- Every drawer is the Explore drawer (`AppBottomSheetModal` via
  `RunFlowSheet` / `FormSheet`). No centred `Modal` pop-ups for content.
- Small phones (375 x 667) get the full experience: if a screen can't fit,
  the content scrolls; it never squeezes a grid to one row or clips a card.
- Floating buttons (the Schedule +) never cover a control; give scroll
  content bottom clearance.
- No new wording without Jesse's sign-off (AGENTS.md UI change gate).

### UX checks (ask of every changed screen)

- Hierarchy: one thing is obviously first (Prägnanz, Von Restorff).
- Grouping: related items closer than unrelated ones (proximity, similarity).
- Familiar patterns over invented ones (Jakob's law); same style for the same
  function everywhere.
- Fewer, clearer choices (Hick's law); the main action in the thumb zone and
  big enough (Fitts's law).
- Important items first or last (serial position); progress shown where a
  task has steps (Zeigarnik).
- The simplest version that works (Occam, Tesler); forgiving inputs (Postel).
- Responds within 400 ms (Doherty); a strong end to a flow (peak-end).

### Native feel (Expo native-ui guidance that applies on Expo Go SDK 54)

- Before calling a screen done: walk its main task, one failure and recovery
  when it loads or saves, back and dismiss, the keyboard. Try the longest
  name, missing data, an empty list, and large system text.
- Four states for anything that loads: loading, error, empty, content. Never
  flash the empty state during the first load.
- A form's main action never sits under the keyboard.
- Not for this app: `@expo/ui`, SDK 56+ APIs, NativeTabs, and anything that
  needs a development build (AGENTS.md: previews run in Expo Go on SDK 54).
  SwiftUI and iOS 26 guidance still applies as *behaviour*: native sheets,
  real switches, 44pt targets, safe areas. Match it with the stack we have.

## 2. Before you change anything

1. Find the owning component (`rg`) and every screen that uses it. A change to
   a shared component is a change to all of those screens. That list of
   screens is your QA list for this change. Nothing else gets screenshotted.
2. Restate the exact scope. An adjacent problem goes in the log, not silently
   into the change.

## 3. Visual QA: the PR's Vercel preview against live (default)

> **Hard rule: screenshot only what the change affects.** Screenshot only the
> screens, states and sizes the diff actually changes. Never screenshot every
> screen, never run the full local suite, and never re-shoot something that
> already passed. A wording-only change gets one screenshot of that screen.
> After a fix, re-shoot only the screen and size that failed. Never delete a
> screenshot until Jesse has seen it. Send the before/after pairs to Jesse as
> soon as they exist. Breaking this rule wastes his time and the session's
> budget, and the work is not done.

Do this. Do not build the app locally and do not run the whole screen suite.

1. Push the branch and open the PR. The Vercel bot comments the branch's
   **Preview** link on the PR (`localcheck-app-preview-git-<branch>-…vercel.app`)
   within a few minutes. Read it from the PR comments; don't guess it.
2. The **live** link is `main`'s deployment:
   `https://localcheck-app-preview-git-main-jgpt-automated.vercel.app`.
3. In both, sign in with the QA test account. Ask Jesse for the login; never
   write it into the repo.
4. Screenshot **only the screens on your QA list** (section 2), each in the
   states the change affects (e.g. a drawer peeked and expanded), at 375x667
   and 393x852. Same screen, same state, same size on preview and live.
5. Put each pair side by side, open them at full size, and check: the change
   is there, nothing on those screens got worse, nothing is cut off,
   overlapping or misaligned. Both use real data, so pick a court or player
   that exists on both.
6. Post the pairs on the PR (section 4).

Re-checking after a fix: re-screenshot only the screen and size that failed,
on the new preview. Never redo screens that already passed.

### Fallback: local suite (only when the Vercel preview can't be used)

`pnpm qa:visual` builds the app and checks screens against an in-memory
Supabase stand-in. It is slow (a full web export every run), so always scope
it: `QA_ONLY=<screen names>` and `QA_SIZES=375x667,393x852` to the QA list.
Never run it unscoped, and never run it twice for the same build.

```bash
EXPO_PUBLIC_SUPABASE_URL=https://ci-placeholder.invalid \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder \
EXPO_PUBLIC_MAPBOX_TOKEN=pk.ci-placeholder \
pnpm export:web -- --output-dir /tmp/localcheck-ci-export
QA_ONLY=explore,court-live QA_SIZES=375x667,393x852 \
pnpm qa:visual /tmp/localcheck-ci-export --out /tmp/localcheck-visual-qa
```

Add a row to `scripts/visual-qa/screens.mjs` for any new screen or state so
the fallback can reach it.

## 4. Done means

- [ ] `pnpm check` passes.
- [ ] Preview vs live screenshots taken for every screen on the QA list (section 3).
- [ ] Every touched screen opened at full size at 375 and 393, compared with
      its before screenshot; nothing that was right got worse.
- [ ] Interactions exercised: tap, back, dismiss, swipe, keyboard, loading,
      empty and error where they apply.
- [ ] The PR has a comment logging each change (what, where, why, which rule)
      with before and after screenshots, and says what was not checked
      (device-only behaviour: keyboard, haptics, gestures, safe areas on a
      real phone).
- [ ] The Expo Go preview on the PR has been opened on a phone, or the PR says
      it hasn't.

If any box is unticked, say so plainly. Do not call it done.
