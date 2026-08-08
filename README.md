# LocalCheck

LocalCheck is an iOS-first Expo app for finding active basketball and
pickleball courts, checking in, planning runs, logging reviewed results, and
tracking sport-specific ELO. Supabase provides Auth, Postgres, RLS, Realtime,
and Edge Functions.

## Start here

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm doctor
pnpm preview:web
```

The web preview is useful for fast iteration and multi-user testing. A
development build or TestFlight is authoritative for Mapbox, notifications,
Apple Sign-In, SecureStore, location, and other native behavior.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm start` | Expo development server |
| `pnpm preview:web` | Repeatable browser preview on port 8081 |
| `pnpm typecheck` | TypeScript validation |
| `pnpm test` | Automated tests |
| `pnpm check` | Required fast CI suite |
| `pnpm export:web` | Production-style web bundle smoke test |
| `pnpm doctor` | Local development environment check |

## Structure

```text
app/                 Expo Router screens
components/          reusable UI and screen composition
context/             auth, realtime, notifications, presence, shared state
services/            Supabase domain access
lib/                 Supabase client and realtime hub
supabase/migrations/ immutable database history
supabase/functions/  deployable Edge Functions
.github/              CI and pull-request contract
.eas/workflows/       preview, OTA, and TestFlight workflows
docs/                 current engineering and product guidance
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — contributor contract and handoff standard
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — shipped/live checkpoint
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — setup and daily workflow
- [`docs/TESTING.md`](docs/TESTING.md) — automation and multi-user matrix
- [`docs/RELEASE.md`](docs/RELEASE.md) — preview, OTA, TestFlight, rollback
- [`docs/SUPABASE.md`](docs/SUPABASE.md) — local backend and migrations
- [`docs/GITHUB.md`](docs/GITHUB.md) — required checks and merge rules
- [`docs/product/README.md`](docs/product/README.md) — product/design material
