-- Applied to project jzclwnzcektqhgkkdeje on 2026-07-13 via Supabase MCP
-- (also recorded in the project's supabase_migrations history).
--
-- Auto checkout: close any check-in older than 45 minutes.
-- Product decision (2026-07-13): players are auto-checked-out 45 minutes
-- after checking in; a future iteration may add a push reminder instead.
-- The client mirrors this window at read time — see AUTO_CHECKOUT_MINUTES
-- in artifacts/mobile/services/checkInService.ts. Keep the two in sync.

create extension if not exists pg_cron;

create or replace function public.auto_checkout_stale_checkins()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  update public.check_ins
    set checked_out_at = checked_in_at + interval '45 minutes'
    where checked_out_at is null
      and checked_in_at < now() - interval '45 minutes';
$$;

-- Runs every 5 minutes; idempotent (cron.schedule upserts by job name).
select cron.schedule(
  'auto-checkout-stale-checkins',
  '*/5 * * * *',
  $$select public.auto_checkout_stale_checkins()$$
);
