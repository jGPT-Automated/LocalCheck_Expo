# LocalCheck contributor contract

This repository is the complete LocalCheck product: one Expo application and
its Supabase source of truth. Read this file before changing anything.

Project management (what's next, decisions, log, learnings, Jesse's working
preferences) lives outside the repo, in Jesse's folder
`~/Documents/LocalCheck_Oct2026/` (start at its `AGENTS.md`) and the plan doc
https://claude.ai/code/artifact/7748ed30-34b0-408d-ba7f-2eef59fae0f5. If the
session isn't linked to his Mac, use the plan doc and `docs/CURRENT_STATE.md`.

## Docs on every push

Every push to a pull request that changes anything outside `docs/` (code,
database, config, CI) updates the docs in the same push. Nothing is "not
affected": if it changed, it gets written down. Readers of `main`, including
Jesse's project chats, see only what the docs say, and PR #65 merged a month of
app changes with none of them recorded (Oct 13).

- Always: `docs/CURRENT_STATE.md` — add what changed and what is true now.
- Database or server functions (`supabase/`): also `docs/SUPABASE.md`.
- Builds, previews, OTA, native config (`.eas/`, `eas.json`, `app.json`,
  `app.config.js`, the release and preview workflows): also `docs/RELEASE.md`.
- CI or the PR template: also `docs/GITHUB.md`.
- Purchases (`services/purchasesService.ts`, `revenuecat-webhook`): also
  `docs/runbooks/REVENUECAT.md`.
- A decision Jesse made: also `docs/product/DECISIONS.md` (and the plan doc's
  Decision log). A decision that changes an older one says "revises Dn", and
  the older entry gets "(Revised by Dm …)". Never delete the older entry.
- Screen layout, components or wording rules: also `docs/product/DESIGN.md`.
- What the app does for players changed: also `docs/product/PRODUCT.md`.

When you write a status, say which kind it is: **decided**, **on a branch**,
**live backend** (checked how, when), or **tested on device** (which build,
when). Branch code is not live, and live backend is not tested on a phone.

CI enforces the file-based rules above on every push (`docs updated` job,
`scripts/check-docs-updated.mjs`) and runs structural checks between the docs
and the repo in `pnpm check` (`scripts/check-docs-consistency.mjs`: every Edge
Function and October+ migration named in `docs/SUPABASE.md`, function counts,
the README decision range, "revises" back-references, the release workflow
staying manual). CI can't tell whether a sentence is true or what production
or a phone does; that is checked by hand. Decisions, design and product docs
are on the PR checklist only. A push that fails a check is fixed by updating
the docs, never by skipping the check. `main` has no branch protection yet, so
the checks don't block a merge (`docs/GITHUB.md`).

## Read order

1. `docs/CURRENT_STATE.md` — what is actually shipped, live, and blocked.
2. `docs/ARCHITECTURE.md` — code, data, Realtime, and native boundaries.
3. `docs/DEVELOPMENT.md` — setup, branch, preview, and handoff workflow.
4. `docs/TESTING.md` — required automated and multi-user verification.
5. `docs/RELEASE.md` — PR → Expo Go preview (automatic), production OTA and
   TestFlight builds (both manual, Jesse only), rollback.
6. `docs/SUPABASE.md` — live-cloud grounding, migrations, functions, and deployment.
7. `docs/FEEDBACK_TRACKER.md` — Jesse's screen-by-screen feedback, its
   done/in-progress/backlog status, and which commit/branch/PR each item
   landed in. Read this before starting any UI/polish task and update it as
   part of the same change.
8. For product or visual work, read the relevant files under `docs/product/`.
9. `docs/runbooks/` — one self-contained file per repeatable operation
   (currently `docs/runbooks/ACCOUNT_TAGS.md`). If a task is one of these
   operations, that file is the whole procedure — do not re-derive it from the
   codebase.

## Repository authority

- GitHub: `jGPT-Automated/LocalCheck_Expo`; `origin/main` is code truth.
- App root: repository root. Run Expo, pnpm, and EAS commands here.
- EAS project: `agenticjess-os/localcheck`, id
  `9c906173-0258-45a9-a3fe-786cda373c66`.
- Production backend: Supabase `LocalCheckProd`, ref
  `qkrnmyexzvaxiqfxwwfb`.
- Database history: `supabase/migrations/`; functions:
  `supabase/functions/`.

Never implement from an archive, another checkout, an old pull request, a
generated design artifact, or a machine-specific path. Do not add an
application API tier, workspace packages, fabricated application data, or
client-persisted product state.

## Start every task cleanly

```bash
git fetch origin
git status --short --branch
git switch main
git pull --ff-only
git switch -c codex/<short-task-name>
pnpm doctor
```

Use a worktree when another task is active. Do not work directly on `main`,
force-push shared branches, or include unrelated user changes.

## Collaboration contract

- **Subagents (helpers a lead agent starts):** each works in its own git
  worktree on its own local branch, commits only there, and never pushes,
  opens a PR, merges or touches `main`/`codex/*`. It hands back a branch +
  screenshots; the lead reviews, integrates into the PR branch and pushes.
  At most 2–3 helpers at once. Only Jesse merges to `main`.

- Restate the exact bounded scope before acting. If a requested correction
  exposes an adjacent problem, report it without silently adding it to the
  implementation.
- Answer direct questions and status requests before continuing tool work.
- Work one independently verifiable outcome at a time: implement, test, show
  the connected preview or device evidence, then move to the next surface.
- Treat prior agent summaries, plans, and comments as leads rather than facts.
  Verify current Git, deployed-service, and runtime state directly.
- Explain external actions before taking them. Production database changes,
  Edge Function deployment, EAS Update, TestFlight work, GitHub merge, and
  branch deletion require explicit authorization for that exact action.
- Use the in-app Browser for connected preview work when requested. Do not
  substitute an external browser or computer-control workflow.
- Talk to Jesse in plain language: the outcome and the action, no filler.
  Ask him when a decision is his or quicker for him to answer; once he
  answers, record it (`docs/product/DECISIONS.md` and his plan doc's Tracker)
  and act on it.
- Keep updates concrete: name what changed, what was proven, what remains
  unproven, and the next check. Do not represent source presence or a passing
  static check as deployed runtime behavior.
- End every turn that changed the repo or the backend with an explicit,
  clickable trail so Jesse can confirm without hunting:
  - each changed file as a repo-relative path (`services/foo.ts:42`);
  - each authority/runbook doc you updated, by path;
  - for a backend change, the migration file path **and** the Supabase project
    link `https://supabase.com/dashboard/project/qkrnmyexzvaxiqfxwwfb`
    (SQL editor: `.../project/qkrnmyexzvaxiqfxwwfb/sql/new`);
  - for a release action, the EAS build id or PR URL.

## Required implementation rules

- Remove obsolete client paths instead of adding UI compatibility layers,
  fallbacks, or parallel implementations. Remote contracts used by an
  installed binary remain backward compatible until that binary is retired.
- Choose the simplest implementation that fully meets current requirements.
  Avoid speculative abstractions, configuration, and indirection.
- Grow the product in complete end-to-end layers. Never trade the working app
  for unfinished complexity.
- Keep components modular and concerns separated.
- Prefer established, maintained libraries when they reduce total complexity
  or improve reliability. Check installed dependencies, documentation, and
  types before adding a package or rebuilding common behavior.
- Make decisions that can last. Do not introduce a stopgap whose intended
  replacement is already known.
- Study proven product patterns before inventing a new interaction, then adapt
  the pattern to LocalCheck's actual users, data, and accessibility needs.
- Follow the hard layout rules in `docs/product/DESIGN.md` ("Layout rules"):
  the tab bar is a floor nothing renders under, and every name/number row is
  built for a 24-character username and four-digit values.
- Reuse the canonical UI components listed in `docs/product/DESIGN.md`. Before
  adding a page-local avatar, selector, metric, activity row, court card, or
  floating action, search for its shared component and improve that source.
- Render the LocalCheck mark only through `components/brand/LogoMark.tsx` and
  functional icons only through installed icon libraries. Do not create icons
  from Unicode, emoji, inline drawings, or one-off SVG/CSS shapes.

### UI change gate

- **Sign-off first (Oct 10).** A visible change (layout, colour, motion,
  wording) is shown to Jesse as screenshots before it is built; build exactly
  what he signed off (`~/Documents/LocalCheck_Oct2026/DESIGN_SIGNOFF.md`).
- **No new wording.** Use words already in the app or Jesse's; any new phrase
  goes on the sign-off board first.

- Before editing a screen, use `rg` to find the existing component that owns the
  same interaction and the tokens it uses. Reuse that implementation. A new
  component that only resembles an existing header, sheet, card, button, or
  control does not pass review.
- Treat user screenshots and visual annotations as acceptance cases. Identify
  the exact route, state, element, and owning component; make the smallest
  change that satisfies the latest instruction and preserve unrelated behavior.
- Visual consistency includes behavior. A surface that looks draggable must use
  the established draggable surface; back, close, tap-out, swipe, loading, and
  disabled states must work before the change is reported complete.
- Inspect the rendered route at an iPhone-sized viewport and exercise the
  changed interaction. If authentication or native-only behavior prevents that
  check, state the exact boundary in the pull request instead of substituting a
  source or export claim.
- A UI handoff must name the reused component, the rendered state inspected, the
  interaction exercised, and any device-only check still required.

- All durable product data comes from Supabase through `services/`.
- Approved database RPCs own atomic behavior. Do not replace them with client
  write sequences.
- Every schema change is a new immutable migration. Never edit an applied file.
- Production SQL is run by Jesse in the Supabase SQL editor: the agent pastes
  the migration there (byte-checked against the file), Jesse clicks Run, then
  the agent verifies with read-only queries and a rolled-back test as an
  allowed and a denied user, and records the row in
  `supabase_migrations.schema_migrations`. Patch long live functions in place
  with an anchor check (`pg_get_functiondef` + `replace`), never from memory.
  See `docs/SUPABASE.md`.
- RLS is part of the feature. Test the allowed user and at least one denied user.
- Realtime carries scoped invalidations; the client refetches authoritative
  rows. Do not use sockets as presence or add global polling.
- Court check-in is durable server state. Backgrounding, locking the phone, or
  disconnecting must not check a player out.
- Never claim success until Supabase confirms the write.
- Client persistence is limited to Supabase's authentication-session adapter.
  Product data, counts, ELO, and feature state are never device/browser state.
- PR previews run in **Expo Go on SDK 54**. Use only libraries Expo Go ships
  (Reanimated 4, gesture-handler, `@gorhom/bottom-sheet`, expo-haptics,
  expo-camera…). No dev-build-only packages (`@expo/ui`) or SDK 55+ APIs.
- Motion and touch follow `docs/product/DESIGN.md` → *Motion and feedback*:
  shared springs in `constants/motion.ts`, `PressableScale` for press
  feedback, real swipeable sheets (`AppBottomSheetModal`), `useToast()` for
  confirmations, Reduce Motion respected.
- **Test data never reaches real players.** `TEST` / `REVIEWER` accounts and
  test courts are hidden by RLS (`docs/runbooks/ACCOUNT_TAGS.md`). A new table
  or policy that shows one player's content to another must apply the same
  rule (`private.viewer_sees_test_data()`, `private.is_hidden_account()`,
  `private.is_test_court()`), and its RLS test covers a real viewer.
- Changes to Mapbox, notification native plugins/entitlements, Apple Sign-In,
  permissions, Expo plugins, and other native dependencies require a new
  development/TestFlight binary. JavaScript notification logic may ship by OTA
  only after the installed binary's native entitlement has been verified.
- Secrets belong in ignored `.env.local`, EAS, Supabase, or the relevant provider.
  Never commit them or paste them into logs.
- Interactive browser QA must start with `pnpm preview:web`. Never serve a CI
  export, a generic `pnpm export:web` directory, or another task's temporary
  bundle as a connected preview.

## Definition of done

Run the proportional subset and record it in the pull request:

```bash
pnpm check:release
git diff --check
```

Also perform the relevant signed-in test matrix in `docs/TESTING.md`. A backend
or Realtime change needs at least two simultaneous users. A native change needs
a development build or TestFlight check. A visual change needs a browser
preview and phone screenshot at the affected state.

## Pull request and handoff

Every change ends in a pull request or a clear handoff containing:

- outcome and user-visible behavior;
- files and contracts changed;
- automated commands and results;
- browser/device/accounts tested;
- Supabase migrations or EAS release action required;
- remaining risks, blockers, and exact next action.

Do not merge with failing required checks or unresolved review conversations.
Do not deploy a migration, OTA, TestFlight build, or production change unless
the task explicitly authorizes that external action.

Only Jesse merges. A merge builds nothing: TestFlight builds and production
OTAs are started by hand, by Jesse (`docs/RELEASE.md`). Each build spends one
of the plan's monthly iOS builds, so protect that quota: never start a build,
and say in the PR when a change needs one.

## Repeatable operations

Some tasks recur: reclassifying accounts, granting a cohort, rotating a flag.
Each one has exactly one file under `docs/runbooks/` that is the *complete*
procedure — the meaning, every code touchpoint (the blast radius), and
copy-paste SQL. When a task matches a runbook:

- follow that file; do not re-explore the codebase to reconstruct the steps;
- if reality has drifted from the runbook, fix the runbook in the same change;
- a runbook, its code touchpoints, and any DB constraint it names must always
  agree, and land together in one pull request.

Current runbooks:

- `docs/runbooks/ACCOUNT_TAGS.md` — `profiles.account_tag`
  (`FOUNDER` / `STARTER` / `REVIEWER` / `TEST` / null) and `courts.is_test`:
  who real players can see, who sees test data, the four test courts, making
  a test account, launch checks, grants.
- `docs/runbooks/REVENUECAT.md` — LocalPlus monetization end to end: the plans
  (Yearly $49.99, Monthly $4.99, US only), the App Store Connect + RevenueCat setup steps
  with a per-gate checklist, env var names, the webhook, and the app-code /
  cutover phases. Supersedes `launch/REVENUECAT_START_NOW.txt`.

## Documentation discipline

Keep documentation small and current. Update an existing authority file when a
durable contract changes. Feature exploration belongs in `docs/plans/` until it
is implemented; it must not be presented as current behavior. Do not create
activity logs, duplicate runbooks, machine inventories, or competing sources of
truth. After any change to the repo or backend, bring the affected authority
file (`docs/CURRENT_STATE.md`, `docs/SUPABASE.md`, `docs/FEEDBACK_TRACKER.md`,
the relevant runbook) to current in the same push — see "Docs on every push"
at the top; anything changed counts as affected.
