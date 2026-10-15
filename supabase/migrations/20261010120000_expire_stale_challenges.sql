-- Pending challenges expire after their day (D39, Oct 8).
--
-- Today a pending challenge whose day has passed stays in the opponent's inbox
-- forever. Now:
--   * New status 'expired'. A pending challenge with a play_on date expires once
--     that day is over (Central time, the first market); a pending challenge
--     with no date expires after 7 days.
--   * Accepted challenges are never touched: players may still log the result
--     (ranked) or mark it played (casual, which already auto-closes in
--     create_challenge).
--   * private.expire_stale_challenges() does the work. pg_cron runs it every 15
--     minutes (job 'localcheck-expire-challenges') and once at the end of this
--     migration. Nobody is notified; the row just leaves the inbox.
--   * 'expired' is not 'pending' or 'accepted', so the one-open-per-pair unique
--     index no longer holds the pair: either player can challenge again.
--   * create_challenge expires the pair's own stale pending challenge before its
--     duplicate check, so the 15-minute wait never blocks a new challenge.
--   * respond_to_challenge says "This challenge expired." (new LC112) instead of
--     "already answered" when the day has passed, even before the cron runs.
--   * cancel_challenge needs no change: an expired row is not pending/accepted,
--     so it answers "This challenge is already closed." (LC107).
--
-- Older app builds (1.0.3) only fetch pending/accepted rows, so an expired row
-- simply stops appearing for them.
--
-- Creates no tables, so there is nothing to enable RLS on. The existing select
-- policy and grants on public.challenges are unchanged.
-- Needs 20261006120000_challenges.sql and 20261007150000_casual_challenges_no_score.sql
-- first. Needs the pg_cron extension (already used by 20261009120000_auto_check_in.sql).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. Allow the new status ──────────────────────────────────────────────────
-- The original migration declared the check inline, so Postgres named it
-- challenges_status_check (<table>_<column>_check). Drop it and add it back
-- with the extra value.
alter table public.challenges drop constraint if exists challenges_status_check;
alter table public.challenges add constraint challenges_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled', 'completed', 'expired'));

-- ── 2. The sweep ─────────────────────────────────────────────────────────────
create or replace function private.expire_stale_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.challenges c
  set status = 'expired', updated_at = now()
  where c.status = 'pending'
    and (
      (c.play_on is not null
        and c.play_on < (now() at time zone 'America/Chicago')::date)
      or (c.play_on is null
        and c.created_at < now() - interval '7 days')
    );
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function private.expire_stale_challenges() from public, anon, authenticated;

-- ── 3. create_challenge: free the pair before the duplicate check ────────────
-- Patched in place with an anchor check, like 20261007150000.
do $patch$
declare
  v_def text;
  v_anchor text := $a$  if exists (
    select 1 from public.challenges c
    where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)$a$;
  v_new text := $n$  update public.challenges c
  set status = 'expired', updated_at = now()
  where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)
    and greatest(c.challenger_id, c.opponent_id) = greatest(v_user_id, p_opponent_id)
    and c.status = 'pending'
    and ((c.play_on is not null
          and c.play_on < (now() at time zone 'America/Chicago')::date)
      or (c.play_on is null
          and c.created_at < now() - interval '7 days'));

$n$;
begin
  v_def := pg_get_functiondef('public.create_challenge(uuid,uuid,date,boolean)'::regprocedure);
  if position('set status = ''expired''' in v_def) > 0 then
    return;
  end if;
  if position(v_anchor in v_def) = 0 then
    raise exception 'create_challenge anchor not found; definition drifted';
  end if;
  execute replace(v_def, v_anchor, v_new || v_anchor);
end
$patch$;

-- ── 4. respond_to_challenge: a clear message for an expired challenge ────────
-- Raising rolls back, so this cannot save the expiry itself; the cron does.
do $patch$
declare
  v_def text;
  v_anchor text := $a$  if v_row.status <> 'pending' then
    raise exception 'This challenge was already answered.' using errcode = 'LC106';
  end if;$a$;
  v_new text := $n$  if v_row.status = 'expired'
    or (v_row.status = 'pending'
      and ((v_row.play_on is not null
            and v_row.play_on < (now() at time zone 'America/Chicago')::date)
        or (v_row.play_on is null
            and v_row.created_at < now() - interval '7 days'))) then
    raise exception 'This challenge expired.' using errcode = 'LC112';
  end if;
$n$;
begin
  v_def := pg_get_functiondef('public.respond_to_challenge(uuid,boolean)'::regprocedure);
  if position('This challenge expired.' in v_def) > 0 then
    return;
  end if;
  if position(v_anchor in v_def) = 0 then
    raise exception 'respond_to_challenge anchor not found; definition drifted';
  end if;
  execute replace(v_def, v_anchor, v_new || v_anchor);
end
$patch$;

-- ── 5. Schedule (every 15 minutes) ───────────────────────────────────────────
do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'localcheck-expire-challenges') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'localcheck-expire-challenges';
  end if;
  perform cron.schedule(
    'localcheck-expire-challenges',
    '*/15 * * * *',
    'select private.expire_stale_challenges()'
  );
end
$cron$;

-- ── 6. Clear today's backlog ─────────────────────────────────────────────────
select private.expire_stale_challenges();

commit;
