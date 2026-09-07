-- PR #43 — founding cohort columns, referral tracking, local-court cooldown.
--
-- Adds five profile columns and the machinery around them:
--   is_founding_member     drives the STARTER badge + a one-year LocalPlus
--                          grant. Column ships now; the grant is made by a
--                          separate launch-day migration (see the tail of this
--                          file) so no pre-launch QA account becomes a founder.
--   referral_code          short public code every profile can share.
--   recruited_by            who invited this player (set once, via RPC).
--   recruits_count          how many players this profile has brought on.
--   local_court_changed_at  stamped whenever local_court_id changes; the app
--                          blocks another change for 7 days.
--
-- LocalPlus derives from public.subscriptions via private.sync_profile_is_pro().
-- This migration adds NO subscription rows.
--
-- Forward-only, pure additive plumbing. Safe to apply before the client ships
-- (every column is nullable or defaulted; the client tolerates their absence).

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

-- ── Referral-code backfill ──────────────────────────────────────────────────
-- Every existing row gets a code so referral flows work in QA immediately.
update public.profiles
set referral_code = private.generate_referral_code()
where referral_code is null;

-- ── Founding cohort + one-year LocalPlus grant: DEFERRED to launch day ───────
-- The original backfill (is_founding_member = created_at < 2026-09-06, plus a
-- 'founding_year_grant' promo subscription per founder) was removed. Every
-- account that exists pre-launch is a QA/burner (profiles.is_test = true), so
-- there is no real founding cohort yet. A launch-day migration will:
--   • stamp the launch date,
--   • grant is_founding_member + a 1-year 'founding_year_grant' promo row to the
--     first 100 real (is_test = false) sign-ups, one year from each user's own
--     created_at.
-- Keeping the grant out of this migration means applying it now is pure,
-- reversible plumbing.

commit;
