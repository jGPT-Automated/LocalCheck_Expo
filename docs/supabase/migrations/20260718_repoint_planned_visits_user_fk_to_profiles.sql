-- APPLIED 2026-07-18 via Supabase MCP apply_migration (Jesse go-ahead).
--
-- Why: planned_visits was created after the 2026-07-10
-- repoint_user_fks_to_profiles_for_postgrest_embeds migration and
-- reintroduced the auth.users FK. PostgREST therefore can't embed
-- profiles(...) on planned_visits, and every fetchPlannedVisits call fails
-- with "Could not find a relationship between 'planned_visits' and
-- 'profiles' in the schema cache" (swallowed by the service layer — the
-- Schedule tab's WHO'S PULLING UP silently shows nothing).

ALTER TABLE public.planned_visits
  DROP CONSTRAINT planned_visits_user_id_fkey;
ALTER TABLE public.planned_visits
  ADD CONSTRAINT planned_visits_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
