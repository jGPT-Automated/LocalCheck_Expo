-- Durable push dispatch for LocalCheck notifications.
--
-- Deployment order is documented in docs/SUPABASE.md. The migration never
-- stores credentials in SQL. It reads these Vault entries at call time:
--   localcheck_supabase_url
--   localcheck_notification_webhook_secret

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

create extension if not exists pg_net;
create extension if not exists supabase_vault;

alter table public.notifications
  add column if not exists push_claimed_at timestamptz,
  add column if not exists next_push_attempt_at timestamptz;

-- Inbox rows created before push delivery existed must remain visible in-app,
-- but must not arrive later as a burst of stale device alerts.
update public.notifications
set push_status = 'skipped'
where push_status = 'pending'
  and push_attempts = 0
  and push_sent_at is null;

create index if not exists notifications_push_due_idx
  on public.notifications (next_push_attempt_at, created_at)
  where push_status in ('pending', 'failed', 'processing');

create table if not exists public.push_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_token_id uuid not null references public.push_tokens(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 10),
  expo_ticket_id text,
  ticket_status text not null check (ticket_status in ('accepted', 'error')),
  ticket_error text,
  receipt_status text check (receipt_status is null or receipt_status in ('pending', 'ok', 'error')),
  receipt_error text,
  next_receipt_check_at timestamptz,
  receipt_checked_at timestamptz,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, push_token_id, attempt_number),
  unique (expo_ticket_id)
);

create index if not exists push_delivery_receipts_due_idx
  on public.push_delivery_attempts (next_receipt_check_at)
  where receipt_status = 'pending';

alter table public.push_delivery_attempts enable row level security;
revoke all on public.push_delivery_attempts from anon, authenticated;
grant all on public.push_delivery_attempts to service_role;

-- Claims are atomic and use SKIP LOCKED so a webhook and the scheduled worker
-- cannot deliver the same notification concurrently. A stale processing claim
-- becomes recoverable after fifteen minutes.
create or replace function public.claim_push_notifications(
  p_notification_id uuid default null,
  p_limit integer default 25
)
returns table(notification_id uuid)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select n.id
    from public.notifications n
    where (p_notification_id is null or n.id = p_notification_id)
      and n.push_attempts < 5
      and (
        (n.push_status = 'pending'
          and coalesce(n.next_push_attempt_at, n.created_at) <= now())
        or (n.push_status = 'failed'
          and n.next_push_attempt_at is not null
          and n.next_push_attempt_at <= now())
        or (n.push_status = 'processing'
          and n.push_claimed_at < now() - interval '15 minutes')
      )
    order by coalesce(n.next_push_attempt_at, n.created_at), n.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.notifications n
    set push_status = 'processing',
        push_attempts = n.push_attempts + 1,
        push_claimed_at = now(),
        next_push_attempt_at = null,
        last_push_error = null
    from candidates c
    where n.id = c.id
    returning n.id
  )
  select id from claimed;
$$;

revoke execute on function public.claim_push_notifications(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_push_notifications(uuid, integer)
  to service_role;

-- The Edge Function is intentionally verify_jwt=false because this call is
-- authenticated by a dedicated, rotatable secret header. The same secret is
-- stored once in Edge Function secrets and once in Vault.
create or replace function private.dispatch_push_webhook(
  p_notification_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supabase_url text;
  v_webhook_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_supabase_url
  from vault.decrypted_secrets
  where name = 'localcheck_supabase_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'localcheck_notification_webhook_secret'
  order by created_at desc
  limit 1;

  -- A missing secret must not block the transaction that created the inbox
  -- notification. The pending row remains available for repair and replay.
  if nullif(btrim(v_supabase_url), '') is null
     or nullif(btrim(v_webhook_secret), '') is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_supabase_url, '/') || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-localcheck-webhook-secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'notification_id', p_notification_id,
      'source', case when p_notification_id is null then 'scheduled' else 'database' end
    ),
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function private.dispatch_push_webhook(uuid)
  from public, anon, authenticated;

create or replace function private.notify_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.dispatch_push_webhook(new.id);
  return new;
end;
$$;

revoke execute on function private.notify_push_dispatch()
  from public, anon, authenticated;

drop trigger if exists notify_push_dispatch on public.notifications;
create trigger notify_push_dispatch
after insert on public.notifications
for each row execute function private.notify_push_dispatch();

select cron.unschedule(jobid)
from cron.job
where jobname = 'localcheck-notification-dispatch';

select cron.schedule(
  'localcheck-notification-dispatch',
  '*/2 * * * *',
  $cron$select private.dispatch_push_webhook(null)$cron$
);

commit;
