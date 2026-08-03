# LocalCheck Mobile Design Foundation

Status: Confirmed for the pre-TestFlight design checkpoint on 2026-08-01.

## Outcome

LocalCheck should feel like one product on every screen before distinctive
effects are added. The foundation checkpoint standardizes the app shell,
typography, spacing, controls, profile structure, sheets, icons, accessibility,
and restrained motion without changing working data, realtime, navigation, or
backend contracts.

The approved direction combines three visual probes:

- Editorial Control supplies the layout discipline, density, spacing, and
  restrained component grammar.
- Live Court Signal supplies court identity, live energy, personal momentum,
  and meaningful milestone moments.
- Native Precision supplies familiar iOS behavior, reusable profile structure,
  and interaction clarity.

## Product scene

A player checks LocalCheck outdoors, often one-handed and in changing light,
to decide where to play, see who is present, coordinate a run, or understand
their own momentum. The interface must read quickly, remain familiar, and make
live court information feel valuable without turning every action into a show.

## Foundation contract

### App shell

- Home, Schedule, Compete, Explore, and Me share one header height, safe-area
  treatment, horizontal gutter, mark size, title baseline, and divider.
- The bracket-check mark always appears at the left of the primary title.
- Home uses the actual `LOCALCHECK` wordmark. Schedule, Compete, Explore, and
  Me use the same wordmark-grade type role so the lockup keeps one optical
  height, weight, and tracking while its title changes.
- Me uses `@USERNAME` as its title and places Settings in the consistent
  top-right action area. The notification inbox remains available from
  Settings rather than competing with the primary header.
- Detail routes use one familiar back-header component. The left-edge mark
  resolves into the standard back affordance inside the same footprint instead
  of switching to an unrelated boxed chevron. Reduce Motion skips the spatial
  transition.
- Every primary header reserves the same compact 44-point trailing slot. Live
  or contextual data must fit inside that slot and cannot change the header
  height, title size, or title baseline.
- Home shows players live now, Schedule shows the one-hour attendance
  look-ahead, Explore shows the bounded count of courts within 10 miles, and
  Compete shows rank visibility. Me uses the same slot for Settings.
- The five labeled tab destinations remain familiar and unchanged.

### Profiles

- Me and another player's profile share one scaffold for identity, ELO, stats,
  tabs, activity rows, friends, loading, empty, and long-content behavior.
- Owner-only actions such as settings and notifications are capability-based
  variants of the shared scaffold.
- Other-player actions such as friend state and log game are capability-based
  variants, not a separate legacy experience.
- Existing profile, friendship, match, and realtime services remain the source
  of truth.

### Visual language

- Graphite surfaces and off-white text remain the base.
- `#FF5500` remains the only identity accent and is reserved for live state,
  current selection, focus, and primary actions.
- Win, loss, warning, and error colors appear only for their semantic meaning.
- Court identity is communicated through name, place, sport label or geometry,
  live truth, people, next run, access, and actions. It is not reduced to a
  generic card skin.
- Cards are used only for real interaction boundaries. Spacing, type, and
  dividers provide most grouping.
- One icon vocabulary is used per platform. iOS should prefer SF Symbols where
  the current Expo build supports them.

### Typography and spacing

- The shared header wordmark role is Oswald 500 at 23 points with 1.5 points of
  tracking. It is deliberately lighter and smaller than the previous 27-point
  title treatment. Other Oswald roles remain reserved for display titles,
  rankings, scores, and compact metrics.
- Inter carries body copy, labels, controls, metadata, and accessibility-first
  reading.
- Small text has a practical floor. Core labels and metadata do not rely on
  7px or 8px type to fit.
- Numeric data uses tabular figures where alignment matters.
- A semantic 4pt spacing scale and one primary screen gutter replace local
  mixtures of 16, 18, 20, and 24 pixels.
- Every interactive target is at least 44 by 44 points, even when the visible
  icon or control is smaller.
- The compact product scale is navigation 23/27, dynamic navigation identity
  17/22, compact title 16/20, body 14/20, supporting 12/16, label 11/16, large
  metric 24/28, and compact metric 18/22.
- Long handles use the dynamic identity role. They do not inherit the full
  wordmark-sized screen-title role merely because they appear in the header.

### Motion

- Press feedback is immediate and restrained.
- State transitions generally complete within 150 to 250 milliseconds.
- Layout changes may use 250 to 400 milliseconds when the movement explains
  where content went.
- Haptics reinforce high-value iOS actions such as check-in, Set Local, friend
  acceptance, availability save, and confirmed match outcomes.
- Reduced Motion replaces spatial movement and looping pulse with a static or
  short opacity response.
- Number transitions are reserved for changing live attendance, ELO deltas,
  streaks, capacity, and milestone progress.

### Sheets and forms

- The court preview remains on the proven Gorhom sheet path for the checkpoint.
- The sheet uses one continuous background and top-only outline so scrolling
  content cannot reveal a visual seam around the moving container.
- Forms use the established Expo modal or form-sheet path, safe areas, keyboard
  behavior, dirty-close handling, and native date/time controls where possible.

## Checkpoint scope

Included:

1. Shared tokens and interaction constants.
2. Unified primary and detail headers.
3. Shared Me and other-player profile scaffold.
4. Consistent buttons, tabs, segments, icon buttons, async states, and sheets.
5. Minimum type and touch-target corrections on primary journeys.
6. Reduced Motion and restrained iOS haptic behavior.
7. Expo Go, web-preview, and release-path verification.

Deferred until after this checkpoint:

- Shader-driven post-launch reveal.
- Animated number library adoption beyond an isolated compatibility spike.
- Card-to-full-screen morph transitions.
- Broad navigation replacement, styling-engine migration, or backend redesign.

## Transition decision

The Explore and map card-to-full-screen interaction remains a high-value
standout opportunity, but it is not part of the foundation release candidate.

- React Navigation shared-element transitions are currently experimental.
  Fabric support requires Reanimated 4.2 or newer and an explicit feature flag.
  LocalCheck currently resolves Reanimated 4.1.7.
- `react-native-morph-card` is a native Fabric module. It requires a native
  build and cannot be proven through the Expo Go checkpoint. Gesture-driven
  dismissal also remains on its roadmap.
- Expo Router Apple Zoom is the preferred future comparison because it follows
  native iOS interaction, but its current documented path requires Expo SDK 55
  and iOS 18 or newer. LocalCheck currently uses Expo SDK 54.

The foundation uses a polished pressed state and normal stack navigation. A
later isolated branch will compare the three transition paths against real
court cards, back gestures, scrolling, Reduce Motion, Android fallback, Expo Go,
and TestFlight build cost.

## Acceptance gate

The foundation checkpoint is ready only when:

- Every primary route has the same header geometry.
- Me and another-player profiles clearly belong to the same component family.
- No principal action has a touch target smaller than 44 points.
- Primary screens no longer rely on illegible 7px or 8px labels.
- Tabs, segmented controls, buttons, and detail headers share one vocabulary.
- Court-sheet scrolling no longer exposes the visible seam.
- Reduce Motion is respected by shared motion primitives.
- Typecheck and focused tests pass.
- The browser preview is visually inspected and corrected after the first pass.
- The candidate is exercised in Expo Go before any new TestFlight build.
- A native build is required only when the approved changes actually add or
  alter native dependencies or configuration.

## Anti-goals

- No backend or realtime rewrite.
- No fake product data or fake state.
- No component-library migration for its own sake.
- No expanding action grid in the tab bar.
- No decorative glass, excessive glow, gradients, or motion choreography.
- No one-off screen polish that bypasses the shared foundation.
