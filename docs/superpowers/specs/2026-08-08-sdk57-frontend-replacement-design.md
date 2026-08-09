# SDK 57 frontend replacement design

Date: 2026-08-08  
Status: Approved architecture; implementation planning pending written-spec review  
Base: `codex/lifecycle-reset` at `fed17ce`

## Decision

Replace the LocalCheck frontend with a clean Expo SDK 57 client inside the
existing repository and product identity. Preserve the production Supabase
backend, Git history, Apple application, Expo/EAS project, and verified domain
contracts. Do not create a second production repository, Expo project, App
Store Connect application, bundle identifier, or Supabase project.

This is a controlled frontend replacement rather than either a big-bang new
product or an indefinite in-place restyle. The current application remains the
behavioral reference while the new client is delivered in verified vertical
slices.

## Goals

- Start the maintained client on the current stable Expo SDK, SDK 57.
- Build a coherent, reusable design system on stable NativeWind.
- Make routes thin and separate product behavior, server state, and UI.
- Establish predictable safe-area, fixed-region, list, form, and map layouts.
- Preserve working backend behavior and multi-user semantics.
- Make native, web, and TestFlight verification repeatable.
- Reach a dependable external TestFlight candidate without carrying retired
  frontend architecture forward.
- Make future SDK upgrades small, routine maintenance changes.

## Non-goals

- Rewriting or duplicating the Supabase backend.
- Creating an API tier or a client-side product-data store.
- Copying the existing frontend into a permanent `legacy` directory.
- Adopting an entire third-party component framework.
- Shipping NativeWind v5 while its maintainers label it non-production.
- Replacing Mapbox during the first external-MVP effort.
- Shipping Dynamic Island functionality before push notifications and active
  session behavior are verified on physical devices.

## Product identity invariants

| System | Existing identity |
| --- | --- |
| GitHub | `jGPT-Automated/LocalCheck_Expo` |
| Apple bundle identifier | `com.realjess.localcheck` |
| App Store Connect app | `6786909608` |
| Apple team | `6HHLJVQC6W` |
| Expo project | `agenticjess-os/localcheck` |
| EAS project ID | `9c906173-0258-45a9-a3fe-786cda373c66` |
| Supabase project | `qkrnmyexzvaxiqfxwwfb` |

Changing a checkout path, route implementation, dependency set, or UI does not
create a new external app. Any change to an identity in this table is out of
scope and requires explicit approval.

The canonical local checkout is
`/Users/jesseharrick/Documents/LocalCheck_Expo`. Repository documentation must
not otherwise depend on this machine-specific path.

## Baseline findings

The existing application proves the product behavior, but the frontend has
grown beyond the structure that should be carried forward:

- approximately 16,000 lines of client code;
- route or component files as large as 1,850, 1,275, and 985 lines;
- a shared application context of roughly 800 lines;
- styling spread across about 30 independent `StyleSheet` definitions;
- routes that combine layout, queries, mutations, navigation, modal state, and
  domain decisions;
- inconsistent ownership of scrolling and safe-area padding;
- only the Realtime hub covered by an isolated automated test.

The current code is an executable product specification and source of reusable
contracts, not the target frontend structure.

## Alternatives considered

### Upgrade and restyle in place

This has the smallest initial diff, but preserves oversized screens,
distributed layout decisions, global-context coupling, and inconsistent
styling. SDK failures would also be mixed with UI refactors.

### Create an independent application repository

This creates a clean blank canvas but duplicates GitHub, EAS, signing, release,
environment, and backend configuration. It risks a second app identity and
recreates the workspace ambiguity the lifecycle reset removes.

### Controlled replacement in the existing product

This is the selected approach. It keeps the product and deployment contracts
while rebuilding the frontend deliberately. Git preserves the old client, and
verified vertical slices limit replacement risk.

## Technical foundation

- Expo SDK 57 and its supported React Native, React, Xcode, and Node versions.
- Expo Router with thin route files and native stack behavior.
- TypeScript with strict type checking.
- Continuous Native Generation; generated `ios/` and `android/` directories
  remain uncommitted.
- pnpm with a committed lockfile.
- TanStack Query for server-state ownership, caching, and invalidation.
- Stable NativeWind `4.2.6` with Tailwind CSS 3.
- Reanimated for intentional state and navigation-adjacent motion.
- `react-native-safe-area-context` for all safe-area behavior.
- Supabase services and approved RPCs as the only product-data path.

The SDK foundation follows the official SDK 57 template conventions while
retaining every LocalCheck identity invariant. A generated sample must never
become a nested application or second source of truth.

### NativeWind foundation gate

Before feature porting, a minimal foundation must prove:

- native and web builds resolve NativeWind classes;
- semantic theme values and dark appearance render consistently;
- class styles coexist with Reanimated animated styles;
- the selected Skia version renders the planned FAB effect;
- Mapbox and bottom sheets accept their required explicit styles;
- type checking and production web export remain green.

NativeWind v5 preview is not an allowed fallback. If stable NativeWind fails
this gate on SDK 57, feature porting stops and this design is amended before a
different styling engine is selected.

## Source organization

```text
app/                    Thin Expo Router route composition
src/
  components/
    ui/                 Reusable accessible primitives
    brand/              LocalCheck visual identity
  features/
    auth/
    home/
    courts/
    schedule/
    compete/
    social/
    profile/
    notifications/
  data/                 Query keys, queries, and mutations
  services/             Supabase calls and response mapping
  realtime/             Scoped invalidation to query refresh
  theme/                Semantic design and motion tokens
  types/                Shared domain types
supabase/               Database and Edge Function source of truth
```

Routes own parameters and compose a feature screen. They do not contain
Supabase queries or substantial product behavior. Services own data access,
and query or mutation hooks translate service results into server-state UI.

## Data and state flow

```text
Route
  -> feature screen
  -> query or mutation hook
  -> domain service
  -> Supabase query or approved RPC
  -> Postgres transaction and RLS
  -> confirmed result
  -> query cache
  -> rendered state
```

Realtime remains invalidation, not an alternate state store:

```text
Scoped Supabase Broadcast
  -> subscription registry
  -> affected query keys
  -> authoritative refetch
  -> converged UI
```

The existing `AppContext` is decomposed. Authentication may remain a narrow
context, and Realtime lifetime may remain a provider. Product collections,
loading state, mutation results, and errors belong to feature queries and
mutations.

Optimistic UI is allowed only when failure can be represented and rolled back
without lying about server state. Check-in, game results, friendship changes,
schedules, and notifications do not show success before backend confirmation.

## Design system

NativeWind supplies the styling vocabulary; LocalCheck components supply the
product design system. Semantic tokens cover canvas and surface colors, text,
borders, product and sport accents, status colors, spacing, radii, typography,
elevation, motion, and interactive states.

The first primitive set includes screen, text, button, icon button, card,
avatar, badge, input, segmented control, list row, section header, sheet,
dialog, notice, loading state, empty state, and error state.

Third-party examples are adapted behind these primitives. A copied component
cannot introduce its own color system, spacing scale, navigation contract,
state library, or styling engine.

## Layout and scrolling contract

Every route begins with a shared root based on `SafeAreaView` from
`react-native-safe-area-context`, or a flexed `View` when the navigator owns the
relevant inset:

```tsx
<Screen className="flex-1 bg-canvas">
  <ScreenHeader />
  <View className="flex-1">...</View>
  <FixedActions />
</Screen>
```

- Root containers are fixed and flexed, never unbounded `ScrollView` roots.
- Headers, navigation, FABs, and persistent actions remain fixed when their
  task requires it.
- Repeating server data uses `FlatList`, `SectionList`, or a validated
  virtualized-list equivalent.
- `ScrollView` is reserved for bounded, relatively small content.
- Horizontal rails may scroll inside otherwise fixed screens.
- Forms use keyboard-aware scrolling only where content can be obscured.
- Map stages use a fixed `View` with `flex: 1`.
- The shared screen or navigator owns safe-area padding; routes do not invent
  inset magic numbers.

Existing `ScrollView` usage is not changed mechanically. Each screen is
recomposed according to its fixed and scrolling regions during its slice.

## Navigation, motion, splash, and FAB

Native stack gestures and transitions are the baseline. Reanimated is reserved
for state changes that benefit from continuity, including sheet presentation,
pressed feedback, expandable actions, and selected shared-element-like
moments. Motion remains responsive and provides a reduced-motion path.

Launch uses a static native splash that paints immediately, followed by a short
original React-rendered brand handoff after JavaScript and required assets are
ready. Supplied artwork may be used after its shipping rights and source are
recorded. The GPL splash-screen repository is reference only; its source is not
copied into LocalCheck.

The gooey FAB is reimplemented after the SDK and styling foundation passes. Its
actions are LocalCheck actions rather than sample video and voice actions. It
supports accessibility labels, reduced motion, safe-area positioning, backdrop
dismissal, and deterministic closure during navigation.

## Maps

Mapbox remains the map provider for the external-MVP milestone. It is already
integrated, supports the web strategy, and leaves room for later styling.
`expo-maps` is still alpha in SDK 57, lacks a web target, and uses different
platform providers.

The new client wraps mapping behind a `CourtMap` feature boundary. Court data,
selection, check-in, sheets, and navigation do not depend on Mapbox component
types, containing any future provider change.

## Notifications and Dynamic Island

Push registration and delivery remain a physical-device release gate. The UI
distinguishes permission denial, token failure, backend-registration failure,
and success.

Dynamic Island support is deferred until ordinary push delivery and active
session behavior pass. Its intended future use is a Live Activity for a court
check-in or scheduled run with a deep link to the relevant resource. It is not
part of the first external-TestFlight criteria.

## Delivery sequence

### 1. Repository and SDK foundation

- Work from the canonical checkout and a dedicated feature worktree.
- Reconcile with the merged lifecycle reset before implementation merges.
- Establish SDK 57 configuration while retaining identity invariants.
- Align Node, pnpm, EAS images, Expo packages, native dependencies, and lockfile.
- Use a runtime policy that prevents native-incompatible OTA updates.
- Produce a development build before native-dependent feature porting.

### 2. UI and data foundation

- Pass the NativeWind foundation gate.
- Add tokens and reusable primitives.
- Establish navigation, authentication gating, error boundaries, loading
  states, safe areas, and server-state ownership.
- Preserve and test the Supabase service boundary.

### 3. Vertical slices

Port and verify in this order:

1. authentication and profile provisioning;
2. home, court discovery, court detail, and check-in;
3. schedule, planned visits, and hosted runs;
4. competition, match review, results, and sport-specific ELO;
5. profiles, friendships, feed, and in-app notifications;
6. settings, account deletion, and native permission surfaces;
7. brand handoff, FAB, and remaining visual polish.

Each slice includes routes, queries, mutations, loading/empty/error states,
responsive browser view, physical-device view, and relevant multi-user test.

### 4. External TestFlight cutover

- Complete automated checks and production web export.
- Verify Apple Sign-In, SecureStore, Mapbox, location, notifications, account
  deletion, and update behavior on physical iOS hardware.
- Run simultaneous-user scenarios for presence, schedules, friendships, match
  review, ELO, feed, and notifications.
- Upload a new build of the existing App Store Connect app.
- Retain the known-good TestFlight build and Git tag until acceptance.

## Error handling

Every data-driven surface has explicit loading, empty, recoverable-error, and
fatal-error behavior. Actions expose progress and prevent duplicate submission.
Backend errors map to actionable messages without exposing SQL, tokens, or
implementation details.

The app-level error boundary offers safe recovery and development diagnostics.
Production error tracking is introduced before external distribution if it
does not block the MVP candidate; otherwise it is the first post-candidate
lifecycle improvement.

## Verification

Automated gates include lockfile installation, Expo Doctor, TypeScript, unit
tests for domain mapping and Realtime invalidation, service contract tests,
critical component-state tests where practical, production web export, and an
iOS native build.

Browser and simulator review covers signed-out/in routing, responsive layout,
bounded scrolling, loading/empty/error/populated states, keyboards, deep links,
reduced motion, labels, focus order, contrast, and text scaling.

The physical multi-user matrix proves:

- authoritative court presence converges for at least two users;
- court switching is atomic and backgrounding does not check a user out;
- planned visits and run membership converge;
- friendship request, acceptance, and removal converge;
- match submission and review apply ELO exactly once;
- in-app and push notifications route to the correct resource;
- permission and token failures recover clearly;
- Apple Sign-In and account deletion complete correctly.

## Release and rollback

The first SDK 57 client is a new binary for the existing application, not an OTA
to an SDK 54 runtime. The application version advances before the candidate,
and EAS build numbers continue to increment remotely.

The existing production/TestFlight binary remains available during
development. The replacement is not promoted until native and multi-user gates
pass. Rollback restores the known-good TestFlight build and reverts the client
release; database contracts remain backward compatible during cutover.

Backend changes required by a slice deploy compatibly before client activation.
No destructive schema change may break the installed binary.

## Acceptance criteria

- SDK 57 passes Expo Doctor, TypeScript, tests, web export, and iOS build.
- Apple, Expo/EAS, GitHub, and Supabase identities remain unchanged.
- Approved MVP journeys have functional parity.
- Route roots follow the flex/safe-area contract.
- Repeated data is virtualized and scrolling is intentional.
- Durable state comes from Supabase through services and approved RPCs.
- The physical multi-user and notification matrix passes.
- Browser and registered-iPhone visual review passes.
- The PR records commands, devices/accounts, native build, risk, and rollback.
- The known-good binary remains recoverable.

## Documentation impact

Implementation updates the existing authority files instead of adding parallel
runbooks: `docs/ARCHITECTURE.md`, `docs/CURRENT_STATE.md`,
`docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/RELEASE.md`, and
`docs/product/DESIGN.md`.

This specification is the design authority until replacement completes. The
implementation plan may split it into multiple pull requests, but cannot change
identity invariants or backend boundaries without a reviewed design amendment.
