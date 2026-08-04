# LocalCheck mobile screen system

Status: living implementation map for the pre-TestFlight foundation checkpoint.

This is the canonical route-to-shell contract. `DESIGN.md` defines what the
product should feel like, `DESIGN_FOUNDATION.md` defines the shared foundation,
and this file names which reusable implementation owns every current route.
New screens must enter this map before they introduce a new header, scrolling
model, card grammar, sheet, or modal shell.

## Shared sources

| Concern | Canonical implementation |
| --- | --- |
| Color and radius semantics | `artifacts/mobile/constants/colors.ts` |
| Spacing, control, shell, and motion constants | `artifacts/mobile/constants/layout.ts` |
| Type roles | `artifacts/mobile/constants/typography.ts` |
| Primary tab header | `artifacts/mobile/components/ScreenHeader.tsx` |
| Detail/back header | `artifacts/mobile/components/DetailHeader.tsx` |
| Owner and other-player profile structure | `artifacts/mobile/components/profile/ProfileScaffold.tsx` |
| Contextual court preview | `artifacts/mobile/components/sheet/CourtSheetHost.tsx` and `CourtSheetContent.tsx` |
| Focused form task | `artifacts/mobile/components/sheet/FormSheet.tsx` |
| Global navigation | `artifacts/mobile/app/(tabs)/_layout.tsx` and `app/_layout.tsx` |

Tamagui is a reference for the token architecture, not an installed styling
dependency. LocalCheck follows the same useful rule: semantic component states
resolve from shared tokens instead of local color values. A styling-engine
migration is not part of the foundation checkpoint.

## Primary destinations

| Route | Product role | Required shell | Scroll owner | Shared content | Current state |
| --- | --- | --- | --- | --- | --- |
| `/` | Home / live local-court pulse | `ScreenHeader` with `LOCALCHECK` and live-now metric | `HomeScreen` content | court identity, attendance, next run, activity | Foundation owner: `HomeScreen.tsx` |
| `/schedule` | Availability and run planning | `ScreenHeader` with +1h attendance metric | schedule content below fixed header | weekly grid, scheduled runs; form tasks use `FormSheet` | Foundation owner: `schedule.tsx` |
| `/compete` | Ranking and match entry | `ScreenHeader` with compact rank metric | active Compete tab | leaderboard and log-game states | Foundation owner: `compete.tsx` |
| `/explore` | Court discovery | `ScreenHeader` with courts-within-10-mi metric | list/map surface | court cards; court detail opens the shared court sheet | Foundation owner: `CourtsScreen.tsx` |
| `/elo` | Me | `ScreenHeader` with username and Settings action | `ProfileScaffold` content | identity, ELO, stats, activity, friends | Foundation owner: `elo.tsx` + `ProfileScaffold.tsx` |

The tab bar always remains Home, Schedule, Compete, Explore, Me. A new primary
destination requires an explicit navigation decision; it cannot silently add
a sixth tab or side drawer.

## Detail and task routes

| Route | Required shell | Shared structure | Presentation / notes |
| --- | --- | --- | --- |
| `/court/[id]` | `DetailHeader` | court identity, Feed / Locals / Details contract | stack card; contextual previews open in `CourtSheetHost` first |
| `/player/[id]` | `DetailHeader` | `ProfileScaffold` | stack card; owner-only capabilities hidden |
| `/run/[id]` | `DetailHeader` | run details; edit task uses `FormSheet` | stack card |
| `/match/[id]` | `DetailHeader` | final score review | stack card |
| `/friends` | `DetailHeader` | friend rows and states | stack card |
| `/notifications` | `DetailHeader` | notification rows and actions | stack card |
| `/settings` | `DetailHeader` | settings rows and controls | stack card |
| `/auth` | dedicated auth/onboarding shell | authentication and initial profile setup | full-screen gate, not a tab |
| `+not-found` | branded recovery shell | clear return action | must not fall back to default Expo styling |

`/(tabs)/feed` is a hidden legacy route. It is not a sixth destination and may
not define new foundation rules. Any remaining useful feed behavior should be
folded into Home or court Feed before the route is removed.

## Overlay contract

| Interaction | Primitive | Detents / dismissal | Visual contract |
| --- | --- | --- | --- |
| Court quick view | Gorhom `BottomSheetModal` | compact 46%, expanded 92%, downward pan or backdrop | one animated background, 28pt handle region, top-only hairline, shared graphite surface, top safe-area inset |
| Add a Court | shared `TaskBottomSheet` built on Gorhom `BottomSheetModal`, `BottomSheetScrollView`, and `BottomSheetTextInput` | 92%, downward pan, backdrop, or explicit close | one draggable surface, fixed task header, library keyboard handoff, one vertical scroller; sport is detected from the photo rather than user-selected |
| Host / edit a run, pick a court, availability | `FormSheet` | explicit close plus platform modal behavior | stable title bar, 44pt close target, keyboard and safe-area ownership |
| Destructive confirmation | platform alert or explicit confirmation task | explicit cancel and confirm | never disguised as a disclosure row |

The supplied Expo Router Drawer pattern is intentionally not used here. A side
drawer is appropriate for secondary global utilities; LocalCheck has five
stable top-level destinations and contextual court sheets, so adding one would
duplicate navigation and weaken familiarity.

## Screen acceptance checklist

Before a screen is considered foundation-complete:

1. It uses the mapped header and presentation shell.
2. Safe areas and keyboard behavior have one clear owner.
3. Only one vertical scroller owns the primary content region.
4. Type, spacing, controls, icons, color states, and minimum 44pt targets resolve
   from shared roles.
5. Loading, empty, error, offline, long-text, and Reduce Motion states are
   designed rather than inherited accidentally.
6. No realtime, auth, backend, or navigation contract changed as a side effect
   of visual work.
7. Typecheck, focused release checks, and a phone-size visual/gesture pass have
   evidence before the checkpoint is accepted.
