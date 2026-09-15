-- update_username only ever touched profiles.username, but every player
-- surface (court rosters, activity feed, game cards, profile headers) reads
-- display_name instead. Claiming a username in onboarding (or Settings) had
-- no visible effect anywhere locals actually see a name. Redefining the same
-- function (never editing 20260911180000, which is already applied) so a
-- username change keeps both columns in sync going forward.
--
-- Existing rows are intentionally NOT backfilled here — that would silently
-- rename every existing account's displayed identity to its current handle,
-- which is a visible, decide-first change, not a bug fix.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

  update public.profiles
  set username = v_username, display_name = v_username
  where id = auth.uid();
end
$$;

commit;
