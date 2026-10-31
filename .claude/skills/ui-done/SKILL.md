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

## 3. Visual QA: how to do it

Visual QA has three parts: screenshot only what changed, measure it instead
of eyeballing it, and check that the same element looks the same everywhere it
appears. Do all three for every visible change.

### 3a. Screenshot only what the change affects

1. Before touching code, write the QA list: the screens and states the diff
   changes (from section 2), and the sizes where the change could look
   different (375x667 and 393x852 when layout or text width is involved; one
   size for a colour or wording change). Nothing else gets screenshotted.
2. Push and open the PR. Read the branch's Vercel **Preview** link from the
   Vercel bot's PR comment. The **live** link is `main`'s deployment:
   `https://localcheck-app-preview-git-main-jgpt-automated.vercel.app`.
3. Sign in on both with the QA test account (ask Jesse for the login; never
   write it into the repo) and shoot the QA list on live once and on the
   preview: `scripts/visual-qa/preview-shots.cjs`, with `ONLY=` set to the
   QA list. Same court or player, same state, same size on both.
4. Pair each live/preview shot side by side, labelled BEFORE and AFTER.
5. Send the pairs to Jesse as soon as they exist, commit them to
   `docs/product/design-qa/<yyyy-mm-dd>-<topic>/`, and post them in a PR
   comment. Never delete a screenshot.
6. After a fix, re-shoot only the screens and sizes the fix touched. Never
   re-shoot what already passed, never shoot every screen, and never run the
   local suite unscoped.

### 3b. Measure, don't eyeball

For each changed screen, measure these with `scripts/visual-qa/measure.py`
(ink bands from the PNG) or the DOM (`getBoundingClientRect` on the preview),
and fix anything that is off before anyone sees it:

- **Stacked text is evenly spaced.** The ink gap above the court name equals
  the ink gap below it (sport label, name, city).
- **Things in a row share a line.** In a numbers strip, every value starts on
  the same row and every label starts on the same row. A unit ("1h") must
  never push its cell's label down.
- **Things are centred where they sit.** A number is centred in its cell.
  Background art is centred on the text it sits behind.
- **Edges are symmetrical.** Side gutters are equal. A control on the right
  sits the same distance in from the edge as its partner on the left (back
  arrow and local mark).
- **Hierarchy is deliberate.** Exactly one or two things draw the eye (the
  court name and the live number). Supporting numbers are quieter, never the
  same size as the headline.

Write the measured numbers in the PR comment next to the pairs.

### 3c. Continuity: one element, one look

When an element appears on several screens, it must look the same on all of
them. Build it as one shared component, then put the screenshots of every
place it appears side by side as a set and compare them. The court header is
`CourtTitleRow`, used by the Explore card, the drawer, the court page and
Home: same name position and size, same live number on the right, same art
offset. The numbers band under it is the same on the drawer and Home. A
control that belongs to one screen (the local + / check is on the court page
only) appears nowhere else.

### 3d. Change only what was asked

Make the change Jesse asked for and nothing more. If you see something else
that's off, put it in the PR's handoff or ask, and don't change it silently.

### Fallback: local suite (only when the Vercel preview can't be used)

`pnpm qa:visual` builds the app and checks screens against an in-memory
Supabase stand-in. It is slow (a full web export every run), so always scope
it with `QA_ONLY=<screen names>` and `QA_SIZES=375x667,393x852`, and never
run it twice for the same build.

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
