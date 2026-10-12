-- Undo supabase/migrations/20261012180000_qstash_timers.sql.
-- Only if needed. Paste into the Supabase SQL editor and Run.
--
-- Puts back, exactly as they were before the migration ran (saved by the
-- migration in private.migration_backups):
--   - the 4 functions it replaced (create_challenge, respond_to_challenge,
--     expire_stale_challenges, remind_upcoming_challenges)
--   - the cron jobs (the 5 polling jobs and the original push job)
-- Stops new timers (drops the 4 triggers) and closes every open timer, so a
-- QStash message still in flight does nothing when it arrives.
-- Keeps private.timers and its functions for the record; they do nothing once
-- the triggers are gone and every timer is closed.
--
-- Note: the restored create_challenge allows 5 days ahead (the app in #67
-- offers 7), so a challenge for day 6 or 7 would be refused until it's redone.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $check$
begin
  if (select count(*) from private.migration_backups
      where migration = '20261012180000' and kind = 'function') <> 4 then
    raise exception 'Expected 4 saved functions in private.migration_backups; stopping.';
  end if;
  if not exists (select 1 from private.migration_backups
      where migration = '20261012180000' and kind = 'cron_job'
        and name = 'localcheck-notification-dispatch') then
    raise exception 'The saved push job is missing from private.migration_backups; stopping.';
  end if;
end
$check$;

drop trigger if exists book_challenge_timers on public.challenges;
drop trigger if exists book_check_in_timer on public.check_ins;
drop trigger if exists book_auto_check_in_hold_timer on private.auto_check_in_arrivals;
drop trigger if exists book_match_timer on public.matches;

update private.timers
set fired_at = now(), result = 'rolled_back'
where fired_at is null;

do $restore$
declare
  r record;
begin
  for r in
    select definition from private.migration_backups
    where migration = '20261012180000' and kind = 'function'
  loop
    execute r.definition;
  end loop;

  for r in
    select name, definition from private.migration_backups
    where migration = '20261012180000' and kind = 'cron_job'
  loop
    -- cron.schedule with an existing name updates that job in place.
    perform cron.schedule(
      r.name,
      split_part(r.definition, E'\n', 1),
      substr(r.definition, strpos(r.definition, E'\n') + 1)
    );
  end loop;
end
$restore$;

delete from supabase_migrations.schema_migrations where version = '20261012180000';

commit;
