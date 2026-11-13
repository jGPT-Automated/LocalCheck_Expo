-- Additional saved courts. The existing local court remains the default and
-- the only auto-check-in region; saving/viewing never changes that profile.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.saved_courts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, court_id)
);
alter table public.saved_courts enable row level security;
revoke all on public.saved_courts from public, anon, authenticated;
grant select on public.saved_courts to authenticated;
create policy saved_courts_owner on public.saved_courts for select to authenticated
using (user_id = (select auth.uid()));

create function public.my_saved_courts()
returns table (court_id uuid)
language sql stable security invoker set search_path = '' as $$
  select list.court_id from (
    select p.local_court_id as court_id, true as is_local, null::timestamptz as saved_at
    from public.profiles p where p.id = auth.uid() and p.local_court_id is not null
    union all
    select s.court_id, false, s.created_at from public.saved_courts s
    join public.profiles p on p.id = s.user_id
    where s.user_id = auth.uid() and (p.is_pro or p.account_tag = 'TEST')
      and s.court_id is distinct from p.local_court_id
  ) list order by list.is_local desc, list.saved_at, list.court_id
$$;
revoke all on function public.my_saved_courts() from public, anon;
grant execute on function public.my_saved_courts() to authenticated;

create function public.set_court_saved(p_court_id uuid, p_saved boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in to save a court'; end if;
  if p_saved is null then raise exception 'Choose whether to save the court'; end if;
  -- Serializes concurrent additions and subscription/profile changes.
  select * into strict v_profile from public.profiles where id = v_user for update;
  if not coalesce(v_profile.is_pro, false) and v_profile.account_tag is distinct from 'TEST' then
    raise exception 'LocalPlus is required to save more courts';
  end if;
  -- Inspect as the owner through the existing court visibility contract.
  if not exists (select 1 from public.courts c where c.id = p_court_id and not coalesce(c.is_archived, false))
    or (private.is_test_court(p_court_id) and not private.viewer_sees_test_data()) then
    raise exception 'Court not available';
  end if;
  if not p_saved then
    delete from public.saved_courts where user_id = v_user and court_id = p_court_id;
  elsif p_court_id is distinct from v_profile.local_court_id
    and not exists (select 1 from public.saved_courts where user_id = v_user and court_id = p_court_id) then
    select count(*) into v_count from (
      select court_id from public.saved_courts where user_id = v_user
      union select v_profile.local_court_id where v_profile.local_court_id is not null
    ) c;
    if v_count >= 5 then raise exception 'You can save up to 5 courts'; end if;
    insert into public.saved_courts(user_id, court_id) values (v_user, p_court_id);
  end if;
end
$$;
revoke all on function public.set_court_saved(uuid, boolean) from public, anon;
grant execute on function public.set_court_saved(uuid, boolean) to authenticated;

-- Old installed clients can still change their one local court. Preserve that
-- path and serialize with the same profile lock; never silently evict a save.
create function private.guard_saved_court_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.local_court_id is distinct from old.local_court_id
    and (new.is_pro or new.account_tag = 'TEST')
    and (select count(*) from (
      select court_id from public.saved_courts where user_id=new.id
      union select new.local_court_id where new.local_court_id is not null
    ) courts) > 5 then
    raise exception 'You can save up to 5 courts';
  end if;
  return new;
end
$$;
revoke all on function private.guard_saved_court_limit() from public, anon, authenticated;
create trigger guard_saved_court_limit before update of local_court_id on public.profiles
for each row execute function private.guard_saved_court_limit();

create function private.broadcast_saved_court_invalidation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.send_invalidation('user:' || coalesce(new.user_id, old.user_id)::text, 'saved_courts', tg_op);
  return coalesce(new, old);
end
$$;
revoke all on function private.broadcast_saved_court_invalidation() from public, anon, authenticated;
create trigger broadcast_saved_court_invalidation after insert or delete on public.saved_courts
for each row execute function private.broadcast_saved_court_invalidation();

notify pgrst, 'reload schema';
commit;
