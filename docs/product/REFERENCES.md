# References

These are inspiration and provider entry points, not approved dependencies or
permission to copy a design.

## Design and mobile UI

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design layout](https://m3.material.io/foundations/layout/layout-overview/overview)
- [App Store design library](https://www.appstoretracker.com/designs)
- [App Store screenshot inspiration](https://www.asoinspo.com/)
- [Logo-system inspiration](https://logosystem.co/)
- [Mobile screen-pattern overview](https://tubikstudio.com/blog/mobile-ui-design-15-basic-types-of-screens/)

Signals worth retaining: decisive hierarchy, real product UI, high contrast,
map-led moments, restrained accents, familiar interaction underneath a distinct
visual layer, and a mark that stays balanced at app-icon size.

## LocalCheck providers

- [Supabase LocalCheckProd](https://supabase.com/dashboard/project/qkrnmyexzvaxiqfxwwfb)
- [Expo LocalCheck](https://expo.dev/accounts/agenticjess-os/projects/localcheck)
- [Mapbox access tokens](https://console.mapbox.com/account/access-tokens)

## Preserved local material

- `references/Brand Asset Sheet.dc.html` — provisional identity/interface base.
- `design system/` — supplied design images and PDF.
- `design-qa/` — prior review screenshots that may help compare a relevant
  future change.

These files may be consulted for relevant work. Current code and data contracts
remain authoritative over an older visual draft.

## Candidate agent skills — researched 2026-10-22

Requested directory: [AgenticSkills](https://agenticskills.io/skills/).
This is a shortlist for task-specific context, not installed dependencies or
an approved implementation plan. Read the upstream skill before use; the
current SDK 54/Expo Go, shared-component and sign-off rules still apply.

| Candidate | Source | Use / limit |
| --- | --- | --- |
| [React Native Skills](https://agenticskills.io/skills/react-native-skills) | [Vercel Labs](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-native-skills) | React Native/Expo component and performance review; select only rules relevant to the touched UI. |
| [React Native Best Practices](https://agenticskills.io/skills/react-native-best-practices) | Callstack, directory listing reviewed | Investigate measured rendering/jank issues when a UI task exposes them; no speculative optimization. |
| [Supabase Postgres Best Practices](https://agenticskills.io/skills/supabase-postgres) | [Supabase](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices) | Only if an agreed task reaches query/RLS behavior; backend changes are outside the present UI-only scope. Already available through the Supabase plugin. |
| [Web App Testing](https://agenticskills.io/skills/webapp-testing) | Anthropic, directory listing reviewed | Browser interaction and screenshot verification; complements the existing visual QA, not native-device proof. |
| [Expo Deployment](https://agenticskills.io/skills/expo-deployment) | [Expo](https://github.com/expo/skills/tree/main/plugins/expo/skills/eas-app-stores) | Release-readiness reference only; Jesse starts builds, OTAs and submission under the existing release contract. |
| [Expo App Design](https://agenticskills.io/skills/expo-app-design) | [Expo](https://github.com/expo/skills/tree/main/plugins/expo/skills/expo-native-ui) | Hold: the listing's native-UI implementation assumes SDK 56+; do not apply it to this SDK 54 app. |

The repository's `.claude/skills/ui-done/SKILL.md`, approved design rules and
existing tests are the primary UI quality gate. Existing Superpowers review,
worktree and verification skills are already available; avoid installing
duplicates or loading every candidate into every agent.
