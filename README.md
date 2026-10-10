# LocalCheck

LocalCheck is an iOS-first Expo app (SDK 54) for basketball and pickleball
players: find active courts, check in, plan runs, challenge friends, log
reviewed results, and climb sport-specific ELO leaderboards. LocalPlus
(Yearly $49.99 / Monthly $4.99, via RevenueCat) unlocks rankings, other
courts' details, and full history. Supabase provides Auth, Postgres, RLS,
Realtime, and Edge Functions. Website: https://localchecksports.com.

Native pieces (camera for QR codes and court photos, Mapbox, notifications,
Apple Sign-In, purchases) need a TestFlight build to verify; everything else
previews in Expo Go.

## Start here

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm doctor
pnpm preview:web
```

The web preview is useful for fast iteration and multi-user testing. A
development build or TestFlight is authoritative for Mapbox, notifications,
Apple Sign-In, SecureStore, location, and other native behavior.

Opening a pull request auto-publishes a scannable Expo Go preview. Merging
never builds: TestFlight builds are started by hand, by Jesse, from the
Actions tab (`release-ios.yml`, "Run workflow"), and each one spends a
monthly build. See `docs/RELEASE.md`. In Expo Go the Explore map shows a
nearby-court list instead (Mapbox needs a real build).

Test accounts (`TEST`, `REVIEWER`) and test courts are invisible to real
players; testers see everything. See `docs/runbooks/ACCOUNT_TAGS.md` before
making a test account or touching test data.

## Commands

| Command              | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `pnpm start`         | Expo development server                          |
| `pnpm preview:web`   | Repeatable browser preview on port 8081          |
| `pnpm typecheck`     | TypeScript validation                            |
| `pnpm test`          | Automated tests                                  |
| `pnpm check`         | Required fast CI suite                           |
| `pnpm export:web`    | Compile-only web export; not a connected preview |
| `pnpm check:release` | Full local gate plus verified connected export   |
| `pnpm doctor`        | Local development environment check              |

`pnpm preview:web` always creates a fresh export, loads the ignored local
development environment, and proves the bundle contains that Supabase project
before serving it. Never serve CI output or a generic `pnpm export:web` folder
as a signed-in preview; CI deliberately bundles non-production placeholders.

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
- [`docs/product/DESIGN.md`](docs/product/DESIGN.md) — tokens, canonical components, motion and feedback rules
- [`docs/product/DECISIONS.md`](docs/product/DECISIONS.md) — settled product decisions (D0–D34)
- [`docs/runbooks/`](docs/runbooks/) — account tags + test data, RevenueCat
- [`docs/product/ELO_AND_NOTIFICATIONS.md`](docs/product/ELO_AND_NOTIFICATIONS.md) — Compete ranking and actionable-vs-informational notification contract
