-- Undo supabase/migrations/20261012180000_qstash_timers.sql.
-- Only if needed. Paste into the Supabase SQL editor and Run.
--
-- Puts back, exactly as they were before the migration ran (from the copy it
-- saved in private.migration_backups):
--   - create_challenge and respond_to_challenge
--   - the 5 repeating jobs (the push job was never changed)
--   - the list of notification kinds; the "Check-in posted" notifications,
--     which only exist because of the migration, are deleted first
-- Stops new timers (drops the 4 triggers) and closes every open timer, so a
-- QStash message still on its way does nothing when it arrives.
-- Leaves private.timers, private.migration_backups and the new functions in
-- place, unused, for the record.
--
-- Note: the restored create_challenge allows 5 days ahead (the #67 app offers
-- 7), and the restored jobs end auto check-ins after 3 hours (not 1.5).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $check$
begin
  if (select count(*) from private.migration_backups
      where migration = '20261012180000' and kind = 'function') <> 2 then
    raise exception 'Expected 2 saved functions in private.migration_backups; stopping.';
  end if;
  if not exists (select 1 from private.migration_backups
      where migration = '20261012180000' and kind = 'constraint'
        and name = 'notifications_type_check') then
    raise exception 'The saved notification kinds are missing; stopping.';
  end if;
  if (select count(*) from private.migration_backups
      where migration = '20261012180000' and kind = 'cron_job') < 5 then
    raise exception 'The saved repeating jobs are missing; stopping.';
  end if;
end
$check$;

drop trigger if exists book_challenge_timers on public.challenges;
drop trigger if exists book_check_in_timer on public.check_ins;
drop trigger if exists book_auto_check_in_post_timer on private.auto_check_in_arrivals;
drop trigger if exists book_match_timer on public.matches;

update private.timers
set fired_at = now(), result = 'undone'
where fired_at is null;

delete from public.notifications where type = 'auto_check_in';

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

  select definition into r from private.migration_backups
  where migration = '20261012180000' and kind = 'constraint' and name = 'notifications_type_check';
  alter table public.notifications drop constraint notifications_type_check;
  execute 'alter table public.notifications add constraint notifications_type_check ' || r.definition;

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
