-- Applied to LocalCheckProd (qkrnmyexzvaxiqfxwwfb) on 2026-07-24.
--
-- 1) Organizer can edit their own run before it happens (run detail EDIT RUN).
-- 2) Anonymous planned-visit times for a court/window: powers the Schedule
--    heatmap intensity so friends-only/private "My Times" still count toward how
--    busy a slot looks WITHOUT exposing who they are. Identities stay behind the
--    planned_visits row-level-security the client reads separately; this RPC
--    returns bare timestamps only.

create policy runs_update_organizer on public.runs
  for update using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

create or replace function public.court_planned_times(
  p_court_id uuid, p_from timestamptz, p_to timestamptz
) returns setof timestamptz
language sql security definer stable
set search_path = public
as $$
  select planned_at from public.planned_visits
  where court_id = p_court_id and planned_at >= p_from and planned_at < p_to;
$$;
revoke all on function public.court_planned_times(uuid, timestamptz, timestamptz) from anon, public;
grant execute on function public.court_planned_times(uuid, timestamptz, timestamptz) to authenticated;
