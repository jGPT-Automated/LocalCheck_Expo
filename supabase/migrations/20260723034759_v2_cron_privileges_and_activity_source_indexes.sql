-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create index if not exists activity_events_check_in_id_idx
  on public.activity_events (check_in_id)
  where check_in_id is not null;
create index if not exists activity_events_run_id_idx
  on public.activity_events (run_id)
  where run_id is not null;
create index if not exists activity_events_match_id_idx
  on public.activity_events (match_id)
  where match_id is not null;

commit;

