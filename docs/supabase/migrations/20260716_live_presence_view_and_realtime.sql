-- Applied 2026-07-16 via Supabase MCP (migration: live_presence_view_and_realtime)
-- 1) courts_with_stats: active_check_in_count now uses the same 45-minute
--    freshness rule as client rosters (one authoritative "active" definition),
--    and the view runs as security_invoker (advisor fix).
-- 2) Realtime publication on check_ins + profiles for live presence.

create or replace view public.courts_with_stats
with (security_invoker = true) as
select
  c.id, c.name, c.address, c.latitude, c.longitude, c.sport_type,
  c.added_by, c.image_url, c.verification_threshold, c.is_archived,
  c.created_at, c.updated_at, c.location, c.state,
  coalesce(stats.local_player_count, 0) as local_player_count,
  (coalesce(stats.local_player_count, 0) >= c.verification_threshold) as is_confirmed,
  coalesce(ci.active_check_in_count, 0) as active_check_in_count,
  coalesce(ci.total_check_ins, 0) as total_check_ins
from courts c
left join lateral (
  select count(*)::integer as local_player_count
  from profiles p
  where p.local_court_id = c.id
) stats on true
left join lateral (
  select
    (count(*) filter (
      where ci2.checked_out_at is null
        and ci2.checked_in_at > now() - interval '45 minutes'
    ))::integer as active_check_in_count,
    count(*)::integer as total_check_ins
  from check_ins ci2
  where ci2.court_id = c.id
) ci on true;

alter publication supabase_realtime add table public.check_ins;
alter publication supabase_realtime add table public.profiles;
