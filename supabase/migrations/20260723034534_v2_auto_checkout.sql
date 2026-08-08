-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- NOT YET APPLIED.
-- Intended target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb).
-- One database job every five minutes replaces any client-side cleanup loop.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create extension if not exists pg_cron;

create or replace function private.auto_checkout_stale_check_ins()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closed integer;
begin
  update public.check_ins
  set checked_out_at = checked_in_at + interval '45 minutes'
  where checked_out_at is null
    and checked_in_at < now() - interval '45 minutes';

  get diagnostics v_closed = row_count;
  return v_closed;
end
$$;

revoke execute on function private.auto_checkout_stale_check_ins()
  from public, anon, authenticated;

select cron.schedule(
  'localcheck-auto-checkout-stale-check-ins',
  '*/5 * * * *',
  $cron$select private.auto_checkout_stale_check_ins()$cron$
);

commit;

