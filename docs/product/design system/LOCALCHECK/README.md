# LocalCheck Design System

> Live courts. Real competition. A dark, map-first court explorer where orange always means live.

## Company Overview

**LocalCheck** is a map-first discovery product for pickup sports. It answers one question — *is the run happening right now?* — for public basketball and pickleball courts, then turns the answer into a habit: one-tap check-in, local-court identity, weekly planning, and local ranking.

The MVP ships a **source-backed launch catalog of 56 courts** (28 basketball, 28 pickleball) across **New York City, Washington DC, Miami, Los Angeles, Houston, Austin, and Denver**.

The product's defining editorial rule: **counters start at zero and stay honest.** Surfaces never fabricate players, planned visits, or traffic curves. Empty is a legitimate, designed state — not something to fill with fake data.

**Core loops:**

| Loop | Surface | Payoff |
|---|---|---|
| Find the run | Explorer map + court list | See real activity, not stale reviews |
| Check in | Court card / court page | One tap keeps the live picture honest |
| Plan the week | Weekly going heatmap | See who else is in before you go |
| Play for something | Local ranking | Home-court identity and standing |

---

## Products / Surfaces

| Surface | Route | Stack | Purpose |
|---|---|---|---|
| **Landing** | `/` | Next.js App Router (client) | Hero over map art, launch-court preview cards, how-it-works, ranking teaser, CTA |
| **Court Explorer** | `/courts` | Next.js + Mapbox GL | Split shell: 410px filter/list sidebar + full-bleed dark map |
| **Court Detail** | `/courts/[id]` | Next.js + Mapbox GL + Supabase | Hero signals bar, court map, players, schedule, weekly heatmap, details |
| **Planner Auth** | modal | Supabase auth | Email sign-in/up gate for weekly planning |
| **Mobile App** | `LocalCheck_Expo` | Expo | Companion app (QR-linked from landing) |

**Data / infrastructure:** `data/launch-courts.json` (canonical seed + web fallback), `supabase/migrations` (catalog schema, RLS, public stats view), `docs/COURT_DATA_STANDARD.md` (naming + provenance rules). Court identity is three-part: `name` (canonical venue), `short_name` (compact or culturally recognized label), `raw_source_name` (audit only). **The public label is never a detector number.**

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Blunt, local, athletic.** Street-level confidence, zero marketing gloss.
- **Short declaratives, often with a hard period.** The period is a design element — `Find your run.` renders the final `.` in orange.
- **Two- and three-word imperatives.** `Check in` · `Find the run` · `Plan the week` · `Show up.`
- **Contrast pairs as headlines:** `Know before / you go.` · `From couch / to court.` · `Show up. / Play for something.`
- **Honest about emptiness.** `No public check-ins yet` · `Counts start at zero—not fabricated` · `Nobody yet`. Never invent activity.
- **Second person, present tense.** "Your local court." "You are checked in."
- **No emoji. No exclamation marks.** Ever.
- **Casing:** display headlines are **UPPERCASE** (set by CSS `text-transform`, authored in sentence case). Labels, eyebrows, nav, and buttons are uppercase with wide tracking. Body copy is sentence case.
- **Numbers are load-bearing and specific:** `56 launch courts`, `28 basketball`, `28 pickleball`, `2 courts`, `1284`.
- **Sport names are always capitalized nouns:** Basketball, Pickleball.
- **"Local" is the identity word** — *your local court*, *locals*, *local ranking*, *call this home*.

### Copy Examples
- Hero eyebrow: `Seven cities now mapped` (with live dot)
- Hero H1: `Find / your / run.`
- Hero sub: `Live courts. Real competition.`
- Primary CTA: `Explore 56 courts` · `Explore courts` · `Check in`
- Secondary CTA: `See how it works` · `View court`
- Hero signal row: `56 launch courts · 28 basketball · 28 pickleball`
- Section eyebrow: `Launch court preview` · `No empty-court gamble` · `Built for local competition` · `The launch map is ready`
- Card metrics: `Live now` / `Locals` — sub-labels `No public check-ins yet`, `Call this home`, `You are checked in`
- Legend: `Orange always means live` · `Counts start at zero—not fabricated` · `Court geometry distinguishes each sport`
- Steps: `01 Find the run` · `02 Check in` · `03 Plan the week`
- Ranking card: `East Austin · Basketball` / `Local ranking` / `Updated after every ranked game`
- Empty states: `No courts match` · `Nobody yet` · `Pick a slot`
- Footer: `Live courts. Real competition.` · `© 2026 LocalCheck`
- Toast: `Login opens in the LocalCheck app.`

---

## VISUAL FOUNDATIONS

### Colors

**Core tokens** (verbatim from `app/globals.css`):

| Token | Value | Use |
|---|---|---|
| `--night` | `#0d0d10` | Page background, default surface |
| `--heather` | `#151519` | Alternating dark band (live courts, final CTA) |
| `--raised` | `#1e1e26` | Raised fill |
| `--card` | `#24242c` | Card / avatar fill |
| `--ink` | `#f2f2f6` | Primary text |
| `--muted` | `#9a9aaa` | Body / paragraph |
| `--subtle` | `#72728a` | Tertiary |
| `--line` | `rgba(242,242,246,0.12)` | Default hairline |
| `--orange` | `#fc4c02` | **LIVE.** The single brand accent |
| `--orange-bright` | `#ff641e` | Hover, orange text on dark |
| `--paper` | `#f0efeb` | The one light band ("How it works") |
| `--paper-ink` | `#151519` | Text on paper |

**Extended surface ramp** (observed across components): `#09090b` hero backdrop · `#0a0a0c` footer · `#111115` input · `#121216` explorer sidebar · `#17171c` map canvas · `#18181d` panel · `#19191f` auth panel · `#1b1b21` modal · `#212128` heatmap level-0 · `#25252c` toast.

**Foreground ramp:** `#f2f2f6` → `#e5e5ea` → `#d1d1d9` → `#b8b8c2` → `#9a9aa7` → `#777783` → `#686873` → `#62626e`. Small text steps down the ramp as it shrinks; 7–9px text sits at `#62626e`–`#777783`.

**Orange discipline — the system's one hard rule:** orange is reserved for **live state, check-in actions, and the final period of a headline.** It is never used for decoration, never for hover-only color, and never for two things in the same component. Orange text on dark small copy uses `#ff7b4b` / `#fc6630` for legibility; the pure `#fc4c02` is for fills, dots, and rails.

**Sport accents** — courts are tinted by sport, never by status:

| Sport | Accent | Line | Line strong | Soft glow | Label |
|---|---|---|---|---|---|
| Basketball | `#d8b58d` (leather/tan) | `rgba(211,181,147,0.38)` | `rgba(225,195,158,0.58)` | `rgba(172,122,83,0.16)` | `#d8c8b6` |
| Pickleball | `#9ccfbe` (sea green) | `rgba(141,199,183,0.34)` | `rgba(162,218,201,0.56)` | `rgba(67,137,120,0.17)` | `#bdd7cf` |

Sport tint is applied via a local `--sport` custom property and `color-mix(in srgb, var(--sport) N%, transparent)` — 6% fill, 24–30% border, 11% radial glow, 42% hover border.

**Rank rings:** gold `#ba8653`, silver `#8490a4`, slate `#657067`, neutral `#555560`. Avatars are ring-coded; the ring — not a badge — carries standing.

**Heatmap ramp:** level-0 `#212128`, then orange at `0.2` → `0.38` → `0.62` → solid `#fc4c02`.

### Typography

| Role | Family | Weight | Size | Tracking | Leading |
|---|---|---|---|---|---|
| Hero H1 | **Inter** | 820 | `clamp(88px, 9.2vw, 164px)` | `-0.07em` | `0.73` |
| Section H2 | **Oswald** | 700 | `clamp(54px, 6vw, 100px)` | `-0.045em` | `0.88` |
| Court H1 | Oswald | 650 | `clamp(66px, 6.8vw, 116px)` | `-0.055em` | `0.87` |
| Panel H2 | Oswald | 600 | 30px | `-0.025em` | `1` |
| Modal H2 | Oswald | 600 | 34px | `0` | `1` |
| Card H3 | Oswald | 600 | `clamp(29px, 2.3vw, 38px)` | `-0.015em` | `1.03` |
| Wordmark | Oswald | 600 | 25px (21px compact) | `0.055em` | — |
| Metric numeral | Oswald | 630–650 | 17 / 27 / 29px | `-0.03em` | `1` |
| Eyebrow | Inter | 700 | 11px | `0.18em` | — |
| Nav / button | Inter | 650–780 | 12px | `0.10–0.15em` | — |
| Label | Inter | 750–780 | 8–10px | `0.12–0.14em` | — |
| Body | Inter | 400–500 | 12–16px | `0` | `1.5–1.75` |

- **Two families only.** `Oswald` (condensed, 500/600/700) is the display and numeral voice. `Inter Variable` is everything else — *including* the hero H1, the one place Inter is set at display size at weight **820**.
- **Weights are non-standard on purpose.** The app uses variable-font values `550, 630, 650, 680, 720, 730, 740, 750, 760, 770, 780, 820`. Reproduce them literally; rounding to 600/700 flattens the brand.
- **Negative tracking scales with size.** `-0.07em` at hero, `-0.045em` at section, `-0.025em` at card, `0` at body. Positive tracking is for uppercase micro-copy only.
- **All display type is UPPERCASE** via `text-transform`.
- **Numerals are always Oswald**, always tight, always paired with a 8–9px uppercase label beneath or beside.
- Type gets *smaller* than most systems allow: 7px and 8px labels are legitimate at 780 weight with `0.08–0.12em` tracking on dark.

### Backgrounds & Imagery
- **Dark by default**, with exactly **one light band** per page at most: the `--paper` `#f0efeb` "How it works" section. That inversion is the system's only tonal surprise — don't add more.
- **Hero art:** a dark topographic city map (`assets/hero-map.png`) — routes converging on a court. Object-fit cover, `transform-origin: 63% 58%`.
- **Hero veil:** always two stacked gradients — one horizontal (44% → 2% opacity left-to-right, protecting the copy), one vertical (26% top, 62% bottom).
- **Court focus bloom:** a radial orange lens over the hero map at the court location, with three concentric pulse rings (`court-focus-pulse`, 4.8s, staggered 1.6s / 3.2s).
- **Section glows:** radial orange at very low alpha — `0.045` at `84% 14%` for the live-courts band, `0.085` centered for the final CTA. Never above `0.1`.
- **Map fallback texture:** two diagonal line gradients (32° and 147°, `160px`/`210px` tiles) plus a sport-accent radial. This is how a map renders without a token — designed, not broken.
- **No photography of people. No illustration. No gradient meshes.** The imagery vocabulary is maps, court geometry, and light.

### Court Geometry (signature device)
Instead of photos, cards draw the **court itself** in hairlines, masked into the right side of the card:

- **Basketball:** boundary rect, 999px arc (three-point), key rectangle, center circle, rim circle with a `box-shadow`-drawn backboard.
- **Pickleball:** dashed center net, two kitchen lines (35% / 69%), split center lines, plus a 15px dotted screen tint at `0.22` opacity.
- Geometry is drawn in `--sport-line` (weak) and `--sport-line-strong` (structural), masked with `linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.45) 20%, #000 48%)` and shaded by a `.court-card__shade` overlay.
- **Sport is legible from geometry alone** — this is stated as a design principle in the card legend.

### Glass & Blur
Used for floating chrome only, never for the primary card body:
```css
background: rgba(19, 19, 23, 0.9);
border: 1px solid rgba(242, 242, 246, 0.13);
backdrop-filter: blur(15px);
box-shadow: 0 14px 36px rgba(0, 0, 0, 0.25);
```
Blur values by role: `blur(10px)` metric strips and pills · `blur(14–16px)` map chrome, weather label, mobile menu · `blur(18px)` modal backdrop, signals bar, map caption · `blur(22px)` map selection card.

### Corner Radius
A wide, deliberate ramp — **small for actions, large for surfaces**:

`3px` nav CTA · `4px` button · `6–7px` court-page action, heatmap cell · `8px` input · `9–11px` icon tiles, avatars, chips, map controls · `13px` card metric strip · `16px` explorer list card, signals bar · `18px` mobile menu, map selection · `22px` court panel, auth panel · `23px` home court card · `24px` rank card · `25px` modal · `28px` court map · `999px` status pills, dots, circular buttons.

Rule of thumb: the more content a surface holds, the rounder it is. Buttons stay near-square so they read as mechanical.

### Animations & Motion
- **No animation library.** Pure CSS keyframes plus one `requestAnimationFrame` scroll handler.
- **`live-pulse` — 2.4s ease-in-out infinite** on every live dot (`opacity .75→1`, `scale .88→1.08`). This is the heartbeat of the product; it appears on the hero eyebrow, card metrics, court signals, player rows, and panel eyebrows.
- **`court-focus-pulse` — 4.8s ease-out infinite**, three rings staggered 0 / 1.6s / 3.2s, over the hero map.
- **`map-marker-pulse` — 2.6s ease-out infinite** halo on the active marker; `selected-pulse` 2.2s in the explorer.
- **Hero parallax on scroll:** `--hero-shift` 0 → `-46px`, `--hero-scale` 1 → `1.055`, `--copy-shift` 0 → `22px`, `--hero-opacity` 1 → `0.8`, driven by scroll progress over one viewport, rAF-throttled, disabled under `prefers-reduced-motion`.
- **Hover = lift.** `transform: translateY(-2px)` on buttons and chrome, `translateY(-4px)` on court cards, `translateX(2px)` on the circular card link. Cards also deepen their shadow and brighten their border.
- **Transitions are short and plain:** `150–180ms ease` for state, `200–220ms ease` for cards. No cubic-bezier flourishes, no spring.
- **`modal-in` 160ms opacity** · **`toast-in` 180ms opacity + 10px rise**.
- **`prefers-reduced-motion` is honored globally** — all animation and transition durations collapse to `0.01ms`.

### Borders & Dividers
- Default hairline: `1px solid rgba(242,242,246,0.12)`.
- Structural dividers inside panels: `rgba(242,242,246,0.075)` — nearly invisible, doing all the layout work.
- Card borders: `rgba(242,242,246,0.09–0.10)`, brightening to `0.2` (or 42% sport tint) on hover.
- **Grid-as-divider:** player lists, schedules, and signal bars use `border-right` / `border-left` on cells rather than gaps, so panels read as one machined block.
- Selection is a **rail, not a fill**: 2–3px orange bar on the card edge, or `inset 0 -2px var(--orange)` under a planned schedule cell.
- Paper band rules are solid and visible: `1px solid #c8c7c3`.

### Cards
- **Home court card** (378px min-height): sport gradient + radial glow, 23px radius, masked court geometry, right-edge orange live rail, content column with topline → title block → metric strip → actions pinned to the bottom via `margin-top: auto`.
- **Explorer list card** (190px min-height): 16px radius, `--sport` radial at 11%, full-card invisible button target (`.cardTarget`) with `pointer-events: none` content and one live circular link on top.
- **Metric strip:** two-up grid, glass fill `rgba(12,12,15,0.38)`, divided by a single `border-left`, each cell = signal well / Oswald numeral / label + sub-label.
- **Panels:** `linear-gradient(145deg, rgba(255,255,255,0.025), transparent 45%)` over `#18181d`, 22px radius, header ≥112px with eyebrow + Oswald title.
- Cards never use drop shadows for hierarchy alone — border, inset hairline, and radial tint carry depth.

### Shadows
| Role | Value |
|---|---|
| Court card | `0 24px 64px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)` |
| Court card hover | `0 30px 78px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)` |
| List card | `inset 0 1px rgba(255,255,255,0.025), 0 14px 38px rgba(0,0,0,0.13)` |
| Panel | `inset 0 1px rgba(255,255,255,0.025), 0 22px 64px rgba(0,0,0,0.15)` |
| Rank card | `0 38px 100px rgba(0,0,0,0.34)` |
| Court map | `0 32px 90px rgba(0,0,0,0.42), inset 0 1px rgba(255,255,255,0.04)` |
| Modal | `0 50px 150px rgba(0,0,0,0.7)` |
| Floating chrome | `0 14px 36px rgba(0,0,0,0.25)` |
| Live dot | `0 0 0 5px rgba(252,76,2,0.12), 0 0 16px rgba(252,76,2,0.7)` |
| Map marker | `0 0 0 9px rgba(252,76,2,0.15), 0 10px 35px rgba(0,0,0,0.5)` |

Every inset hairline is `rgba(255,255,255,0.025–0.05)` — a top-edge highlight that makes surfaces read as machined metal.

### Layout & Density
- **Content width:** `min(1440px, …)` on the landing page; `min(1540px, calc(100% - 80px))` on court detail; `410px` max sidebar in the explorer.
- **Section padding:** `clamp(92px, 9vw, 150px)` vertical, `clamp(24px, 5vw, 84px)` horizontal.
- **Asymmetric grids everywhere:** `1.1fr / 0.75fr` section headings, `0.8fr / 1.55fr` how-it-works, `1.08fr / 0.92fr` court hero, `1.28fr / 0.72fr` court content. Nothing is a plain 50/50.
- **Fixed min-heights over padding** for rows: 29px chips, 38–48px controls, 52–54px CTAs, 61px detail rows, 66–76px metric cells, 90px player rows, 112–142px panel headers.
- **Breakpoints:** `1180px`, `980px`, `880px`, `780px`, `760px`, `620px`, `480px`, `460px`. Mobile collapses the explorer sidebar with `display: contents` and reorders map/list.
- **Hit targets** never below 44px on interactive text, 38px on compact chips.

---

## ICONOGRAPHY

### Icon Library: Phosphor Icons
All icons come from **`@phosphor-icons/react`**. Weights used: `regular` for chrome and outlines, `fill` for sport/place glyphs, `bold` for checks and arrows. Sizes: `14–19px` inline, `25–27px` in step circles and mobile chrome, `34px` for the brand frame.

**Full icon inventory (from source):**
`CornersOut` (brand frame, geometry legend) · `Check` (brand check, check-in, steps) · `Basketball` · `PingPong` (pickleball) · `MapPin` (location) · `House` (local court) · `UsersThree` (locals, counts) · `Clock` (plan the week) · `CalendarBlank` / `CalendarDots` (schedule, heatmap) · `MagnifyingGlass` (search) · `SlidersHorizontal` (mobile filters) · `Crosshair` (fit map to bounds) · `NavigationArrow` (directions) · `ArrowRight` · `ArrowLeft` · `ArrowUpRight` · `CaretRight` · `CaretLeft` · `List` (menu) · `X` (close).

No custom UI icons. The only bespoke marks are the logo lock-up and the CSS-drawn court geometry.

### Logo Lock-up
The mark is a **composite, not a single glyph**: a Phosphor `CornersOut` frame in `--ink` with a `Check` in `--orange` absolutely centered on top, carrying `filter: drop-shadow(0 0 8px rgba(252,76,2,0.34))`.

- Frame: `34px` icon in a `42px` grid cell (standard), `27px` in `34px` (compact), `37–38px` cell on interior pages.
- Check: `18px` bold (standard), `14px` (compact).
- Wordmark: `LOCALCHECK` — Oswald 600, `25px` / `0.055em`, always uppercase, gap `13px` (standard) or `10px` (compact).
- Static assets: `assets/logo-mark.svg` (ink frame + orange check), `assets/logo-mark-white.svg` (all white, for orange or photographic backgrounds).
- Minimum brand height 48px in headers. Never recolor the check to anything but orange or white.

### Badges & Status
- **Live dot:** 6–7px circle, `--orange`, double box-shadow halo, 2.4s pulse. The only animated element in a resting UI.
- **Off/idle dot:** same geometry, `#4d4d56`, no glow, no animation.
- **Status pill:** 29–35px min-height, `999px`, hairline border, `rgba(12,12,15,0.22)` fill, `blur(10px)`, 9–10px uppercase 750 label.
- **Sport pill:** sport-tinted border (24%) and fill (6%), sport-colored label.
- **Meta dot separator:** 3px `#5d5d68` circle between metadata fragments.
- **"Your local court":** `House` fill icon + pill, distinct from distance/status pills.
- **Verified:** `Check` glyph in `#a7a7b0` with `#858591` label — quiet, never a colored badge.

---

## File Index

```
/
├── README.md                     ← This file
├── styles.css                    ← Tokens: color, type, shape, shadow, motion + .lc-* primitives
├── SKILL.md                      ← Agent skill definition
├── thumbnail.html                ← Design system tile
├── assets/
│   ├── logo-mark.svg             ← CornersOut frame + orange Check
│   ├── logo-mark-white.svg       ← All-white lock-up mark
│   ├── hero-map.png              ← Dark topographic hero art (Austin)
│   └── qr-localcheck.png         ← App QR code
├── preview/                      ← Design System cards
│   ├── colors-core.html
│   ├── colors-sport.html
│   ├── colors-orange.html
│   ├── type-display.html
│   ├── type-body.html
│   ├── type-labels.html
│   ├── spacing-radius.html
│   ├── spacing-shadows.html
│   ├── components-buttons.html
│   ├── components-badges.html
│   ├── components-inputs.html
│   ├── components-court-card.html
│   ├── components-metrics.html
│   ├── components-heatmap.html
│   ├── brand-logo.html
│   └── brand-motion.html
└── ui_kits/
    └── web_app/
        ├── README.md
        └── index.html            ← Static landing-page recreation (hero → footer)
```
