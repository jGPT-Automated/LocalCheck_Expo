-- Final username model (decision D9, Oct 3):
--   * profiles.id            permanent user id, never shown.
--   * profiles.referral_code frozen referral handle = the account's FIRST
--                            auto-generated username. Never changes.
--   * profiles.username      visible name, editable, moderated, unique.
--                            display_name always equals it.
--
-- Apply AFTER 20260915000000_update_username_syncs_display_name.sql (this file
-- redefines update_username again, adding the frozen-handle guard).
-- No real users exist yet (every account is a test account), so both backfills
-- below are safe.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. Shown name = username, everywhere ────────────────────────────────────
update public.profiles
set display_name = username
where display_name is distinct from username;

-- ── 2. Frozen referral handle = current username, for existing accounts ─────
-- Two passes: clearing first means no row can collide with another row's old
-- random code halfway through the update.
update public.profiles set referral_code = null;
update public.profiles set referral_code = username;

create unique index if not exists profiles_referral_code_lower_key
  on public.profiles (lower(referral_code))
  where referral_code is not null;

-- ── 3. New accounts: handle = their auto-generated username ─────────────────
-- handle_new_user inserts the profile with a generated username; this BEFORE
-- INSERT trigger copies it. Falls back to the old random code only if the
-- name somehow matches someone else's frozen handle.
create or replace function private.set_referral_code_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.referral_code is null then
    if new.username is not null and not exists (
      select 1 from public.profiles
      where lower(referral_code) = lower(new.username)
    ) then
      new.referral_code := new.username;
    else
      new.referral_code := private.generate_referral_code();
    end if;
  end if;
  return new;
end
$$;

-- Auto-generated usernames also skip anyone's frozen handle, so a typed
-- invite name always points at one account.
create or replace function private.generate_username(p_base text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 1;
begin
  v_base := lower(regexp_replace(coalesce(p_base, ''), '[^a-z0-9_]+', '', 'g'));
  if v_base = '' then
    v_base := 'player';
  end if;
  if length(v_base) < 3 then
    v_base := rpad(v_base, 3, 'x');
  end if;
  v_base := left(v_base, 20);

  v_candidate := v_base;
  while exists (
    select 1 from public.profiles
    where lower(username) = v_candidate or lower(referral_code) = v_candidate
  ) loop
    v_suffix := v_suffix + 1;
    if v_suffix > 50 then
      v_candidate := left(v_base, 12)
        || '_' || substr(replace(p_id::text, '-', ''), 1, 8);
      exit;
    end if;
    v_candidate := left(v_base, 30 - length(v_suffix::text)) || v_suffix::text;
  end loop;

  return v_candidate;
end
$$;

revoke execute on function private.generate_username(text, uuid) from public, anon, authenticated;

-- ── 4. Username changes: keep display_name in sync; can't take a handle ─────
create or replace function public.update_username(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := btrim(coalesce(p_username, ''));
begin
  if v_username !~ '^[A-Za-z0-9_]{3,32}$' then
    raise exception 'Usernames are 3-32 characters: letters, numbers, and underscores only.'
      using errcode = 'LC001';
  end if;

  if private.contains_blocked_word(v_username) then
    raise exception 'That username isn''t allowed. Try something else.'
      using errcode = 'LC002';
  end if;

  if exists (
    select 1 from public.profiles
    where id <> auth.uid()
      and (lower(username) = lower(v_username) or lower(referral_code) = lower(v_username))
  ) then
    raise exception 'That username is taken.'
      using errcode = 'LC003';
  end if;

  update public.profiles
  set username = v_username, display_name = v_username
  where id = auth.uid();
end
$$;

-- ── 5. "Invited by": accept the frozen handle or the current username ───────
create or replace function public.redeem_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := lower(btrim(coalesce(p_code, '')));
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
  where lower(referral_code) = v_code;

  if v_referrer is null then
    select id into v_referrer
    from public.profiles
    where lower(username) = v_code;
  end if;

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

commit;
