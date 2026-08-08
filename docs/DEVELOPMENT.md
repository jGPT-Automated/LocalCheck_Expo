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
cp .env.example .env
pnpm doctor
```

Fill `.env` with the public development Supabase URL/key and public Mapbox
token. Keep the Mapbox SDK download token in EAS as a secret; never put it in
`.env` or Git.

For local Supabase work, install Docker Desktop or another Docker-compatible
runtime, then use `npx supabase start`. Watchman is optional but enables hot
reload for larger Expo web trees on macOS.

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

Expo Go is not an authoritative client because LocalCheck includes custom
native Mapbox code. Use a LocalCheck development build or TestFlight for phone
acceptance. The browser remains valuable for layout, annotations, and live
multi-account interaction.

## Before handoff

```bash
pnpm check
pnpm export:web
git diff --check
git status --short
```

The pull request template captures the outcome, risk category, evidence,
migration/release needs, and next action. Resolve every review conversation or
explain why the code changed differently before merge.
