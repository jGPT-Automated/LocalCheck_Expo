-- Persistent profile visibility — one setting that governs check-ins,
-- scheduled times, and the leaderboard.
--
--   public   everything visible
--   friends  check-ins / schedule / leaderboard rank visible to friends only
--   private  hidden everywhere; also removed from every leaderboard scope
--
-- Until now "visibility" only lived on the active check-in row and reset to
-- 'public' whenever the user wasn't checked in, so the leaderboard couldn't
-- honour it. check_ins.visibility stays as the per-check-in value; this is the
-- identity-level default the app reads and writes.
--
-- Forward-only, additive. Backfills each user's last non-public check-in
-- choice so nobody's privacy silently loosens.

begin;

alter table public.profiles
  add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'friends', 'private'));

-- Carry forward anyone who had set friends/private on their most recent check-in.
update public.profiles p
set visibility = last_ci.visibility
from (
  select distinct on (user_id) user_id, visibility
  from public.check_ins
  order by user_id, checked_in_at desc
) last_ci
where last_ci.user_id = p.id
  and last_ci.visibility in ('friends', 'private')
  and p.visibility = 'public';

-- The client persists this itself (Settings → Privacy); every other profile
-- column the app writes is granted the same way.
grant update (visibility) on public.profiles to authenticated;

commit;
