# Visual reference material

This folder preserves supplied LocalCheck screen concepts, logo/color material,
and the design PDF so relevant future UI work has a strong starting point.

Useful references include `Design.pdf`, `Profile&Compete-Screeen.png`,
`CourtDetails-screen-idea2.png`, `Schedule-mock.png`, `Court-card.png`,
`Color-pallete.png`, `Logo.png`, and `Brand Asset Sheet-selection.png`.

## Use

- Read `../DESIGN.md`, `../DECISIONS.md`, and `../DESIGN_QA.md` first.
- Compare a supplied state with the real browser and iPhone state at the same
  approximate viewport.
- Preserve real Supabase behavior, native interaction, accessibility, safe
  areas, and long/empty/error states while translating the visual intent.
- Counts and venue attributes begin with confirmed server truth; never populate
  a screen with invented activity to match a reference.
- Treat these images as material for collaboration, not executable code or an
  exact backend contract.

Production UI lives in `app/` and `components/` at repository root.
