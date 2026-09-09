-- Lightweight client crash/error capture.
--
-- The RN ErrorBoundary (components/ErrorBoundary.tsx via app/_layout.tsx) and a
-- global JS handler (services/errorReportService.ts) write one row here on a
-- caught render error or an unhandled JS error. Best-effort: the client
-- swallows every failure. Nothing in the app reads this table — inspect it from
-- the Supabase SQL console:
--
--   select created_at, route, message, error_stack, component_stack
--   from public.client_errors order by created_at desc limit 50;
--
-- Applied to LocalCheckProd 2026-09-09.

begin;

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  error_stack text,
  component_stack text,
  route text,
  source text,
  platform text,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

-- Clients may INSERT only. There is deliberately NO select policy, so a client
-- role can never read the table.
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert to anon, authenticated with check (true);

grant insert on public.client_errors to anon, authenticated;

create index if not exists client_errors_created_idx
  on public.client_errors (created_at desc);

commit;
