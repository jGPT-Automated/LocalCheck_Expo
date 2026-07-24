---
version: "alpha"
name: LocalCheck
description: >-
  Dark editorial brutalism for a live pickup-sports presence app. Court
  scoreboard crossed with a magazine spread — big type, hard edges, live data.
colors:
  primary: "#FF5500"
  background: "#0D0D10"
  surface: "#151519"
  surface-high: "#1E1E26"
  border: "#28282F"
  border-subtle: "#1E1E24"
  text: "#F2F2F6"
  text-secondary: "#9A9AAA"
  muted: "#72728A"
  muted-dark: "#3A3A50"
  accent-dim: "rgba(255,85,0,0.12)"
  accent-glow: "rgba(255,85,0,0.35)"
  win: "#00E87A"
  loss: "#FF3B5C"
  overlay: "rgba(0,0,0,0.75)"
  tier-platinum: "#E8E8FF"
  tier-gold: "#FFD53D"
  tier-silver: "#9A9AAA"
  tier-bronze: "#CF8558"
  brand-navy: "#1F2733"
  brand-cream: "#F2EFE6"
typography:
  h1:
    fontFamily: Oswald
    fontWeight: 700
    fontSize: 32px
    letterSpacing: 0.5px
  stat:
    fontFamily: Oswald
    fontWeight: 700
    fontSize: 48px
  heading-regular:
    fontFamily: Oswald
    fontWeight: 400
    fontSize: 28px
  body-md:
    fontFamily: Inter
    fontWeight: 400
    fontSize: 14px
    lineHeight: 22px
  label-caps:
    fontFamily: Inter
    fontWeight: 600
    fontSize: 11px
    letterSpacing: 2px
rounded:
  xs: 2px
  sm: 3px
  md: 5px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 20px
  xl: 24px
  2xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#000000"
    rounded: "{rounded.xs}"
    padding: 14px
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.xs}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 16px
  chip-selected:
    backgroundColor: "{colors.accent-dim}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  sheet:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.lg}"
---

# DESIGN.md — LocalCheck design system

> Machine-and-human-readable design reference for anyone (agent or person)
> touching LocalCheck UI, following the google-labs-code/design.md format
> (front-matter tokens are normative; prose says why and how). Code source of
> truth: `artifacts/mobile/constants/colors.ts` + `constants/typography.ts` —
> if code and this file disagree, fix whichever is wrong in the same session.
> Validate edits with `npx @google/design.md lint DESIGN.md`.

## Overview

**Dark editorial brutalism.** Nike SNKRS × Victory Journal: confident,
information-dense, zero decorative fluff. The app should feel like a court
scoreboard crossed with a magazine spread — big type, hard edges, live data.

- Dark always. There is no light mode.
- Orange `{colors.primary}` is *live energy* — reserved for live states,
  primary actions, and selection. If everything is orange, nothing is live.
- All-caps Oswald for headings/stats/labels; Inter for reading.
- 1px borders define structure — never drop shadows.
- Sharp corners (2–8px max). Nothing pill-shaped except where iOS demands it.

## Colors

Token values live in the front matter and `constants/colors.ts`.

- **primary (#FF5500)** — live, active, selected, primary CTA. Sole
  interaction driver.
- **background / surface / surface-high** — the three depth steps. No other
  background hexes exist.
- **win / loss** — outcome colors only (wins, friend badges / losses,
  destructive, errors). Red/yellow are never decoration; court map states
  must not use danger colors (Quiet ≠ warning).
- **tier-*** — rank tiers on leaderboards and avatars.
- **brand-navy / brand-cream** — logo mark + app icon only; never UI chrome.

**Rules:** never introduce new hex values inline — add a token or use an
existing one.

## Typography

- `h1`: Oswald 700, ALL CAPS, tight tracking — headings, stats, screen titles.
- `stat`: Oswald for big numbers; stats get Oswald at 36px+.
- `body-md`: Inter 400/500/600/700 for everything readable.
- `label-caps`: 11–12px caps Inter SemiBold with 2px tracking.
- Full size scale (`constants/typography.ts` `FontSizes`): `xs 11 · sm 12 ·
  md 14 · base 16 · lg 18 · xl 22 · 2xl 28 · 3xl 36 · 4xl 48 · stat 64`.
- Never use Oswald for body copy.

## Layout

- Base grid: **4px**. Spacing steps in front matter.
- Screen gutter: **20px** horizontal (`paddingHorizontal: 20`).
- **Touch targets ≥ 44×44pt** (Apple HIG). No exceptions, including chips
  and list rows.
- Safe areas: respect insets everywhere; content must never sit under the
  tab bar or notch. A button hidden behind the nav bar is a defect.
- One primary CTA per view. Secondary actions are outlined or text-only.

## Elevation & Depth

No shadows anywhere. Depth comes from the three surface steps
(`background` → `surface` → `surface-high`) plus 1px borders. Modal scrims
use `overlay`.

## Shapes

Radius scale: `xs 2 · sm 3 · md 5 · lg 8` — cards `md`/`lg`, chips `sm`,
sheets `lg` (top corners only). Avatars are square. Nothing pill-shaped.

## Components

Canonical implementations live in `artifacts/mobile/components/` — **reuse
these; never hand-roll a second version:**

- **`ScreenHeader`** (`components/ScreenHeader.tsx`) — every tab screen's
  header: LOCALCHECK eyebrow + Oswald title on a `surface` band with bottom
  hairline; `right` slot for the screen action. `SectionHeader` (same file)
  is the canonical section label row.
- **`BrutalistButton`** — primary = accent fill/black text/caps; secondary =
  1px border; destructive = `loss`. Full-width in sheets.
- **`Card` pattern** — `surface` fill, 1px `border`, radius `md`, 16–20px
  padding. Court cards lead with name (Oswald caps), meta line (Inter,
  text-secondary), live state on the right in accent.
- **`StatBlock`** — Oswald number over 11px caps label; the "ON COURT /
  LOCALS / VISITS" row is canonical.
- **`PlayerAvatar`** — square, initials, 1px border; live ring = accent-glow
  pulse.
- **Court drawer** (`components/sheet/CourtSheetHost.tsx` +
  `CourtSheetContent.tsx`) — THE app-wide bottom sheet, built on
  `@gorhom/bottom-sheet` (reanimated + gesture-handler; OTA-safe). Open from
  anywhere with `useCourtSheet().openCourtSheet({ courtId, distanceKm? })`.
  Snap points: peek 46% (name, distance, live stats, CHECK IN) and full 92%
  (WHO'S HERE, LOCALS, pulling-up, runs). Draggable both directions,
  interruptible, swipe-down or backdrop-tap dismisses, tap the swipe hint to
  expand (mouse/web affordance). New gesture sheets must reuse this stack —
  the native formSheet-detent route approach shipped broken on both
  platforms (2026-07-17) and was removed.
- **`LogoMark`** (`components/brand/LogoMark.tsx`) — see Brand assets.
- **Modals that are forms** (create run, plan visit, add court): native
  `pageSheet` Modal, court field defaults to local court, symmetric grids.
- **Empty states**: muted-dark caps text + one clear action. Never fake data.

## Do's and Don'ts

- ✅ Reuse tokens and the components above; add a token if one is missing.
- ✅ Design empty, loading (skeleton), error, and live states for every surface.
- ✅ Keep the tab bar visible; sheets stop above it or overlay it
  deliberately (full-screen), never accidentally.
- ❌ No drop shadows, no gradients-as-decoration, no rounded-pill cards.
- ❌ No new fonts, no light backgrounds, no ad-hoc hex values.
- ❌ No fake/placeholder data to make a screen look alive.
- ❌ No non-interruptible or duration-tuned sheet transitions for
  gesture-driven surfaces.

## Brand assets & logo swap

The mark: cream basketball-court frame (key notch top, sideline tabs, check
tail bottom-right) with a live-orange center square, on brand-navy.

| Asset | Path | Changes take effect |
|---|---|---|
| In-app logo | `artifacts/mobile/assets/brand/logo-mark.png` (+ editable `logo-mark.svg` source) | **OTA** — next update |
| App icon | `artifacts/mobile/assets/images/icon.png` (1024², full-bleed navy) | **Full build only** (tag → Release iOS) |
| Native splash | `artifacts/mobile/assets/images/splash-icon.png` (+ `splash.backgroundColor` in `app.json`) | **Full build only** |
| In-app boot screen | `AuthGate` in `app/_layout.tsx` renders `<LogoMark/>` | OTA |

**To swap the logo:** replace `assets/brand/logo-mark.png` (in-app, OTA) and
regenerate `icon.png`/`splash-icon.png` from the new mark (build-gated). All
in-app usages go through `components/brand/LogoMark.tsx` — never `require`
the asset directly, so a swap is a file replacement, not a code hunt.

## Motion & Interaction

- **Springs over duration curves**: damping ~1.0, response 0.3–0.4s for UI
  transitions; damping ~0.8 when momentum should carry (sheet flicks).
- **Interruptible always**: a sheet mid-animation must respond to a new
  gesture from its current position.
- **Velocity handoff**: gesture velocity feeds the spring on release.
- **Haptics on commit**, not on touch-down: check-in success, game logged,
  RSVP — `expo-haptics` notification/impact accordingly.
- **Live presence animation**: when someone checks in while you're viewing a
  court, their avatar animates in (scale+fade spring) and counters tick —
  presence changes are the product; they deserve motion.
- Run animations on the native thread (`react-native-reanimated`); never
  animate layout with JS-driven `setState` loops.

## Iconography

- Feather via `@expo/vector-icons` (Android/web) + SF Symbols (iOS tab bar).
- 1.5–2px stroke feel; icons accompany labels, they don't replace them for
  primary actions.

## Voice & Copy

- ALL CAPS for labels, buttons, section headers ("WHO'S HERE",
  "+ I'LL BE THERE", "BE THE FIRST TO HOST").
- Direct, second-person, zero filler. Court-culture confident, never corporate.
- Positive state naming: courts are **New / Active / Quiet** (never
  "unverified", "inactive", "dead").
- Errors say what happened and what to do next; silence is not a UX.
- The one-liner: **"Know who's running. Show up. Rank up."**

## Accessibility

- Contrast (computed 2026-07-17 against #0D0D10/#151519/dark-v11):
  `text` 15.6–17.4:1 · `text-secondary` 6.3–7.0:1 · `primary` 5.4–6.1:1 ·
  `win` 10.6–11.9:1 · black-on-accent chips 6.55:1 — all WCAG AA ✅.
  **`muted` (#72728A) is 3.7–4.2:1 — large-text-only.** Labels under 14px
  use `text-secondary`, never `muted`; `muted` is for ≥14px or decorative
  text. Matters most on map overlays (small caps, outdoor sunlight).
- Dynamic type: layouts tolerate +2 text sizes without truncating stats.
- Every touchable has an `accessibilityLabel`; live-updating counts use
  `accessibilityLiveRegion`/announcements where they matter.
- Motion respects reduce-motion: presence animations degrade to cross-fades.

## Quality bar references

pbakaus/impeccable · VoltAgent/awesome-design-md · nexu-io/open-design ·
google-labs-code/design.md (format) · emilkowalski/skills (apple-design
motion) · Shubham0812/SwiftUI-Animations + dpearson2699/swift-ios-skills
(iOS reference) — full curated list: github.com/stars/jGPT-Automated/lists/design.
