See @AGENTS.md for project rules, architecture, and the OTA-vs-full-build decision tree — read it in full before making changes. See @dev_agent.md for the working map, skill pathways, and activity log.

## Working style — check in, don't assume

- Before implementing anything beyond a one-line fix, state your plan and the specific root cause you found, then wait for a go-ahead. Don't chain a diagnosis straight into a fix in the same turn.
- If EAS build/workflow logs, Supabase schema, or App Store Connect state are ambiguous, pull the real data via MCP (Expo, GitHub, Supabase) before forming a theory. Never diagnose from commit messages or assumptions alone.
- After two failed attempts at the same fix, stop and report back instead of trying a third variation — figure out what's actually different about the failure first.
- Anything that triggers a real deploy (`git tag` + push, `eas build`, `eas submit`, `eas update --branch production`) needs an explicit go-ahead first. These aren't reversible the way a code edit is.
- Show evidence (log excerpts, command output) rather than asserting something works.

## Keep the docs current — every session

This repo's docs are load-bearing for every future agent (Claude, Codex, Devin) that works here. Stale docs are worse than no docs.

- `README.md` — must reflect what's actually true right now. If a change makes a line in it wrong, fix the line in the same session, don't defer it.
- `docs/SOURCE_OF_TRUTH.md` — the prioritized task list and project status. Update it when you ship something or discover something that changes priority.
- `ACTIVITY_LOG.md` and `dev_agent.md`'s Activity log section — append what you did, in the format already established there, before ending a session. Write it as if you won't be the one reading it next, because you won't be.
- `docs/SECRETS_AND_ENV.md` — update immediately if you add, rotate, or discover a new required env var or credential.
- If you find a doc that's already stale, fix it as part of the work — don't just work around it and leave it wrong for the next agent.

## Use quality reference material, and cite it

- Prefer official docs (Expo, EAS, Supabase, Apple Developer) over blog posts or forum answers; prefer specific, dated forum/blog answers over guessing.
- When a fix or pattern comes from outside the repo, link the source in the commit message or PR description — not just "found via search."
- If official docs don't cover something, say so explicitly rather than presenting a guess as documented behavior.

## Repo-specific reminders

- Monorepo — the Expo app and all `eas`/`expo` commands live in `artifacts/mobile/`, not repo root.
- Never ship from `artifacts/mobile/mockup-sandbox/`.
- Full rules (RLS, RPCs over raw inserts, enum casing, the silent-catch gotcha) are in `AGENTS.md` §4 — this file doesn't repeat them, it adds the working-style layer on top.
