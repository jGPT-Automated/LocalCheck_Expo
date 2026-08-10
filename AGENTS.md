# LocalCheck contributor contract

This repository is the complete LocalCheck product: one Expo application and
its Supabase source of truth. Read this file before changing anything.

## Read order

1. `docs/CURRENT_STATE.md` — what is actually shipped, live, and blocked.
2. `docs/ARCHITECTURE.md` — code, data, Realtime, and native boundaries.
3. `docs/DEVELOPMENT.md` — setup, branch, preview, and handoff workflow.
4. `docs/TESTING.md` — required automated and multi-user verification.
5. `docs/RELEASE.md` — OTA, TestFlight, and rollback procedure.
6. `docs/SUPABASE.md` — live-cloud grounding, migrations, functions, and deployment.
7. For product or visual work, read the relevant files under `docs/product/`.

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
- Reuse the canonical UI components listed in `docs/product/DESIGN.md`. Before
  adding a page-local avatar, selector, metric, activity row, court card, or
  floating action, search for its shared component and improve that source.
- Render the LocalCheck mark only through `components/brand/LogoMark.tsx` and
  functional icons only through installed icon libraries. Do not create icons
  from Unicode, emoji, inline drawings, or one-off SVG/CSS shapes.

- All durable product data comes from Supabase through `services/`.
- Approved database RPCs own atomic behavior. Do not replace them with client
  write sequences.
- Every schema change is a new immutable migration. Never edit an applied file.
- RLS is part of the feature. Test the allowed user and at least one denied user.
- Realtime carries scoped invalidations; the client refetches authoritative
  rows. Do not use sockets as presence or add global polling.
- Court check-in is durable server state. Backgrounding, locking the phone, or
  disconnecting must not check a player out.
- Never claim success until Supabase confirms the write.
- Client persistence is limited to Supabase's authentication-session adapter.
  Product data, counts, ELO, and feature state are never device/browser state.
- Mapbox, notifications, Apple Sign-In, permissions, Expo plugins, entitlements,
  and native dependencies require a new development/TestFlight binary.
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

An approved merge to `main` automatically starts the EAS production iOS build
and TestFlight submission. Treat the merge itself as the release authorization:
the PR must state device coverage, native risk, and any App Store Connect step
still required. Production OTA remains manual.

## Documentation discipline

Keep documentation small and current. Update an existing authority file when a
durable contract changes. Feature exploration belongs in `docs/plans/` until it
is implemented; it must not be presented as current behavior. Do not create
activity logs, duplicate runbooks, machine inventories, or competing sources of
truth.
