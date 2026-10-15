# GitHub: checks and merge policy

## What runs today (checked 2026-10-14)

| Workflow | File | Trigger | Check names it reports |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | every pull request push; push to `main` | `quality` (typecheck, tests, design check, web bundle), `docs updated` (pull requests only, D54) |
| Expo PR preview | `.github/workflows/expo-pr-preview.yml` | pull request to `main` opened / pushed / reopened (not Dependabot) | `Publish preview update` |
| Release iOS to TestFlight | `.github/workflows/release-ios.yml` | manual only, "Run workflow" (D22). Disabled in GitHub on 2026-10-03, enabled again 2026-10-14 (GitHub API `actions/workflows`) | `Build and submit to TestFlight` |
| Dependabot | GitHub-managed | schedule | — |

## Branch protection: not set

`main` has **no branch protection and no ruleset** (GitHub API, 2026-10-14:
`GET /branches/main` → `protected: false`; `GET /rulesets` → `[]`). So **no
check is required to merge**: a red `quality` or `docs updated` check shows on
the pull request but does not block the merge button. Today the only gate is
Jesse looking at the checks before he merges.

To make the checks binding (Jesse, GitHub → Settings → Rules → Rulesets → New
branch ruleset, target `main`):

- require a pull request before merging (0 approvals is fine while Jesse is the
  only reviewer);
- require status checks `quality` and `docs updated` (each must have run once
  on a pull request before GitHub offers it in the list);
- block force pushes and deletion.

`docs updated` runs only on pull requests; on a push to `main` it is skipped,
which GitHub treats as passing.

## What the checks can and can't prove

- `quality` proves the code typechecks, the unit tests pass, the design rules
  in `scripts/check-design-consistency.mjs` hold, the docs consistency rules in
  `scripts/check-docs-consistency.mjs` hold, and the web bundle compiles.
- `docs updated` proves only that a push which changed the product also added
  lines to the docs that describe that area (`scripts/docsCheckModel.mjs`).
  It cannot tell whether those lines are true.
- Neither proves anything about production: the live database, deployed Edge
  Functions, or behavior on an iPhone. Those are checked by hand and recorded
  in `docs/CURRENT_STATE.md` with how they were checked.

## Merge practice

- Only Jesse merges to `main`. Agents open pull requests from `codex/<task>`
  branches.
- Squash merge, so each pull request is one traceable commit on `main`.
- Large stale pull requests are not rebased and merged wholesale; extract one
  reviewed change onto current `main` instead.

History: an August note in this file described PR #28 as the only merge
candidate and asked for `quality` to be made required after it merged. #28
merged; the ruleset was never created.
