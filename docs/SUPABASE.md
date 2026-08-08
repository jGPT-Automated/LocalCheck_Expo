# Supabase workflow

Supabase `LocalCheckProd` (`qkrnmyexzvaxiqfxwwfb`) is the only backend.

```text
supabase/
  config.toml          local project configuration
  migrations/         immutable ordered schema history
  functions/          Edge Function source
  tests/database/      pgTAP authorization and contract tests
  seed.sql             safe local-only seed entry point
```

The migration files were reconciled from the live production
`supabase_migrations.schema_migrations` ledger on 2026-08-08. They describe
changes already applied to production. Never rename, edit, or replay an applied
file as a new change.

## Local stack

Install Docker Desktop or another Docker-compatible runtime, then:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` rebuilds the local database from migrations and local seed data. It
must never target production.

## Create a change

```bash
npx supabase migration new <short_description>
```

Write one forward migration. Include RLS, grants, indexes, Realtime/publication
effects, and recovery notes as part of the same pull request. Validate from a
fresh local reset and test both allowed and denied users.

Before deployment, compare local files with the linked project:

```bash
npx supabase link --project-ref qkrnmyexzvaxiqfxwwfb
npx supabase migration list
npx supabase db push --dry-run
```

Linking is local configuration. `db push` without `--dry-run`, function deploy,
and production secrets are external production actions and require explicit
authorization.

## Edge Functions

Serve locally with `npx supabase functions serve <name>`. Keep service-role and
provider secrets in Supabase; public Expo variables never contain them. Deploy
one named function at a time and verify its authenticated and unauthorized
paths.

## Realtime and API safety

Realtime schema access is locked down; LocalCheck uses private scoped Broadcast
topics. Do not enable broad public Postgres Changes. Treat Data API exposure as
explicit: client-visible tables need deliberate grants and RLS, while internal
tables should remain outside exposed schemas or inaccessible to client roles.
