-- PR #43 — founding cohort, referral tracking, and the local-court cooldown.
--
-- Adds four profile columns and the machinery around them:
--   is_founding_member     the original ~100 users; drives the STARTER badge
--                          and a one-year LocalPlus grant.
--   referral_code          short public code every profile can share.
--   recruited_by           who invited this player (set once, via RPC).
--   recruits_count          how many players this profile has brought on.
--   local_court_changed_at  stamped whenever local_court_id changes; the app
--                          blocks another change for 7 days.
--
-- LocalPlus itself is unchanged: it still derives from public.subscriptions
-- via private.sync_profile_is_pro(). The founding grant is a 'promo'
-- subscription row so that existing plumbing lights up with no new flag.
--
-- Forward-only. Safe to apply before the client ships (every column is
-- nullable or defaulted; the client tolerates their absence).

begin;

-- ── Columns ──────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_founding_member boolean not null default false,
  add column if not exists referral_code text,
  add column if not exists recruited_by uuid references public.profiles(id)
    on delete set null,
  add column if not exists recruits_count integer not null default 0
    check (recruits_count >= 0),
  add column if not exists local_court_changed_at timestamptz;

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code)
  where referral_code is not null;

create index if not exists profiles_recruited_by_idx
  on public.profiles (recruited_by)
  where recruited_by is not null;

-- ── Referral code generation ─────────────────────────────────────────────────
-- Six chars, unambiguous alphabet (no 0/O/1/I). Retries on the ~1e-9 collision.
create or replace function private.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i integer;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + floor(random() * length(v_alphabet))::int,
        1
      );
    end loop;
    exit when not exists (
      select 1 from public.profiles where referral_code = v_code
    );
  end loop;
  return v_code;
end
$$;

revoke execute on function private.generate_referral_code()
  from public, anon, authenticated;

create or replace function private.set_referral_code_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.referral_code is null then
    new.referral_code := private.generate_referral_code();
  end if;
  return new;
end
$$;

drop trigger if exists set_referral_code_on_insert on public.profiles;
create trigger set_referral_code_on_insert
  before insert on public.profiles
  for each row execute function private.set_referral_code_on_insert();

-- ── Local-court change stamp ─────────────────────────────────────────────────
-- The app enforces the 7-day window; this keeps the authoritative timestamp so
-- it survives reinstall and can't be gamed by clearing local state.
create or replace function private.stamp_local_court_changed_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.local_court_id is distinct from old.local_court_id
     and new.local_court_id is not null then
    new.local_court_changed_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists stamp_local_court_changed_at on public.profiles;
create trigger stamp_local_court_changed_at
  before update on public.profiles
  for each row execute function private.stamp_local_court_changed_at();

-- ── Redeem a referral code ───────────────────────────────────────────────────
-- Callable once per account, only while recruited_by is still null, never for
-- your own code. Increments the referrer's recruits_count in the same tx.
create or replace function public.redeem_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_referrer uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  select id into v_referrer
  from public.profiles
  where referral_code = v_code;

  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_referrer = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  update public.profiles
  set recruited_by = v_referrer
  where id = v_uid and recruited_by is null;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already_set');
  end if;

  update public.profiles
  set recruits_count = recruits_count + 1
  where id = v_referrer;

  return jsonb_build_object('ok', true, 'referrer', v_referrer);
end
$$;

revoke execute on function public.redeem_referral_code(text) from public, anon;
grant execute on function public.redeem_referral_code(text) to authenticated;

-- ── Backfill the founding cohort ─────────────────────────────────────────────
update public.profiles
set is_founding_member = true
where created_at < timestamptz '2026-09-06T00:00:00Z';

update public.profiles
set referral_code = private.generate_referral_code()
where referral_code is null;

-- A one-year LocalPlus grant for founders, expressed as a promo subscription so
-- private.sync_profile_is_pro() derives is_pro exactly as it will for paid subs.
insert into public.subscriptions (
  user_id, revenuecat_app_user_id, product_id, entitlement_id,
  status, billing_provider, current_period_starts_at, current_period_ends_at,
  expires_at, raw_payload
)
select
  p.id, p.id::text, 'founding_year_grant', 'localplus',
  'active', 'promo', now(), now() + interval '1 year',
  now() + interval '1 year',
  jsonb_build_object('grant', 'founding_member')
from public.profiles p
where p.is_founding_member = true
  and not exists (
    select 1 from public.subscriptions s
    where s.user_id = p.id and s.product_id = 'founding_year_grant'
  );

commit;
