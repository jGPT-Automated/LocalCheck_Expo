-- RevenueCat webhook support for public.subscriptions.
--
-- Target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb), PostgreSQL 17. Additive only.
-- Not yet applied — this file has been edited in place (safe: never applied).
--
-- A person can carry two independent subscription lineages at once — a promo
-- grant (billing_provider='promo', inserted directly per
-- docs/runbooks/ACCOUNT_TAGS.md) and a real store purchase — and
-- private.sync_profile_is_pro() already grants is_pro if *either* qualifies.
-- The unique key is therefore (user_id, billing_provider), not user_id alone:
-- a real purchase must never overwrite a promo row's expiry, and vice versa.
--
-- Verified against the live LocalCheckProd schema before writing this file:
-- public.subscriptions already carried a unique index
-- subscriptions_revenuecat_user_key on (revenuecat_app_user_id,
-- coalesce(entitlement_id, '')) from the original v2_core_schema migration.
-- Every row this project writes sets revenuecat_app_user_id = user_id and
-- entitlement_id = 'localplus', so that index caps a person at ONE
-- subscriptions row, full stop — it would silently block the dual-lineage
-- design below (a promo grant and a real purchase coexisting) no matter what
-- new index we add. It's dropped further down, in the same migration that
-- introduces the design it contradicts.
--
-- private.revenuecat_processed_events + last_event_ms guard against
-- RevenueCat's webhook delivering events out of order or twice. Per
-- RevenueCat's own docs (event ordering + error-handling guidance): a
-- retried delivery carries the exact same event id, and processed ids should
-- be remembered so each is applied once — comparing only against "the last
-- event we saw" isn't enough, because event_timestamp_ms is documented as
-- informational and BILLING_ISSUE / CANCELLATION / EXPIRATION in particular
-- can be dispatched with identical timestamps for genuinely different
-- events: a retried delivery of an EARLIER same-timestamp event, arriving
-- after a later one was already applied, would otherwise pass a
-- "different id, timestamp not older" check and incorrectly re-apply. The
-- apply function makes the whole dedup-check-and-write one atomic
-- statement — checking in application code first and writing after is a
-- race: two concurrent deliveries can both pass the same check and whichever
-- write lands last wins even if it's the older event.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Drop the legacy one-row-per-person index — see the module comment above.
drop index if exists public.subscriptions_revenuecat_user_key;

alter table public.subscriptions
  add column if not exists last_event_ms bigint,
  add column if not exists last_event_id text;

comment on column public.subscriptions.last_event_ms is
  'event_timestamp_ms of the last RevenueCat webhook event applied to this row. Informational per RevenueCat''s own docs — used only to reject a strictly older/stale event, never a same-instant distinct one. NOT the dedup key — see private.revenuecat_processed_events.';
comment on column public.subscriptions.last_event_id is
  'RevenueCat event.id of the last event applied to this row. An audit trail column, not itself the dedup mechanism (see private.revenuecat_processed_events for that).';

create unique index if not exists subscriptions_user_id_billing_provider_key
  on public.subscriptions (user_id, billing_provider);

-- Every RevenueCat event id ever applied, across every subscriber — the real
-- dedup key. See the module comment for why "just remember the last one"
-- isn't sufficient. Low write volume expected (a handful of events per
-- subscriber over its lifetime); no retention/cleanup job yet, deliberately —
-- add one if this ever becomes a real storage concern.
create table if not exists private.revenuecat_processed_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

revoke all on table private.revenuecat_processed_events
  from public, anon, authenticated;

-- Also expose, on profiles, which lineage is actually granting LocalPlus right
-- now — the app needs this to decide whether to show "manage/cancel" (a real,
-- billed subscription) or "comped, nothing to manage" (a promo row), and that
-- is NOT the same question as which account_tag a profile happens to wear: a
-- STARTER who redeemed their offer code now has a REAL app_store subscription
-- that will auto-renew and bill them, even though their tag never changes.
alter table public.profiles
  add column if not exists plus_billing_provider text;

comment on column public.profiles.plus_billing_provider is
  'billing_provider of whichever active/trialing, unexpired public.subscriptions row currently grants is_pro (a real store subscription beats a promo row if both happen to be active). Null when nothing is granting LocalPlus. Drives whether app/localplus.tsx shows a manage/cancel link.';

-- Re-derive is_pro AND plus_billing_provider together so they can never
-- disagree about which row is "the" active grant.
create or replace function private.sync_profile_is_pro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
  end if;

  update public.profiles p
  set
    is_pro = exists (
      select 1
      from public.subscriptions s
      where s.user_id = v_user_id
        and s.status in ('active', 'trialing')
        and (s.expires_at is null or s.expires_at > now())
    ),
    plus_billing_provider = (
      select s.billing_provider
      from public.subscriptions s
      where s.user_id = v_user_id
        and s.status in ('active', 'trialing')
        and (s.expires_at is null or s.expires_at > now())
      -- Prefer a real (billed) lineage over a promo one so the UI always
      -- offers to manage the subscription that can actually charge someone,
      -- if a user somehow has both active at once.
      order by (s.billing_provider = 'promo') asc, s.updated_at desc
      limit 1
    )
  where p.id = v_user_id;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    update public.profiles p
    set
      is_pro = exists (
        select 1 from public.subscriptions s
        where s.user_id = old.user_id
          and s.status in ('active', 'trialing')
          and (s.expires_at is null or s.expires_at > now())
      ),
      plus_billing_provider = (
        select s.billing_provider
        from public.subscriptions s
        where s.user_id = old.user_id
          and s.status in ('active', 'trialing')
          and (s.expires_at is null or s.expires_at > now())
        order by (s.billing_provider = 'promo') asc, s.updated_at desc
        limit 1
      )
    where p.id = old.user_id;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;

-- Atomic "apply this webhook event, unless we've already processed it or it's
-- stale" — the events-table dedup check and the state upsert both happen
-- inside this one function call, under one row lock for the state write.
-- Returns true if the event was applied, false if it was a duplicate or
-- stale and correctly ignored.
--
-- public schema (not private): PostgREST/supabase-js .rpc() only resolves
-- functions in the API-exposed schema, so the edge function's admin client
-- can call this only if it lives here. Locked to service_role below, the same
-- way public.claim_push_notifications is.
create or replace function public.apply_subscription_event(
  p_user_id uuid,
  p_revenuecat_app_user_id text,
  p_original_app_user_id text,
  p_product_id text,
  p_entitlement_id text,
  p_status text,
  p_billing_provider text,
  p_will_renew boolean,
  p_current_period_starts_at timestamptz,
  p_current_period_ends_at timestamptz,
  p_trial_ends_at timestamptz,
  p_cancelled_at_mode text, -- 'now' | 'clear' | 'preserve'
  p_expires_at timestamptz,
  p_raw_payload jsonb,
  p_event_id text,
  p_event_ms bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_new_event boolean;
  v_applied boolean := false;
begin
  if p_cancelled_at_mode not in ('now', 'clear', 'preserve') then
    raise exception 'invalid p_cancelled_at_mode: %', p_cancelled_at_mode;
  end if;

  -- True dedup: an event id already recorded — from any prior call, applied
  -- in any order — is a no-op. This is what actually implements "process
  -- each event once"; the timestamp check further down only guards against
  -- a genuinely-new-to-us event being chronologically stale.
  if p_event_id is not null then
    insert into private.revenuecat_processed_events (event_id)
    values (p_event_id)
    on conflict (event_id) do nothing
    returning true into v_is_new_event;

    if not coalesce(v_is_new_event, false) then
      return false;
    end if;
  end if;

  with upserted as (
    insert into public.subscriptions (
      user_id, revenuecat_app_user_id, original_app_user_id, product_id,
      entitlement_id, status, billing_provider, will_renew,
      current_period_starts_at, current_period_ends_at, trial_ends_at,
      cancelled_at, expires_at, raw_payload, last_event_id, last_event_ms,
      updated_at
    ) values (
      p_user_id, p_revenuecat_app_user_id, p_original_app_user_id, p_product_id,
      p_entitlement_id, p_status, p_billing_provider, p_will_renew,
      p_current_period_starts_at, p_current_period_ends_at, p_trial_ends_at,
      case p_cancelled_at_mode when 'now' then now() else null end,
      p_expires_at, p_raw_payload, p_event_id, p_event_ms, now()
    )
    on conflict (user_id, billing_provider) do update set
      revenuecat_app_user_id = excluded.revenuecat_app_user_id,
      original_app_user_id = excluded.original_app_user_id,
      product_id = excluded.product_id,
      entitlement_id = excluded.entitlement_id,
      status = excluded.status,
      will_renew = excluded.will_renew,
      current_period_starts_at = excluded.current_period_starts_at,
      current_period_ends_at = excluded.current_period_ends_at,
      trial_ends_at = excluded.trial_ends_at,
      cancelled_at = case p_cancelled_at_mode
        when 'now' then now()
        when 'clear' then null
        else public.subscriptions.cancelled_at
      end,
      expires_at = excluded.expires_at,
      raw_payload = excluded.raw_payload,
      last_event_id = excluded.last_event_id,
      last_event_ms = excluded.last_event_ms,
      updated_at = now()
    -- Dedup already happened above (revenuecat_processed_events). This only
    -- rejects a genuinely-new-to-us event that is nonetheless chronologically
    -- stale (an old, delayed delivery arriving after newer state is already
    -- recorded). Ties are allowed through on purpose — RevenueCat documents
    -- BILLING_ISSUE/CANCELLATION/EXPIRATION can share a timestamp for
    -- genuinely different events.
    where public.subscriptions.last_event_ms is null
       or public.subscriptions.last_event_ms <= excluded.last_event_ms
    returning 1
  )
  select count(*) > 0 into v_applied from upserted;

  return v_applied;
end
$$;

revoke execute on function public.apply_subscription_event(
  uuid, text, text, text, text, text, text, boolean,
  timestamptz, timestamptz, timestamptz, text, timestamptz, jsonb, text, bigint
) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(
  uuid, text, text, text, text, text, text, boolean,
  timestamptz, timestamptz, timestamptz, text, timestamptz, jsonb, text, bigint
) to service_role;

commit;
