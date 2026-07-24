-- Records the live supabase_realtime publication membership on LocalCheckProd
-- (qkrnmyexzvaxiqfxwwfb) as of 2026-07-24, so the tables the client's
-- realtime channels depend on (runs, run_participants, check_ins,
-- activity_events, planned_visits) exist in version control and can be
-- re-applied to a fresh environment. Verified live the same day:
--   activity_events, check_ins, court_metrics, matches, planned_visits,
--   run_participants, runs
-- Idempotent: adding a table that is already a member raises a duplicate
-- error, so each add is guarded.
do $$
declare
  t text;
begin
  foreach t in array array[
    'activity_events', 'check_ins', 'court_metrics', 'matches',
    'planned_visits', 'run_participants', 'runs'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
