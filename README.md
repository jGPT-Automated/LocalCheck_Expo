# LocalCheck

LocalCheck is an iOS-first Expo app for finding active basketball and
pickleball courts, checking in, planning runs, logging reviewed results, and
tracking sport-specific ELO. Supabase provides Auth, Postgres, RLS, Realtime,
and Edge Functions.

Player QR scanning uses the native `expo-camera` scanner and Log Game dates use
`@react-native-community/datetimepicker`. Changes to either dependency require
a new iOS build; the browser preview uses its native HTML date control and
intentionally reports that QR scanning is available in the iOS app.

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

Opening a pull request auto-publishes a scannable Expo Go preview and merging
it auto-triggers the TestFlight build — see `docs/RELEASE.md`. Expo Go runs
the whole app except Explore's native map, which crashes on mount there
(reload recovers); use a development build or TestFlight to check the map.

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
- [`docs/product/ELO_AND_NOTIFICATIONS.md`](docs/product/ELO_AND_NOTIFICATIONS.md) — Compete ranking and actionable-vs-informational notification contract
