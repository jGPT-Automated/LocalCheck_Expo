-- Challenge time + reminders, and 10-character usernames (Oct 12).
--
-- Run AFTER 20261010120000_expire_stale_challenges.sql (D39).
--
-- 1. Challenges get a time (Jesse, Oct 11): new column challenges.play_at.
--    create_challenge takes an optional p_play_at; when given it must be in the
--    next 5 days. play_on stays the day the client sent (its local day); only
--    when it is missing is it taken from p_play_at in Central time.
--    A day picked without a time must also be in the next 5 days (was 60).
--    Older app builds that send only p_play_on keep working.
-- 1b. The NEW CHALLENGE notification names the time ("... tomorrow at 6:30 PM").
-- 1c. Friend arrival alert: title "A friend just checked in", body "Jesse is at
--     Rancho" (was "Jesse is at Rancho" / "Checked in just now.").
-- 2. Reminder: 30 minutes before an accepted challenge's time, both players get
--    "CASUAL GAME / With Jesse at Rancho in 30 minutes" (Jesse, Oct 12). pg_cron
--    every 5 minutes, deduped per challenge and player.
-- 3. Usernames (D46): 3-10 letters and numbers. New signups get one made from
--    their email, cut to fit, with a number added only if taken. Existing
--    usernames that are longer or use "_" are shortened the same way. Referral
--    codes are frozen separately and do not change, so invite links keep
--    working. display_name follows the username, as update_username already
--    does.
--
-- Creates no tables. The new column sits on public.challenges, whose RLS and
-- grants are unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. challenges.play_at ────────────────────────────────────────────────────
alter table public.challenges add column if not exists play_at timestamptz;

-- ── 2. create_challenge with an optional time ────────────────────────────────
do $patch$
declare
  v_def text;
  v_sig_old text := $a$p_ranked boolean DEFAULT true)$a$;
  v_sig_new text := $n$p_ranked boolean DEFAULT true, p_play_at timestamp with time zone DEFAULT NULL::timestamp with time zone)$n$;
  v_window_old text := $a$  if p_play_on is not null and (p_play_on < current_date - 1 or p_play_on > current_date + 60) then
    raise exception 'Pick a day in the next two months.' using errcode = 'LC103';
  end if;$a$;
  v_window_new text := $n$  if p_play_at is not null then
    if p_play_at < now() - interval '15 minutes' or p_play_at > now() + interval '5 days' then
      raise exception 'Pick a time in the next 5 days.' using errcode = 'LC103';
    end if;
    -- The client sends its own local day; Central is only a fallback.
    p_play_on := coalesce(p_play_on, (p_play_at at time zone 'America/Chicago')::date);
  end if;
  if p_play_on is not null and (p_play_on < current_date - 1 or p_play_on > current_date + 5) then
    raise exception 'Pick a day in the next 5 days.' using errcode = 'LC103';
  end if;$n$;
  v_insert_old text := $a$  insert into public.challenges (challenger_id, opponent_id, court_id, play_on, ranked)
  values (v_user_id, p_opponent_id, p_court_id, p_play_on, coalesce(p_ranked, true))$a$;
  v_insert_new text := $n$  insert into public.challenges (challenger_id, opponent_id, court_id, play_on, play_at, ranked)
  values (v_user_id, p_opponent_id, p_court_id, p_play_on, p_play_at, coalesce(p_ranked, true))$n$;
  -- The invite names the time too: "... at Rancho tomorrow at 6:30 PM."
  -- Central time, the first market; the app shows it in the player's own zone.
  v_body_old text := $a$      || coalesce(private.challenge_place(v_row.court_id, v_row.play_on), '') || '.', 240),$a$;
  v_body_new text := $n$      || coalesce(private.challenge_place(v_row.court_id, v_row.play_on), '')
      || coalesce(' at ' || to_char(v_row.play_at at time zone 'America/Chicago', 'FMHH12:MI AM'), '')
      || '.', 240),$n$;
begin
  if to_regprocedure('public.create_challenge(uuid,uuid,date,boolean,timestamp with time zone)') is not null then
    return;
  end if;
  v_def := pg_get_functiondef('public.create_challenge(uuid,uuid,date,boolean)'::regprocedure);
  if position('set status = ''expired''' in v_def) = 0 then
    raise exception 'Run 20261010120000_expire_stale_challenges.sql first';
  end if;
  if position(v_sig_old in v_def) = 0
    or position(v_window_old in v_def) = 0
    or position(v_insert_old in v_def) = 0
    or position(v_body_old in v_def) = 0 then
    raise exception 'create_challenge anchors not found; definition drifted';
  end if;
  v_def := replace(v_def, v_body_old, v_body_new);
  v_def := replace(v_def, v_sig_old, v_sig_new);
  v_def := replace(v_def, v_window_old, v_window_new);
  v_def := replace(v_def, v_insert_old, v_insert_new);
  drop function public.create_challenge(uuid, uuid, date, boolean);
  execute v_def;
end
$patch$;

revoke execute on function public.create_challenge(uuid, uuid, date, boolean, timestamptz) from public, anon;
grant execute on function public.create_challenge(uuid, uuid, date, boolean, timestamptz) to authenticated;

-- ── 2b. Friend arrival alert reads like a notification ─────────────────────
-- Was title "Jesse is at Rancho", body "Checked in just now." Now the title
-- names the event and the body the specifics (Jesse, Oct 12).
do $patch$
declare
  v_def text;
  v_old text := $a$left(v.player_name || ' is at ' || v.court_name, 80),
             'Checked in just now.',$a$;
  v_new text := $n$'A friend just checked in',
             left(v.player_name || ' is at ' || v.court_name, 240),$n$;
begin
  v_def := pg_get_functiondef('private.promote_auto_check_ins()'::regprocedure);
  if position(v_new in v_def) > 0 then
    return;
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'promote_auto_check_ins anchor not found; definition drifted';
  end if;
  execute replace(v_def, v_old, v_new);
end
$patch$;

-- ── 3. 30-minute reminder ────────────────────────────────────────────────────
create or replace function private.remind_upcoming_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
  v_place text;
begin
  for v_row in
    select c.id, c.challenger_id, c.opponent_id, c.court_id, c.play_at, c.ranked,
      coalesce(pa.username, 'Your opponent') as challenger_name,
      coalesce(pb.username, 'Your opponent') as opponent_name
    from public.challenges c
    left join public.profiles pa on pa.id = c.challenger_id
    left join public.profiles pb on pb.id = c.opponent_id
    where c.status = 'accepted'
      and c.play_at is not null
      and c.play_at > now() + interval '25 minutes'
      and c.play_at <= now() + interval '35 minutes'
  loop
    select ' at ' || coalesce(nullif(ct.short_name, ''), ct.name)
    into v_place
    from public.courts ct where ct.id = v_row.court_id;

    perform private.create_notification(
      v_row.challenger_id, 'challenge', v_row.opponent_id, null, null, null,
      case when v_row.ranked then 'RANKED GAME' else 'CASUAL GAME' end,
      left('With ' || v_row.opponent_name || coalesce(v_place, '') || ' in 30 minutes', 240),
      jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
      'challenge-reminder:' || v_row.id::text || ':' || v_row.challenger_id::text
    );
    perform private.create_notification(
      v_row.opponent_id, 'challenge', v_row.challenger_id, null, null, null,
      case when v_row.ranked then 'RANKED GAME' else 'CASUAL GAME' end,
      left('With ' || v_row.challenger_name || coalesce(v_place, '') || ' in 30 minutes', 240),
      jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
      'challenge-reminder:' || v_row.id::text || ':' || v_row.opponent_id::text
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke execute on function private.remind_upcoming_challenges() from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'localcheck-challenge-reminders') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'localcheck-challenge-reminders';
  end if;
  perform cron.schedule(
    'localcheck-challenge-reminders',
    '*/5 * * * *',
    'select private.remind_upcoming_challenges()'
  );
end
$cron$;

-- ── 4. Usernames: 3-10 letters and numbers ───────────────────────────────────
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
  v_base := lower(regexp_replace(coalesce(p_base, ''), '[^a-zA-Z0-9]+', '', 'g'));
  if v_base = '' then
    v_base := 'player';
  end if;
  if length(v_base) < 3 then
    v_base := rpad(v_base, 3, 'x');
  end if;
  v_base := left(v_base, 10);

  v_candidate := v_base;
  while exists (
    select 1 from public.profiles
    where id <> p_id
      and (lower(username) = v_candidate or lower(referral_code) = v_candidate)
  ) loop
    v_suffix := v_suffix + 1;
    if v_suffix > 99 then
      -- 6 characters of the id: unique in practice; never blocks a signup.
      v_candidate := left(v_base, 4) || substr(replace(p_id::text, '-', ''), 1, 6);
      exit;
    end if;
    v_candidate := left(v_base, 10 - length(v_suffix::text)) || v_suffix::text;
  end loop;

  return v_candidate;
end
$$;

revoke execute on function private.generate_username(text, uuid) from public, anon, authenticated;

-- New signups: same base as before, then generate_username cuts it to fit.
do $patch$
declare
  v_def text;
  v_old_strip text := $a$'[^a-zA-Z0-9_]+', '', 'g'$a$;
  v_new_strip text := $n$'[^a-zA-Z0-9]+', '', 'g'$n$;
  v_old_fallback text := $a$left(v_base, 12) || '_' || substr(replace(new.id::text, '-', ''), 1, 8)$a$;
  v_new_fallback text := $n$left(v_base, 4) || substr(replace(new.id::text, '-', ''), 1, 6)$n$;
  v_settings_anchor text := $a$  insert into public.user_settings (user_id, apple_private_email)$a$;
  v_sync text := $n$  -- D46: the username is the name shown everywhere.
  update public.profiles set display_name = username where id = new.id;

$n$;
begin
  v_def := pg_get_functiondef('private.handle_new_user()'::regprocedure);
  if position(v_new_fallback in v_def) > 0 then
    return;
  end if;
  if position(v_old_strip in v_def) = 0
    or position(v_old_fallback in v_def) = 0
    or position(v_settings_anchor in v_def) = 0 then
    raise exception 'handle_new_user anchors not found; definition drifted';
  end if;
  v_def := replace(v_def, v_old_strip, v_new_strip);
  v_def := replace(v_def, v_old_fallback, v_new_fallback);
  v_def := replace(v_def, v_settings_anchor, v_sync || v_settings_anchor);
  execute v_def;
end
$patch$;

do $patch$
declare
  v_def text;
  v_old text := $a$  if v_username !~ '^[A-Za-z0-9_]{3,32}$' then
    raise exception 'Usernames are 3-32 characters: letters, numbers, and underscores only.'
      using errcode = 'LC001';
  end if;$a$;
  v_new text := $n$  if v_username !~ '^[A-Za-z0-9]{3,10}$' then
    raise exception 'Usernames are 3-10 letters and numbers.'
      using errcode = 'LC001';
  end if;$n$;
begin
  v_def := pg_get_functiondef('public.update_username(text)'::regprocedure);
  if position(v_new in v_def) > 0 then
    return;
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'update_username anchor not found; definition drifted';
  end if;
  execute replace(v_def, v_old, v_new);
end
$patch$;

-- Shorten existing usernames, one at a time so each sees the last.
alter table public.profiles drop constraint if exists profiles_username_check;

do $shorten$
declare
  v_row record;
  v_new text;
begin
  for v_row in
    select id, username from public.profiles
    where username !~ '^[A-Za-z0-9]{3,10}$'
    order by created_at
  loop
    v_new := private.generate_username(v_row.username, v_row.id);
    update public.profiles
    set username = v_new, display_name = v_new
    where id = v_row.id;
  end loop;
end
$shorten$;

alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[A-Za-z0-9]{3,10}$');

-- Everyone's shown name is their username (D46).
update public.profiles set display_name = username
where display_name is distinct from username;

commit;

notify pgrst, 'reload schema';
