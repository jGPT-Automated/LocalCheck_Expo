# LocalCheck Cross-Platform Brand Roadmap

Status: Active planning
Last updated: 2026-07-26

This document governs the brand/design approval sequence. Product, backend, pilot, TestFlight, website, and App Store release work is governed by `LAUNCH_CONTROL.md`.

## Operating rule

Each phase ends at a visible decision gate. No later phase begins until uncertainty that could materially change the work is resolved with the user. Production deployment, new dependencies, data-model changes, and broad screen expansion always require an explicit check-in.

## Phase 0 — Authority and scope

**Goal:** Resolve which folder owns which truth and exactly which production surfaces are in the first implementation pass.

**In scope**

- Confirm the canonical governance folder.
- Confirm the canonical visual-specimen folder.
- Confirm the first mobile screen set.
- Confirm whether this task includes live deployment or only verified preview.
- Preserve existing uncommitted user work in both production repositories.

**Evidence required**

- User answers the Phase 0 decision questions.
- Paths and scope are recorded in `README.md` and `DECISIONS.md`.

**Gate 0:** User confirms authority, mobile scope, and deployment boundary.

## Phase 1 — Brand foundation

**Goal:** Lock the shared cross-platform design contract before changing production UI.

**In scope**

- Product and audience context.
- Color roles and semantic meanings.
- Typeface decision and migration impact.
- Court identity information model.
- Voice/state language.
- Accessibility, outdoor-legibility, reduced-motion, and privacy rules.
- Web/mobile platform-expression differences.

**Deliverables**

- Approved `PRODUCT.md`.
- Approved `DESIGN.md`.
- Confirmed entries in `DECISIONS.md`.
- Version entry in `CHANGELOG.md`.

**Gate 1:** User approves the system-level visual and content decisions.

## Phase 2 — Canonical design-system specimen

**Goal:** Prove the court identity visually in the design system before production implementation.

**In scope**

- Correct stale sport-color and side-stripe guidance.
- Update shared tokens.
- Redesign the full and compact `LCCourtCard` specimens.
- Show active, quiet, checked-in, and next-run states.
- Produce desktop and iPhone-width browser captures.

**Out of scope**

- Production repository changes.
- New backend fields.

**Gate 2:** User reviews the rendered specimen and approves or redirects it.

## Phase 3 — Website implementation

**Goal:** Improve the actual website using the approved specimen.

**Proposed scope**

- Replace the current court preview cards with the approved identity model.
- Improve responsive hierarchy and honest quiet states.
- Add the approved card-to-device scroll story with reduced-motion behavior.
- Preserve the existing map hero and editorial light section unless redirected.
- Fix the favicon 404.
- Update repository documentation to reference the source of truth.

**Verification**

- Lint, build, and rendered-HTML tests.
- Browser review at desktop and iPhone widths.
- Keyboard/focus and reduced-motion review.
- Console and network-error review.

**Gate 3:** User approves the verified preview before any deployment.

## Phase 4 — Mobile implementation

**Goal:** Apply the same court identity and brand grammar to the agreed Expo screens.

**Proposed first-pass surfaces**

- Home local-court hero.
- Explore court list item.
- Map court sheet.
- Court detail header and first content hierarchy.

**Constraints**

- No backend schema assumptions.
- Render only fields actually available on `Court`, presence, runs, and planned visits.
- Preserve realtime and check-in behavior.
- Use native safe areas, accessibility labels, reduced motion, and 44dp targets.

**Verification**

- Typecheck/lint/tests available in the Expo project.
- Simulator build and runtime screenshots when the configured build environment permits it.
- Compare identical court states across Home, Explore, sheet, and Court detail.

**Gate 4:** User approves mobile captures and interaction hierarchy.

## Phase 5 — Cross-platform lock and release

**Goal:** Prove that documentation, specimens, web, and mobile all express the same approved system.

**In scope**

- Token and copy audit.
- Accessibility and reduced-motion audit.
- Documentation links from both repositories.
- Final design-system and changelog version.
- Version-control checkpoint in the approved canonical location.
- Deployment only after explicit approval.

**Gate 5:** Requirement-by-requirement completion review with evidence.

## Separate optional phase — Launch media

Remotion or Hyperframes video work remains separate from product UI. It begins only after web and mobile screens are approved so the video reflects the product rather than defining it.

Canvas UI is also held outside the core product phases. A single marketing-only effect may be prototyped after Gate 3 if its role is explicitly approved; see `REFERENCES.md`.

## Skill routing by phase

- Planning and quality gates: `/Users/JesseH/.codex/skills/impeccable/SKILL.md`
- Design-domain routing: `/Users/JesseH/Projects/agents/design-principles-research/skills/design-router/SKILL.md`
- Historical LocalCheck-specific rules/specimens: `/Users/JesseH/Projects/archive/LocalCheck_JAWS-reference-2026-07-26/LocalCheck DesignSystem 2.0 2/SKILL.md`; reconcile against current `docs/product/DESIGN.md` before use.
- Web rendered verification: `/Users/JesseH/.codex/skills/playwright/SKILL.md`
- Expo native UI: `/Users/JesseH/.codex/plugins/cache/openai-curated-remote/expo/1.0.2/skills/building-native-ui/SKILL.md`
- React Native architecture: `/Users/JesseH/Projects/LocalCheck_Expo/.agents/skills/react-native-architecture/SKILL.md`
- Local mobile UI conventions: `/Users/JesseH/Projects/LocalCheck_Expo/.agents/skills/building-native-ui/SKILL.md`
- Rendered launch media only: `/Users/JesseH/.agents/skills/remotion/SKILL.md`

Each progress update will list only the skill files actually used during that turn. Planned skills are not evidence that they were used.
