# MVP product roadmap

This is a product sequence, not a release tracker. Current engineering truth
and blockers live in `docs/CURRENT_STATE.md`.

## 1. Reliable core loop

- Authentication and session restore.
- Court discovery and native map quality.
- Durable check-in/switch/checkout with multi-user convergence.
- Planned visits and hosted runs with correct capacity and lifecycle.
- Honest feed, friendship, and court data.

Gate: two to four simultaneous signed-in users complete the matrix in
`docs/TESTING.md` without stale or fabricated state.

## 2. Trusted competition and notifications

- Pending score review before ELO changes.
- Sport-specific standings and history.
- Durable notification inbox.
- Verified physical-device push registration and delivery.

Gate: two accounts complete submit/confirm/reject and notification flows; a
fresh iOS build proves push delivery.

## 3. Product polish

- Apply the shared court identity consistently.
- Finish empty, loading, failure, long-content, privacy, and accessibility
  states.
- Resolve Mapbox camera/marker and bottom-sheet behavior on physical iPhone.
- Complete account deletion and Apple token revocation verification.

Gate: browser and iPhone captures pass `DESIGN_QA.md` and native acceptance.

## 4. App Store readiness

- Privacy and account-deletion review.
- Support/metadata/screenshots.
- Production monitoring and rollback drill.
- Final TestFlight regression across the high-risk matrix.

New features remain behind these correctness gates unless they directly remove
an MVP blocker.
