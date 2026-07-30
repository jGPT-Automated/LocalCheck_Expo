# LocalCheck Web UI Kit

`index.html` is a static, dependency-free recreation of the LocalCheck landing page, built entirely from `styles.css` tokens and `.lc-*` primitives. Open it directly in a browser.

## What it demonstrates

| Pattern | Where |
|---|---|
| Hero over dark map art, two-axis veil, court-focus bloom, rAF parallax | `.hero` |
| Brand lock-up (mark + Oswald wordmark), underline-expand nav, orange nav CTA | `.site-header` |
| Inter 820 hero H1 with orange terminal period | `.lc-h1-hero` |
| Hero signal row and QR card | `.hero__signal`, `.qr` |
| Asymmetric section heading (1.1fr / 0.75fr) | `.section-heading` |
| Court card — sport gradient, hairline court geometry, live rail, metric strip, actions | `.lc-court-card` |
| Honest zero-state copy | `Live now 0 / No public check-ins yet` |
| Paper band inversion with numbered steps | `.how.lc-paper` |
| Rank card with orange current-row wash | `.rank` |
| Radial-glow final CTA and footer | `.final-cta`, `.site-footer` |

## Substitutions vs. production

- Icons are stand-in glyphs. Production uses **`@phosphor-icons/react`** — see the icon inventory in the root `README.md`.
- The Mapbox explorer (`/courts`) and court detail (`/courts/[id]`) are not reproduced here; their tokens (map chrome, signals bar, panels, weekly heatmap) live in `styles.css` and are shown as cards in `preview/`.
- Interactivity is limited to hero parallax. Check-in, filtering, and planning are stateful in production.

## Reuse

Copy `styles.css`, the `assets/` you reference, and lift markup blocks directly. Keep the rules from `SKILL.md`: orange means live, two fonts, one paper band, never fabricate activity.
