# Development workflow

## Canonical checkout

Use a standalone clone, not a nested project or copied folder:

```bash
cd ~/Documents
git clone https://github.com/jGPT-Automated/LocalCheck_Expo.git LocalCheck_Expo
cd LocalCheck_Expo
```

Open that folder itself in Codex or your editor. The repository root is the app
root.

## First setup

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm doctor
```

Fill `.env.local` with the public development Supabase URL/key and public Mapbox
token. Keep the Mapbox SDK download token in EAS as a secret; never put it in
`.env.local` or Git.

Before changing Supabase source, inspect `LocalCheckProd` read-only and compare
its current migration ledger, tables, functions, policies, and deployed Edge
Functions with the repository. Do not introduce a separate backend environment
or mutate production unless the task explicitly authorizes that action.

Watchman is optional but enables hot reload for larger Expo web trees on macOS.

## Daily branch workflow

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c codex/<short-task-name>
pnpm doctor
```

If another task already occupies the checkout, use a worktree:

```bash
git worktree add ../LocalCheck_<task> -b codex/<short-task-name> origin/main
```

Commit one coherent outcome at a time. Push the task branch and open a pull
request; do not push implementation commits directly to `main`.

## Preview choices

```bash
pnpm preview:web   # browser, fastest feedback, supports simultaneous accounts
pnpm start         # Expo dev server for a compatible development build
```

`pnpm preview:web` is the only supported interactive exported preview. It
stops only the prior preview recorded by this checkout, uses a new temporary
directory, overrides ambient public variables from `.env.local`, verifies the
configured Supabase URL is in the generated JavaScript, and disables browser
caching. If another process owns the requested port, it exits instead of
silently reusing unknown content.

`pnpm export:web` and the GitHub Actions export are compile-only checks. Their
output can contain deliberate placeholder values and must never be opened as a
connected application.

Expo Go is not an authoritative client because LocalCheck includes custom
native Mapbox code. Use a LocalCheck development build or TestFlight for phone
acceptance. The browser remains valuable for layout, annotations, and live
multi-account interaction.

## Before handoff

```bash
pnpm check:release
git diff --check
git status --short
```

`pnpm check:release` runs TypeScript, focused Realtime/presentation/identity/
schedule regression tests, the design-system consistency guard, and a fresh
export that must contain the real ignored development Supabase configuration.

The pull request template captures the outcome, risk category, evidence,
migration/release needs, and next action. Resolve every review conversation or
explain why the code changed differently before merge.
