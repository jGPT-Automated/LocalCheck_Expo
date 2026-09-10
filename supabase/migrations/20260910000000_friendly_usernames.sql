-- Friendly auto-generated usernames.
--
-- Target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb), PostgreSQL 17. SOURCE-ONLY
-- until applied through the connected Supabase migration tool.
--
-- Before: private.handle_new_user() always set
--   left(base, 15) || '_' || substr(replace(id::text, '-', ''), 1, 16)
-- so "mapcrash@test.com" became "@mapcrash_61f0edc6c8a64f62" — a 25-char handle
-- with a 16-hex tail on every account, even when "mapcrash" was free.
--
-- After: the handle is just the cleaned base ("mapcrash"); a numeric suffix is
-- added only on a real collision ("mapcrash2"), and the UUID tail is a
-- last-resort fallback for a signup race. Existing hex-tailed handles are
-- collapsed the same way.
--
-- No behaviour depends on the username string (no FKs; profile links resolve by
-- id; search is ILIKE). RLS, grants and the auth.users trigger are unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Shared helper: the shortest free handle for a base, honouring the
-- `^[A-Za-z0-9_]{3,32}$` CHECK and the lower(username) unique index.
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
    select 1 from public.profiles where lower(username) = v_candidate
  ) loop
    v_suffix := v_suffix + 1;
    if v_suffix > 50 then
      -- Give up on a pretty handle; guarantee uniqueness with a short id tail.
      v_candidate := left(v_base, 12)
        || '_' || substr(replace(p_id::text, '-', ''), 1, 8);
      exit;
    end if;
    v_candidate := left(v_base, 30 - length(v_suffix::text)) || v_suffix::text;
  end loop;

  return v_candidate;
end
$$;

revoke execute on function private.generate_username(text, uuid)
  from public, anon, authenticated;

-- Recreate the signup trigger to use the helper. Body is otherwise the
-- 20260723034511 version (display-name derivation + user_settings seed).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_display_name text;
begin
  v_base := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'player'
    ),
    '[^a-zA-Z0-9_]+', '', 'g'
  ));
  if v_base = '' then
    v_base := 'player';
  end if;

  v_display_name := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'Player'
  ), 80);

  begin
    insert into public.profiles (id, display_name, username)
    values (new.id, v_display_name, private.generate_username(v_base, new.id))
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Two signups off the same base at the same instant: fall back to the
    -- guaranteed-unique id-tailed form rather than fail the signup.
    insert into public.profiles (id, display_name, username)
    values (
      new.id,
      v_display_name,
      left(v_base, 12) || '_' || substr(replace(new.id::text, '-', ''), 1, 8)
    )
    on conflict (id) do nothing;
  end;

  insert into public.user_settings (user_id, apple_private_email)
  values (
    new.id,
    coalesce(new.email, '') ilike '%privaterelay.appleid.com'
  )
  on conflict (user_id) do nothing;

  return new;
end
$$;

revoke execute on function private.handle_new_user()
  from public, anon, authenticated;

-- Backfill: collapse existing "<base>_<16 hex>" handles. Row by row so the
-- helper sees handles already rewritten in this loop; idempotent (a second run
-- matches nothing).
do $$
declare
  r record;
  v_new text;
begin
  for r in
    select id, username
    from public.profiles
    where username ~ '_[0-9a-f]{16}$'
    order by id
  loop
    v_new := private.generate_username(
      regexp_replace(r.username, '_[0-9a-f]{16}$', ''),
      r.id
    );
    if v_new <> r.username then
      update public.profiles set username = v_new where id = r.id;
    end if;
  end loop;
end
$$;

commit;
