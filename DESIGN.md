# DESIGN.md — LocalCheck design system snapshot

> Machine-and-human-readable design reference for anyone (agent or person)
> touching LocalCheck UI. Snapshot of what's true in code today plus the
> standards new UI must meet. Tokens are sourced from
> `artifacts/mobile/constants/colors.ts` and `constants/typography.ts` — if
> code and this file disagree, fix whichever is wrong in the same session.
> Quality bar references: pbakaus/impeccable, VoltAgent/awesome-design-md,
> nexu-io/open-design.

## 1. Brand & art direction

**Dark editorial brutalism.** Nike SNKRS × Victory Journal: confident,
information-dense, zero decorative fluff. The app should feel like a court
scoreboard crossed with a magazine spread — big type, hard edges, live data.

- Dark always. There is no light mode.
- Orange `#FF5500` is *live energy* — reserved for live states, primary
  actions, and selection. If everything is orange, nothing is live.
- All-caps Oswald for headings/stats/labels; Inter for reading.
- 1px borders define structure — never drop shadows.
- Sharp corners (2–8px max radius). Nothing pill-shaped except where iOS
  demands it.

## 2. Color

| Token | Value | Use |
|---|---|---|
| `background` | `#0D0D10` | App background |
| `surface` / `card` | `#151519` | Cards, sheets |
| `surfaceHigh` | `#1E1E26` | Elevated surfaces, pressed states |
| `border` | `#28282F` | Standard 1px structural borders |
| `borderSubtle` | `#1E1E24` | Hairlines inside cards |
| `text` | `#F2F2F6` | Primary text |
| `textSecondary` | `#9A9AAA` | Secondary text |
| `muted` | `#72728A` | Tertiary/disabled text |
| `mutedDark` | `#3A3A50` | Ghost text, empty states |
| `accent` | `#FF5500` | Live, active, selected, primary CTA |
| `accentDim` | `rgba(255,85,0,0.12)` | Accent fills/backgrounds |
| `accentGlow` | `rgba(255,85,0,0.35)` | Live pulses, glows |
| `win` / `winDim` | `#00E87A` / 12% | Wins, friend badges, success |
| `loss` / `lossDim` | `#FF3B5C` / 12% | Losses, destructive, errors |
| `overlay` | `rgba(0,0,0,0.75)` | Modal scrims |
| `tier.platinum/gold/silver/bronze` | `#E8E8FF` `#FFD53D` `#9A9AAA` `#CF8558` | Rank tiers |

**Rules:** never introduce new hex values inline — add a token or use an
existing one. Red/yellow are outcome/status colors, not decoration; court
map states must not use danger colors (Quiet ≠ warning).

## 3. Typography

| Token | Font | Use |
|---|---|---|
| `heading` | Oswald 700 | Headings, stats, screen titles — ALL CAPS, tight tracking |
| `headingRegular` | Oswald 400 | Sub-stats, big numbers with less weight |
| `body` → `bodyBold` | Inter 400/500/600/700 | Everything readable |

Sizes (`FontSizes`): `xs 11 · sm 12 · md 14 · base 16 · lg 18 · xl 22 ·
2xl 28 · 3xl 36 · 4xl 48 · stat 64`. Letter-spacing for caps labels: `caps 2`
(use `wider 1.5`/`widest 2.5` deliberately). Line heights: headings 1.1,
body 22px.

**Rules:** stats get Oswald at `3xl`+; labels are 11–12px caps Inter
SemiBold with `caps` tracking; never use Oswald for body copy.

## 4. Spacing, layout & sizing

- Base grid: **4px**. Spacing steps: 4 · 8 · 12 · 16 · 20 · 24 · 32.
- Screen gutter: **20px** horizontal (`paddingHorizontal: 20`).
- Radius: `xs 2 · sm 3 · md 5 · lg 8` — cards `md`/`lg`, chips `sm`.
- **Touch targets ≥ 44×44pt** (Apple HIG). No exceptions, including chips
  and list rows.
- Safe areas: respect insets everywhere; content must never sit under the
  tab bar or notch. Use `contentInsetAdjustmentBehavior` / safe-area hooks —
  a button hidden behind the nav bar is a defect, not a style.
- One primary CTA per view. Secondary actions are outlined or text-only.

## 5. Components (canonical patterns)

- **Card**: `surface` fill, 1px `border`, radius `md`, 16–20px padding.
  Court cards lead with name (Oswald caps), meta line (Inter, textSecondary),
  live/active state on the right in accent.
- **BrutalistButton**: primary = accent fill, black text, caps; secondary =
  1px border, text color; destructive = `loss`. Full-width in sheets.
- **Chips/pills**: caps 11px labels, `sm` radius, selected = accentDim fill +
  accent border + accent text.
- **Stat block**: Oswald number (`2xl`–`stat`) over 11px caps label
  (textSecondary) — the 0/25/9 "ON COURT / VISITS / LOCALS" row is canonical.
- **Avatar**: square, initials, 1px border; live ring = accentGlow pulse.
- **Bottom sheet / drawer** (court sheet spec):
  - *Peek* (~1/3 screen): court name, distance, active count, total locals,
    CHECK IN button, drag handle + swipe-up affordance.
  - *Full* (swipe up or after check-in): who's-here roster, pulling-up-today,
    feed, schedule/runs, court details.
  - Must be a real gesture-driven sheet: draggable both directions,
    interruptible mid-gesture, snap points at peek/full/dismissed, and it
    must never trap the tab bar or hide its own actions behind the nav.
- **Empty states**: mutedDark caps text + one clear action. Never fake data.

## 6. Motion & interaction

(From the apple-design/animations skill guidance — springs, not durations.)

- **Springs over duration curves**: damping ~1.0, response 0.3–0.4s for UI
  transitions; damping ~0.8 when momentum should carry (sheet flicks).
- **Interruptible always**: a sheet mid-animation must respond to a new
  gesture from its current position — no waiting for animations to finish.
- **Velocity handoff**: gesture velocity feeds the spring on release
  (drawer flicks feel thrown, not restarted).
- **Haptics on commit**, not on touch-down: check-in success, game logged,
  RSVP — `expo-haptics` notification/impact accordingly.
- **Live presence animation**: when someone checks in while you're viewing a
  court, their avatar animates in (scale+fade spring) and counters tick to
  the new value — presence changes are the product; they deserve motion.
- Run animations on the native thread (`react-native-reanimated`); never
  animate layout with JS-driven `setState` loops.

## 7. Iconography

- Feather via `@expo/vector-icons` (Android/web) + SF Symbols (iOS tab bar).
- 1.5–2px stroke feel; icons accompany labels, they don't replace them for
  primary actions.

## 8. Voice & copy

- ALL CAPS for labels, buttons, section headers ("WHO'S HERE",
  "+ I'LL BE THERE", "BE THE FIRST TO HOST").
- Direct, second-person, zero filler. Court-culture confident, never corporate.
- Positive state naming: courts are **New / Active / Quiet** (never
  "unverified", "inactive", "dead").
- Errors say what happened and what to do next; silence is not a UX.

## 9. Accessibility

- Contrast: text on `background`/`surface` must hit WCAG AA (textSecondary on
  surface is the floor — don't go dimmer for body text).
- Dynamic type: layouts tolerate +2 text sizes without truncating stats.
- Every touchable has an `accessibilityLabel`; live-updating counts use
  `accessibilityLiveRegion`/announcements where they matter.
- Motion respects reduce-motion: presence animations degrade to cross-fades.

## 10. Do / Don't

- ✅ Reuse tokens; add a token if one is missing.
- ✅ Design empty, loading (skeleton), error, and live states for every surface.
- ✅ Keep the tab bar visible and unobstructed; sheets stop above it or
  overlay it deliberately (full-screen), never accidentally.
- ❌ No drop shadows, no gradients-as-decoration, no rounded-pill cards.
- ❌ No new fonts, no light backgrounds, no ad-hoc hex values.
- ❌ No fake/placeholder data to make a screen look alive.
- ❌ No non-interruptible or duration-tuned (`Animated.timing(300ms)`) sheet
  transitions for gesture-driven surfaces.
