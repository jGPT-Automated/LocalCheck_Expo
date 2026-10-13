-- Undo supabase/migrations/20261012200000_checkout_notice_for_all.sql.
-- Puts private.end_check_in back exactly as it was (manual check-ins end
-- quietly again), from the copy the migration saved.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $restore$
declare
  v_def text;
begin
  select definition into v_def from private.migration_backups
  where migration = '20261012200000' and kind = 'function';
  if v_def is null then
    raise exception 'The saved end_check_in is missing; stopping.';
  end if;
  execute v_def;
end
$restore$;

delete from supabase_migrations.schema_migrations where version = '20261012200000';

commit;
