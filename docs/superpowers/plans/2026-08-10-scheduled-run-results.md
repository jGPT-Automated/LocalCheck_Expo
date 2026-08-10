# Scheduled Run Results Implementation Plan

> **For agentic workers:** Start only after PR #28's TestFlight build is accepted. Create a focused follow-up branch from the accepted main commit.

**Goal:** Make a scheduled run carry its roster, teams, reviewed score, activity, and team-average ELO without creating a duplicate match.

**Architecture:** Extend runs with lock metadata and participant team sides; store one result, per-participant reviews, and rating audit rows in dedicated tables. Security-definer RPCs own every mutation, with explicit authentication/participation checks and revoked public execution.

## Tasks

### 1. Define and test the state machine

- Add pure model tests for open/full/manual lock, participant drop, due-action, pending review, confirmation, dispute, and resubmission.
- Add deterministic auto-balance and zero-sum team-rating tests before implementation.

### 2. Add the database model and RPC boundary

- Add roster lock metadata, nullable `team_side`, `run_results`, `run_result_reviews`, and `run_rating_changes` with RLS and explicit grants.
- Add authenticated RPCs for lock/open, creator assignment, self-claim, auto-balance, submit/revise, and confirm/object.
- Update join, leave, and invite behavior atomically. A drop keeps the run locked and creates one creator notification; a direct replacement invite can fill a locked vacancy.

### 3. Add automatic transitions and notifications

- Run a deduplicated cron job that creates score-action notifications at start plus 30 minutes.
- Notify all participants on submission/revision and auto-confirm unopposed results after three days.
- Route roster-change notifications to the creator's `INVITE PLAYER` / `OPEN RUN` recovery state.

### 4. Build the run lifecycle UI

- Render lock/result state on run cards and run detail.
- Let the creator tap-assign or auto-balance teams before start.
- Let unassigned participants claim a side after the run becomes due; auto-balance any remainder before score review.
- Provide submit, opposing-side confirm, participant object, disputed edit, and resubmit states without creating a match.

### 5. Refine spontaneous games

- Replace the Compete FAB with a compact `LOG PICKUP` header action.
- Keep profile deep-link prefill and username search; add optional played-at input defaulting to now.
- Keep the system-camera QR flow and avoid native dependency changes.

### 6. Verify and release

- Exercise concurrency, RLS, idempotency, notification dedupe, team assignment, unequal rosters, rating bounds/zero-sum behavior, dispute/revision, and automatic confirmation.
- Run full client checks and connected/physical multi-account QA.
- Publish in a separate PR and select OTA versus a native TestFlight build from the actual runtime/native diff.
