# LocalCheck Branding and Design System

Status: Draft — not locked until the roadmap decision gates are approved
Candidate version: 2.1.0
Last verified: 2026-07-26

## Brand idea

**Find your run. Know before you go.**

LocalCheck makes a local court legible: what this place is, what is happening now, who belongs here, and what is likely to happen next.

## Personality

Premium athletic. Editorial. Local. Direct. The visual system should feel physically grounded and intentionally composed—not glossy SaaS, hacker neon, or a collection of interchangeable cards.

## Shared visual contract

### Identity status

- The current working base is the bracketed-check concept and broader visual language in `references/Brand Asset Sheet.dc.html`.
- The final logo is not approved. Preserve the concept, but do not ship another logo revision without a collaborative review.
- The current mark is directionally right but visually unresolved: the brackets feel awkward, the checkmark feels placed rather than constructed with the frame, and the overall symbol lacks optical balance.
- The next exploration should make the frame and check read as one integrated geometric mark, with deliberate negative space, stroke relationships, centering, and small-size legibility.

### Color

| Token | Value | Meaning |
| --- | --- | --- |
| Night | `#0D0D10` | Primary dark canvas |
| Heather | `#151519` | Product surface |
| Raised | `#1E1E26` | Selected/elevated surface |
| Border | `#28282F` | Dividers and structure |
| Ink | `#F2F2F6` | Primary text on dark |
| Secondary | `#9A9AAA` | Supporting text |
| Muted | `#72728A` | Metadata |
| Paper | `#F0EFEB` | Website editorial field |
| Paper ink | `#151519` | Text on paper |
| LocalCheck orange | `#FF5500` | Brand, live truth, focus, primary action |
| Win | `#00E87A` | Result semantics only |
| Loss | `#FF3B5C` | Result semantics only |

Orange is the single identity accent. Sport is communicated through a text label, icon, court geometry, and imagery. Basketball and pickleball do not retheme the interface. Green is reserved for positive game-result semantics, never pickleball branding.

### Type

- Display and stat type: geometric or technical in character, but lighter, more premium, and less bulky than the current Oswald treatment. Oswald in the working specimen and Kanit in the Expo app are references, not approved final choices.
- Body and utility type: Inter.
- Display headlines are uppercase with tight line-height.
- Metadata is concise, uppercase, and spaced, but never below a readable 10–11px equivalent in production UI.
- Court names stay proper nouns in content and may render uppercase in display treatment.
- Use a named product type ramp across every screen: primary tab title, screen/venue title, section heading, body/action, supporting text, and metadata. A role keeps the same family, size, weight, line-height, and tracking wherever it appears.
- Weight and uppercase do not substitute for hierarchy. Use scale, spacing, contrast, and placement together.
- Define one spacing rhythm and shared horizontal screen gutters; do not choose padding independently for every card, label, or section.

### Primary tab header contract

- Home, Schedule, Compete, Explore, and Profile use one shared header grammar: the LocalCheck mark paired with the current page title as a single visual lockup.
- The page title uses the same approved display family, weight logic, tracking, cap treatment, and optical height as the LocalCheck wordmark. The exact typeface remains open, but the wordmark and tab-title tokens may not drift apart.
- Change the word, not the header identity: `HOME`, `SCHEDULE`, `COMPETE`, `EXPLORE`, `PROFILE`.
- Do not place a profile avatar in the primary tab header. Profile navigation already belongs to the `Me` tab; a second entry point adds clutter and breaks the lockup.
- Header content stays clear of the iOS status area while its screen content scrolls beneath or below it according to the approved navigation pattern.

### Shape and depth

- Structure comes from surface contrast, hairline borders, image crops, and typography.
- No decorative drop shadows on product cards.
- Product radii: 4–10px. Device frames and marketing compositions may use larger physical radii.
- Do not use colored side stripes to classify cards.
- Avoid card-within-card nesting when a divider or spacing change communicates the same hierarchy.

### Color and component governance

- `#FF5500` is the single LocalCheck identity accent. It is the only orange used for brand marks, selected navigation, primary actions, and active brand emphasis.
- Do not introduce separate basketball orange, CTA orange, logo orange, or screen-specific orange values. Sport identity is communicated by its label, icon, and content—not by changing the app theme.
- Green and red are semantic only: live/success/win and destructive/error/loss. They may not substitute for the brand accent, and every state must also have a text or icon cue.
- Product colors, radii, type roles, spacing, buttons, fields, segmented controls, avatar tiles, headers, court cards, sheets, and modal shells come from shared tokens/components. Screens do not fork local versions because they are visually convenient.
- Any new component state must be added to the shared system with its purpose and accessibility behavior before a screen consumes it.

### People-row contract

- A person tile and the terminal `View All` action use the same width, avatar/icon footprint, label baseline, and touch target. `View All` must not look like a larger card appended to a row of people.
- Compact people rows show a single-line display name with intentional tail truncation. The full name remains available to assistive technology and on the destination profile.
- Do not derive a supposedly safe label by splitting on the first space; long one-word handles must still lay out correctly.
- Profile and detail contexts may wrap names to two lines before truncating. No name may clip against its container or disappear beneath another control.

## Court identity model

Every court representation uses the same ordered model at an appropriate density:

1. **Identity:** verified state, sport label, court name, neighborhood/distance.
2. **Live truth:** active count or an honest quiet state, with text as well as color.
3. **People:** friends and locals without exposing private identities.
4. **Next run:** the nearest scheduled window or a useful no-schedule action.
5. **Access:** court count, surface, lighting, cover, and cost when verified.
6. **Actions:** the full card opens the Court page; Check In is the primary explicit action.

## Schedule interaction contract

- The weekly grid is a shared availability heatmap in its default mode.
- `Edit My Times` enters a distinct multi-select editing mode; it does not open a per-cell confirmation flow.
- In edit mode, the player can tap any number of time cells. Tapping a selected cell again removes it from the pending set.
- Personal pending selections remain visually distinct while the underlying group heat remains legible.
- `Done` saves the batch and exits edit mode. Do not require a confirmation card or network round trip after every cell.
- A failed save preserves the pending edits and provides a clear retry path; it must not silently lose selections.
- The shared heatmap updates through the approved Realtime path so other active clients see the changed availability without tab switching.
- Cells and edit controls must remain accessible touch targets and expose day, time, group intensity, and personal selected state to assistive technology.
- Keep the primary Schedule header fixed and safe-area aware. Only the content region should scroll, and only when its content exceeds the available viewport.
- The weekly grid, selection state, Scheduled Runs section, and actions must follow the shared type ramp and spacing rhythm rather than mixing arbitrary sizes, weights, tracking, and padding.

### Run-planning form contract

- `Host a Run` is a focused form task, not another court-preview drawer. Present it with the platform modal/form-sheet pattern and one shared LocalCheck modal shell.
- Use the operating system's date and time controls through Expo's supported DateTimePicker. Do not make players translate a custom day grid and a custom list of time boxes.
- Store date and time as one future instant while displaying the player's locale, 12/24-hour preference, and timezone correctly.
- Court selection, capacity, privacy, and optional notes use established shared field, picker/segmented-control, stepper, and text-area patterns. The primary action remains visible when the keyboard is open.
- Validation is inline and specific. Dismissing a dirty form must protect against accidental loss.

### Sheet and modal presentation contract

- Court preview is a contextual bottom sheet: quick live truth and actions, draggable between a useful content-driven peek and expanded state, dismissible by swipe or backdrop.
- Creation and editing flows such as `Host a Run` are modal/form tasks. They get a stable title bar, explicit close action, keyboard avoidance, safe-area coverage, and predictable dismissal.
- Keep the proven primitives already present in the app: `@gorhom/bottom-sheet` for the interactive court preview and a native/Expo modal presentation for focused forms. Standardize their shared visual shell instead of hand-building gesture or date/time behavior.
- Sheets and modal forms share surface color, hairline, handle treatment when applicable, corner logic, gutters, title role, close target, motion, and scroll behavior. Their content differs; their visual grammar does not.

### State language

- `5 HERE NOW` — live and specific.
- `QUIET NOW` — no public check-ins; avoids the judgmental `EMPTY` label.
- `YOU'RE HERE` — the current user is checked in.
- `NEXT RUN · TODAY 6:30 PM` — schedule first, then attendance.
- `NO RUN SCHEDULED` — paired with a planning action where appropriate.

### Court page contract

The Court page is the shared destination, not a duplicate Home screen or one long undifferentiated scroll.

- Keep court identity, location, live state, and the primary Check In/Checked In action in a stable summary above the content switcher.
- Use three court-local tabs in this order: `Feed`, `Locals`, `Details`.
- `Feed` is the default and carries chronological court activity, current presence, and upcoming runs/scheduled activity.
- `Locals` carries the court community, regulars, friend relationships, and privacy-aware people states.
- `Details` carries address, directions, access, surface, lighting, cover, cost, amenities, and verified venue information.
- Preserve each tab's scroll position when switching. The tab bar remains reachable/sticky after the summary scrolls, and switching tabs must not duplicate the global bottom-tab navigation.
- A fourth Schedule tab is not part of the current contract. Reconsider only if real content volume proves that Feed cannot carry upcoming runs clearly.

## Platform expression

### Website

- Lead with the topographic route hero.
- Use graphite for live/product proof and warm paper for editorial explanation.
- The court section demonstrates the actual court identity, not generic feature cards.
- Scroll choreography may pull the identity into a device frame, accelerate briefly, and settle on the interaction. Reduced motion uses direct crossfades.

### Mobile

- Predominantly graphite for outdoor legibility.
- Compact list items show identity plus live truth first.
- Home gives the user's local court more breathing room, then Check In, people, and the next run.
- Map sheet is an actionable preview; the Court page carries the full schedule/community hierarchy.

## Motion

- Crisp arrival curve: approximately `cubic-bezier(0.16, 1, 0.3, 1)`.
- Product transitions typically 180–320ms; large marketing choreography may extend to 700–900ms.
- Live pulse is reserved for genuinely active states.
- No bounce or elastic decoration.
- Respect `prefers-reduced-motion` and operating-system reduce-motion settings.

## Accessibility

- WCAG AA contrast.
- 44x44 minimum interactive targets.
- Visible focus treatment.
- Accessible names for icons and live controls.
- Color never carries state alone.
- Dynamic live state uses polite announcements where the platform supports them.
- Motion alternatives preserve content and navigation.

## Imagery

- Real venue photography and verified map geometry may identify a listed court.
- Generated imagery is atmospheric marketing media only and must not imply a real venue.
- Avoid tiny decorative screenshots, generic gradients, stock illustrations, or fictitious activity presented as live data.
