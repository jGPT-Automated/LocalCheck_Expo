-- Self-service username change, from Settings. Applied directly to
-- LocalCheckProd (see docs/CURRENT_STATE.md) — this file documents it.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Lightweight denylist-based text moderation for user-chosen strings
-- (usernames today). Not vision-model classification like verify-court's
-- photo check — that solves a different problem (is this a real photo).
-- For a short, frequently-changed string, a normalized substring denylist is
-- the standard approach other consumer apps use (fast, no network round
-- trip, no per-change cost). Not exhaustive; a starting baseline.
create or replace function private.contains_blocked_word(p_text text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text;
  v_word text;
  v_denylist text[] := array[
    'fuck','shit','bitch','cunt','asshole','dick','pussy','cock','whore',
    'slut','bastard','nigger','nigga','fag','faggot','retard','rape',
    'rapist','molest','pedo','pedophile','nazi','hitler','kike','chink',
    'spic','wetback','tranny','dyke','coon','gook','slave','terrorist'
  ];
begin
  if p_text is null then
    return false;
  end if;
  v_norm := lower(p_text);
  -- rough leetspeak normalization before stripping non-letters
  v_norm := translate(v_norm, '013457$@!', 'oieastsai');
  v_norm := regexp_replace(v_norm, '[^a-z]', '', 'g');
  -- collapse runs of a repeated letter (e.g. "fuuuck" -> "fuck")
  v_norm := regexp_replace(v_norm, '(.)\1+', '\1', 'g');

  foreach v_word in array v_denylist loop
    if v_norm like '%' || v_word || '%' then
      return true;
    end if;
  end loop;
  return false;
end
$$;

revoke execute on function private.contains_blocked_word(text)
  from public, anon, authenticated;

-- Self-service username change: format + moderation + uniqueness, one
-- atomic statement. Raises a distinct SQLSTATE per failure reason so the
-- client can show a specific message instead of a generic error.
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
    where lower(username) = lower(v_username) and id <> auth.uid()
  ) then
    raise exception 'That username is taken.'
      using errcode = 'LC003';
  end if;

  update public.profiles set username = v_username where id = auth.uid();
end
$$;

revoke execute on function public.update_username(text) from public, anon;
grant execute on function public.update_username(text) to authenticated;

commit;
