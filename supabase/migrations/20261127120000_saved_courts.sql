-- PR 93: LocalPlus saved courts. Review alongside docs/runbooks/LOCALPLUS_SAVED_COURTS.md.
-- Installation starts with an empty list table and saves four function definitions.
-- Each player's existing profile default still works without a saved-court row.
-- The list, the write limit and automatic arrivals all use the same five visible courts.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into private.migration_backups (migration, kind, name, definition)
select '20261127120000', 'function', fn.signature, pg_get_functiondef(fn.signature::regprocedure)
from (values
  ('public.auto_check_in_arrive(uuid)'),
  ('public.resume_auto_check_in(uuid)'),
  ('private.post_auto_check_in(uuid)'),
  ('private.end_auto_check_in_on_court_change()')
) as fn(signature);

create table public.saved_courts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  auto_check_in boolean,
  added_at timestamptz not null default now(),
  primary key (user_id, court_id)
);
alter table public.saved_courts enable row level security;
revoke all on public.saved_courts from public, anon, authenticated;
grant select on public.saved_courts to authenticated;
create policy read_own_saved_courts on public.saved_courts for select to authenticated
  using (user_id = (select auth.uid()));

create index saved_courts_court_id_idx on public.saved_courts(court_id);

-- Same court visibility rules as the court read policies, also usable by timers
-- that run for a player without an auth session.
create function private.local_list_court_visible(c public.courts, p public.profiles)
returns boolean language sql immutable set search_path = '' as $$
  select not c.is_archived
    and (c.verification_status <> 'needs_review' or c.added_by = p.id)
    and (not c.is_test or c.added_by = p.id or p.account_tag in ('TEST','REVIEWER','FOUNDER'))
$$;

-- Only trusted routines may select this list for an arbitrary user.
create function private.local_list_for(p_user_id uuid)
returns table(court_id uuid, is_default boolean, auto_check_in boolean, added_at timestamptz)
language sql stable set search_path = '' as $$
  select c.id, c.id is not distinct from p.local_court_id, s.auto_check_in, s.added_at
  from public.profiles p
  cross join lateral (
    select p.local_court_id as id where p.local_court_id is not null
    union all
    select m.court_id from public.saved_courts m where m.user_id = p.id
      and m.court_id is distinct from p.local_court_id
      and (p.is_pro or p.account_tag = 'TEST')
  ) ids
  join public.courts c on c.id = ids.id
  left join public.saved_courts s on s.user_id = p.id and s.court_id = c.id
  where p.id = p_user_id and private.local_list_court_visible(c, p)
  order by 2 desc, s.added_at, c.id limit 5
$$;
revoke all on function private.local_list_for(uuid),
  private.local_list_court_visible(public.courts,public.profiles) from public,anon,authenticated;

-- Keep the stats view under the reader's RLS, while the timer and reader use
-- precisely the same membership rules. This wrapper accepts no user ID.
create function private.my_local_list()
returns table(court_id uuid, is_default boolean, auto_check_in boolean, added_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from private.local_list_for((select auth.uid()))
$$;
revoke all on function private.my_local_list() from public,anon;
grant execute on function private.my_local_list() to authenticated;

create function public.get_local_list()
returns table(court jsonb, is_default boolean, auto_check_in boolean)
language sql stable security invoker set search_path = '' as $$
  select to_jsonb(c), l.is_default, l.auto_check_in
  from private.my_local_list() l join public.courts_with_stats c on c.id = l.court_id
  order by l.is_default desc, l.added_at, c.id
$$;

-- Older builds change the profile directly. Keep the existing default on a
-- full LocalPlus list when an older build asks for a sixth court.
create function private.guard_local_list_default() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) = 5 and not bool_or(l.court_id = new.local_court_id)
      from private.local_list_for(old.id) l) then
    raise exception 'You can add up to 5 courts to LocalList. Remove a court first.';
  end if;
  return new;
end $$;
revoke all on function private.guard_local_list_default() from public,anon,authenticated;
create trigger guard_local_list_default before update of local_court_id on public.profiles
for each row when (old.local_court_id is distinct from new.local_court_id
  and new.local_court_id is not null and (new.is_pro or new.account_tag = 'TEST'))
execute function private.guard_local_list_default();

create function public.update_local_list(p_action text, p_court_id uuid, p_enabled boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  player public.profiles%rowtype;
  member boolean;
  sport text;
begin
  if uid is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into strict player from public.profiles where id=uid for update;
  if not coalesce(player.is_pro or player.account_tag='TEST',false)
    and not coalesce(p_action='auto' and p_court_id=player.local_court_id and p_enabled is not null, false) then
    raise exception 'LocalPlus is required.' using errcode='42501';
  end if;
  select c.sport_type into sport from public.courts c where c.id=p_court_id
    and private.local_list_court_visible(c, player);
  if not found then raise exception 'Court unavailable.'; end if;
  member := exists (select 1 from private.local_list_for(uid) where court_id=p_court_id);
  if p_action='add' then
    if member then return; end if;
    if (select count(*) from private.local_list_for(uid)) >= 5 then
      raise exception 'You can add up to 5 courts to LocalList.';
    end if;
    insert into public.saved_courts(user_id,court_id,auto_check_in) values(uid,p_court_id,false);
    if player.local_court_id is null then
      update public.profiles set local_court_id=p_court_id, preferred_sport=sport where id=uid;
    end if;
  elsif p_action='remove' then
    if player.local_court_id=p_court_id then raise exception 'Choose another default court first.'; end if;
    delete from public.saved_courts where user_id=uid and court_id=p_court_id;
  elsif not member then raise exception 'Add this court to LocalList first.';
  elsif p_action='default' then
    if player.local_court_id=p_court_id then return; end if;
    if player.local_court_id is not null then
      insert into public.saved_courts(user_id,court_id,auto_check_in)
        values(uid,player.local_court_id,false) on conflict do nothing;
    end if;
    update public.profiles set local_court_id=p_court_id, preferred_sport=sport where id=uid;
  elsif p_action='auto' and p_enabled is not null then
    insert into public.saved_courts(user_id,court_id,auto_check_in) values(uid,p_court_id,p_enabled)
      on conflict(user_id,court_id) do update set auto_check_in=excluded.auto_check_in;
  else raise exception 'Invalid LocalList action.';
  end if;
  if p_action='remove' or (p_action='auto' and not p_enabled) then
    delete from private.auto_check_in_arrivals where user_id=uid and court_id=p_court_id;
  end if;
end $$;
revoke all on function public.get_local_list(), public.update_local_list(text,uuid,boolean) from public,anon;
grant execute on function public.get_local_list(), public.update_local_list(text,uuid,boolean) to authenticated;

-- The default remains compatible with the original single-court clients.
-- Additional regions require both an active entitlement and explicit opt-in.
create function private.allows_auto_court(uid uuid, cid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from private.local_list_for(uid) l
    where l.court_id = cid and coalesce(l.auto_check_in, l.is_default))
$$;
revoke all on function private.allows_auto_court(uuid,uuid) from public,anon,authenticated;

-- Anchor to the inspected production definitions; fail the migration on drift.
do $$
declare def text; anchor text;
begin
  def := pg_get_functiondef('public.auto_check_in_arrive(uuid)'::regprocedure);
  anchor := 'if v_local is distinct from p_court_id or v_name is null then';
  if cardinality(string_to_array(def,anchor)) <> 2 then raise exception 'Unexpected arrival guard'; end if;
  execute replace(def,anchor,'if not private.allows_auto_court(v_user_id,p_court_id) or v_name is null then');
  def := pg_get_functiondef('public.resume_auto_check_in(uuid)'::regprocedure);
  anchor := 'p.id = v_user_id and p.local_court_id = p_court_id';
  if cardinality(string_to_array(def,anchor)) <> 2 then raise exception 'Unexpected resume guard'; end if;
  execute replace(def,anchor,'p.id = v_user_id and private.allows_auto_court(v_user_id,p_court_id)');
end $$;

-- Serialize arrival consent with a concurrent opt-out. Recheck consent when the
-- delayed timer fires (including a subscription lapse during the five-minute hold).
do $$
declare def text; anchor text;
begin
  def := pg_get_functiondef('public.auto_check_in_arrive(uuid)'::regprocedure);
  anchor := 'where p.id = v_user_id;';
  if cardinality(string_to_array(def,anchor)) <> 2 then raise exception 'Unexpected arrival profile read'; end if;
  def := replace(def,anchor,'where p.id = v_user_id for update;');
  anchor := 'delete from private.auto_check_in_arrivals where user_id = v_user_id;';
  if cardinality(string_to_array(def,anchor)) <> 2 then raise exception 'Unexpected pending arrival cleanup'; end if;
  execute replace(def,anchor,'delete from private.auto_check_in_arrivals where user_id = v_user_id and court_id=p_court_id;');

  def := pg_get_functiondef('private.post_auto_check_in(uuid)'::regprocedure);
  anchor := 'delete from private.auto_check_in_arrivals where user_id = p_user_id;';
  if cardinality(string_to_array(def,anchor)) <> 2 then raise exception 'Unexpected delayed arrival function'; end if;
  execute replace(def,anchor,anchor || E'\n  if not private.allows_auto_court(p_user_id,v.court_id) then return ''not_local''; end if;');

  def := pg_get_functiondef('private.end_auto_check_in_on_court_change()'::regprocedure);
  anchor := 'if old.local_court_id is distinct from new.local_court_id then';
  if cardinality(string_to_array(def,anchor)) <> 2 then raise exception 'Unexpected default change trigger'; end if;
  def := replace(def,anchor,'if old.local_court_id is distinct from new.local_court_id
    and not private.allows_auto_court(new.id,old.local_court_id) then');
  anchor := 'delete from private.auto_check_in_arrivals where user_id = new.id;';
  if cardinality(string_to_array(def,anchor)) <> 2 then raise exception 'Unexpected default change cleanup'; end if;
  execute replace(def,anchor,'delete from private.auto_check_in_arrivals where user_id=new.id and court_id=old.local_court_id;');
end $$;

-- A Hide action on a delayed notification must never undo another court.
create function public.undo_auto_check_in_at(p_court_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); visit uuid;
begin
  if uid is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  delete from private.auto_check_in_arrivals where user_id=uid and court_id=p_court_id;
  if found then return true; end if;
  select id into visit from public.check_ins where user_id=uid and court_id=p_court_id
    and source='auto' and checked_in_at > now()-interval '3 hours'
    order by checked_in_at desc limit 1 for update;
  if visit is null then return false; end if;
  delete from public.activity_events where check_in_id=visit;
  delete from public.check_ins where id=visit;
  return true;
end $$;
revoke all on function public.undo_auto_check_in_at(uuid) from public,anon;
grant execute on function public.undo_auto_check_in_at(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
