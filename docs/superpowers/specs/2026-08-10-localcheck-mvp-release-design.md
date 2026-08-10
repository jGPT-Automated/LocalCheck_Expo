# LocalCheck MVP Release Design

## Goal

Ship a verified root-level LocalCheck snapshot through PR #28 before expanding scheduled runs into ranked team results. Preserve the working realtime and database behavior, and keep scheduled runs and spontaneous 1v1 games as distinct workflows.

## Release 1: PR #28 stabilization

PR #28 remains the consolidation release. It recovers the verified PR #25/#26 Add Court, safety, sport-rating, and notification work; fixes the shared back-logo web overflow; restores the Me-page notification affordance; hardens player-profile Log Game deep links; and installs the approved two-cadence splash experience.

The existing Compete Log Game FAB and post-run Log Game handoff remain available in this release. They are transitional behavior, not the final scheduled-result model.

Backend changes are backward-compatible and deploy only after the reviewed PR is approved. The Expo GitHub base directory was changed from `/artifacts/mobile` to the repository root (`/`) and visibly confirmed saved on 2026-08-10, before the merge-triggered TestFlight workflow runs.

## Release 2: scheduled run results

A run remains one event through `OPEN`, `LOCKED`, `NEEDS_TEAMS_OR_SCORE`, `PENDING_REVIEW`, and `CONFIRMED` or `DISPUTED`. The system never creates a second match for a scheduled run.

- A full roster locks automatically; the creator may lock early.
- A participant may drop before start. The run stays locked and the creator receives a notification that opens replacement/open-roster actions.
- The creator may assign teams by tap or deterministic sport-ELO auto-balance. Team setup remains optional before the run.
- At start time plus 30 minutes, every participant receives one deduplicated score-action notification.
- Unassigned participants may claim a side. Score entry auto-balances any remaining players and freezes the submitted teams.
- One player from the opposite side confirms. Any participant may object while pending. Silence confirms after three days.
- A disputed result changes no records or ratings. The creator or original scorer may revise and resubmit it.
- Confirmed results create one run-result activity event.

The expected outcome uses the average sport ELO of each team. Rating transfer is bounded and zero-sum, with deterministic distribution when team sizes differ. Every player change is stored for audit.

## Spontaneous games

Spontaneous games stay 1v1. The system Camera QR flow opens a player profile, and that profile's Log Game action opens a prefilled spontaneous-game form. No in-app camera dependency is added for MVP. The follow-up release replaces the Compete FAB with a compact `LOG PICKUP` header action and adds an optional played-at value defaulting to now.

## Release gates

Release 1 requires local source checks, read-only live-contract reconciliation, connected web QA, two-account physical-device QA, PR review resolution, and explicit production approval. Only then are backend changes deployed, PR #28 merged, and the resulting TestFlight build monitored. PRs #25-#27 remain open until that exact build is accepted.
