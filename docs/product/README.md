# LocalCheck product, brand, and launch source of truth

This folder governs LocalCheck product identity across web, mobile, launch media, and future surfaces.

## Read order

1. `LAUNCH_CONTROL.md` — current cross-project truth, prioritized burn-down, release gates, and decision queue.
2. `ACTIVITY_LEDGER.md` — append-only chronological actions, issues, resolutions, evidence, and handoffs.
3. `ROADMAP.md` — phased brand/design scope and approval gates.
4. `PRODUCT.md` — purpose, users, jobs, brand register, and non-negotiable product truths.
5. `DESIGN.md` — draft shared visual, component, motion, content, and accessibility contract.
6. `DESIGN_FOUNDATION.md` — current pre-TestFlight shared UI foundation and acceptance gate.
7. `SCREEN_SYSTEM.md` — canonical route-to-shell/component map for every current mobile screen.
8. `DECISIONS.md` — proposed and confirmed decisions with reasoning.
9. `REFERENCES.md` — evaluated external references and pending adoption decisions.
10. `CHANGELOG.md` — versioned record of approved material changes.
11. `assessments/` — dated current-build product/UI assessments and scoped improvement backlogs.
12. `screen-library/` — release-specific screen captures, flow maps, regressions, and marketing-source notes.

## Documentation operating rule

Update `ACTIVITY_LEDGER.md` on nearly every meaningful LocalCheck work turn. Keep `LAUNCH_CONTROL.md` concise and current when release state, priorities, blockers, or evidence change. Add product/design rationale to `DECISIONS.md` and notable visual-system changes to `CHANGELOG.md` rather than relying on chat history.

## Working authority map

- Product, brand, launch governance, the activity ledger, and screen evidence live here: `/Users/JesseH/Projects/LocalCheck_Expo/docs/product`.
- The provisional visual base is preserved at `references/Brand Asset Sheet.dc.html`; final logo construction and typography remain unapproved.
- Current web truth is the clean `jGPT-Automated/LocalCheck_WEB` `main` snapshot at `7a5b74d`, imported at `/Users/JesseH/Projects/LocalCheck_Expo/artifacts/web`. The old PR checkout is archived and cannot silently redefine product truth.
- Mobile consumes the system from `/Users/JesseH/Projects/LocalCheck_Expo/artifacts/mobile`.
- `/Users/JesseH/Projects/agents` supplies reusable verification/design skills; it does not own LocalCheck product truth.

Implementations may express the system differently, but they may not silently redefine it. Website editorial pacing can alternate graphite and warm paper. Mobile remains predominantly graphite for outdoor use. Court identity, typography, color meaning, state language, accessibility, and motion character remain shared.
