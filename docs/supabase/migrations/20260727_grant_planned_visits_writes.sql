-- 2026-07-27 — Restore planned_visits write privileges for authenticated users.
--
-- Root cause of "Save my times" failing in the Schedule heatmap:
--
--   planned_visits grants to `authenticated` were SELECT, DELETE only.
--   The row-level policies planned_visits_insert_self and
--   planned_visits_update_self already existed and were correct, but RLS only
--   filters rows *within* privileges the role already holds. Without
--   GRANT INSERT/UPDATE, Postgres rejects the write at the privilege layer with
--   42501 (permission denied for table planned_visits) before any policy runs.
--
--   Because DELETE *was* granted, removals succeeded while additions failed.
--   The client's batch save therefore reported a partial failure on every edit
--   and zero rows were ever written (table held 2 rows, newest 2026-07-23).
--
-- 20260713_planned_visits.sql created the table and its policies but never
-- issued the corresponding grants. This migration closes that gap only; it adds
-- no new policy and widens no row-level access.
--
-- Security note: the effective access is still exactly what the existing
-- policies allow — a user may only insert/update rows where
-- user_id = auth.uid(). Verify with the assertions at the bottom.

grant insert, update on public.planned_visits to authenticated;

-- activity_events is written only by the SECURITY DEFINER trigger
-- private.project_planned_visit_activity(), so `authenticated` intentionally
-- keeps SELECT-only access here. Do not grant writes on it.

do $$
begin
  if not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'planned_visits'
      and grantee = 'authenticated'
      and privilege_type = 'INSERT'
  ) then
    raise exception 'planned_visits INSERT grant to authenticated was not applied';
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.planned_visits'::regclass
      and polname = 'planned_visits_insert_self'
  ) then
    raise exception 'planned_visits_insert_self policy is missing; refusing to leave writes ungoverned';
  end if;
end
$$;
