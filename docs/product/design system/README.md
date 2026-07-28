# LocalCheck design-system entry point

This folder is the canonical visual source for the LocalCheck mobile and web
products. Do not recreate the brand from memory or from an archived checkout.

## Read order

1. `LOCALCHECK/README.md` — complete tokens, typography, spacing, court identity,
   iconography, state language, and component rules.
2. `Design.pdf` — approved multi-screen visual direction.
3. `Profile&Compete-Screeen.png`, `CourtDetails-screen-idea2.png`, and
   `Schedule-mock.png` — phone-specific targets.
4. `Court-card.png`, `Color-pallete.png`, `Logo.png`, and
   `Brand Asset Sheet-selection.png` — focused references.
5. `LOCALCHECK/styles.css`, `LOCALCHECK/assets/`, and `LOCALCHECK/preview/` —
   reusable source assets and rendered component examples.

## Production rules

- Product truth remains in the Expo components under `artifacts/mobile`; this
  folder supplies the visual contract and source assets.
- Use Oswald for display/numeral roles and Inter for supporting copy.
- Orange is reserved for live state, the primary action, and ranked emphasis.
- Basketball and pickleball identity comes from the sport icon, restrained
  tint, and court geometry—not from a full saturated card fill.
- Counts begin at zero. Never invent activity to make a screen look populated.
- Preserve Apple Sign-In and real backend behavior while applying visual work.

Current implementation evidence and remaining visual gates are tracked in
`../DESIGN_QA.md`.
