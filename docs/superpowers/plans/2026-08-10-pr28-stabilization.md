# PR #28 Stabilization Implementation Plan

> **For agentic workers:** Execute in the isolated `codex/mvp-visual-polish` worktree. Use test-first changes for behavior and run the full release check before publishing.

**Goal:** Turn PR #28 into the verified root-level MVP snapshot without deploying or merging before approval.

**Architecture:** Keep PR #28's root application and scoped realtime hub. Port only verified PR #25/#26 behavior, adapt it to existing shared sheets/services, and ship backward-compatible Supabase changes before the client release.

**Tech stack:** Expo SDK 54, Expo Router, React Native, Supabase Postgres/Edge Functions/Realtime, EAS Workflows, GitHub Actions.

## Global constraints

- Preserve the original checkout and its untracked files.
- Do not redesign realtime or replace existing navigation.
- Do not deploy Supabase changes, merge, or close PRs before explicit approval.
- The user explicitly authorized correcting Expo's stale GitHub base directory;
  it is now saved as repository root (`/`).
- Use the in-app browser for visual verification.

## Tasks

### 1. Recover the backend contracts

- Add production-ready migrations for verified-court creation, user block/report controls, sport-specific ELO with a three-day review window, and end-to-end push delivery.
- Keep migrations additive and compatible with installed clients; reconcile them against the read-only live schema and validate source contracts for functions, RLS, grants, idempotency, dedupe, quotas, and automatic jobs.
- Adapt the `verify-court` and push functions to root paths, server-only secrets, one-time notification claiming, Expo ticket/receipt reconciliation, retry handling, and invalid-token cleanup.

### 2. Recover and stabilize the client

- Integrate Add Court into the shared sheet/action patterns and invalidate court discovery narrowly after creation.
- Add block/report actions and filter blocked identities from relevant surfaces.
- Make leaderboard/profile mapping use sport-specific ratings while preserving legacy fallback.
- Restore a compact Me-page notification button without removing Inbox or Settings.
- Resolve profile Log Game opponents by ID instead of leaderboard membership.
- Add cold-start notification routing and preserve foreground/background behavior.

### 3. Finish the approved visual shell

- Constrain the shared back-logo frame to the requested size and cover it with a regression testable presentation helper.
- Port the approved splash artwork and build two timelines: full artwork/auth reveal for signed-out users and a sub-two-second pin-to-W-to-check mark for signed-in users, with reduced-motion/static fallbacks.
- Preserve all unrelated visible controls and document the affordance audit.

### 4. Repair delivery infrastructure

- Replace the CI-only `rg` dependency with a portable Node check.
- Fetch the current EAS workflow schema/docs and validate all workflow files.
- Verify Expo's GitHub base directory is the saved repository root (`/`) before
  applying the PR build label or merging.
- Reply to and resolve the three PR #28 review threads with evidence after the final push.

### 5. Verify and publish the reviewed candidate

- Run `pnpm check`, the focused regression suites, `pnpm check:release`, workflow validation, read-only live-schema/advisor inspection, and `git diff --check`.
- Re-export and inspect the connected preview at compact and desktop widths, including detail headers, Add Court, Me notifications, auth/splash, Compete, and player Log Game.
- Commit in reviewable slices, push `codex/mvp-visual-polish`, and wait for green CI/review.
- Stop at the production approval gate. After approval, deploy backend changes first, verify production, reconfirm Expo's root base directory, merge, and monitor the exact TestFlight build.
