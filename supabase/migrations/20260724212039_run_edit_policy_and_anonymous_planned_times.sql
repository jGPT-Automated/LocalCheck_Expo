-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- Organizer can edit their own run before it happens (title/time/size).
create policy runs_update_organizer on public.runs
  for update using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

-- Anonymous planned-visit times for a court/window: powers the schedule
-- heatmap intensity so friends-only/private plans still count toward how
-- busy a slot looks WITHOUT exposing who they are (identities stay behind
-- the planned_visits RLS the client reads separately).
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

