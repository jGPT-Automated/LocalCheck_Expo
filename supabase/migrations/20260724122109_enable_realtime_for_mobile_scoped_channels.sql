-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- Mobile subscribes to scoped per-court channels (court:{id}) filtered on
-- check_ins.court_id, plus live updates for runs/matches/activity. Add those
-- tables to the supabase_realtime publication. REPLICA IDENTITY FULL on
-- check_ins so check-out (UPDATE setting checked_out_at) and DELETE payloads
-- still carry court_id for the server-side filter.
alter table public.check_ins replica identity full;
alter table public.run_participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.check_ins;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.activity_events;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.runs;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.run_participants;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.court_metrics;
exception when duplicate_object then null; end $$;

