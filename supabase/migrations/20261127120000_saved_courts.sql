-- PR 93 / LocalList for LocalPlus. This entire file is the migration for review.
--
-- Apply-time writes: create saved_courts, one owner-read policy, three public
-- RPCs and one private helper. Snapshot four existing functions, then replace
-- their single-court guards. Refresh the PostgREST schema cache at commit.
-- No profile, subscription, saved-court row or check-in is seeded or rewritten.
--
-- Runtime changes: profiles.local_court_id remains the default. A paid player
-- (profiles.is_pro) or a TEST fixture can add up to five visible courts including
-- the default, change it, remove a non-default, or opt in separately per court.
-- New memberships start with auto check-in off. Existing defaults with no saved
-- preference preserve the original single-court behavior. Extra courts require
-- both entitlement and an explicit true preference for automatic arrival.
-- Removing a court or switching it off cancels its pending arrival. The new
-- Hide RPC cancels a pending arrival or removes the player's most recent auto
-- check-in at the specified court within three hours and its activity events.
--
-- Apply once as a single transaction. A missing dependency, conflicting object
-- or changed function anchor aborts the transaction. Review and verification
-- notes are in docs/runbooks/LOCALPLUS_SAVED_COURTS.md.
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

create function public.get_local_list()
returns table(court jsonb, is_default boolean, auto_check_in boolean)
language sql stable security invoker set search_path = '' as $$
  select to_jsonb(c), c.id is not distinct from p.local_court_id, s.auto_check_in
  from public.profiles p
  join public.courts_with_stats c on c.id = p.local_court_id or exists (
    select 1 from public.saved_courts m where m.user_id=p.id and m.court_id=c.id
      and (p.is_pro or p.account_tag='TEST'))
  left join public.saved_courts s on s.user_id=p.id and s.court_id=c.id
  where p.id=(select auth.uid()) and not c.is_archived
  order by 2 desc, s.added_at, c.id limit 5
$$;

create function public.update_local_list(p_action text, p_court_id uuid, p_enabled boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  player public.profiles%rowtype;
  member boolean;
  sport text;
begin
  select * into strict player from public.profiles where id=uid for update;
  if not coalesce(player.is_pro or player.account_tag='TEST',false) then
    raise exception 'LocalPlus is required.' using errcode='42501';
  end if;
  select c.sport_type into sport from public.courts c where c.id=p_court_id
    and not c.is_archived and (c.verification_status <> 'needs_review' or c.added_by=uid)
    and (not c.is_test or c.added_by=uid or private.viewer_sees_test_data());
  if not found then raise exception 'Court unavailable.'; end if;
  member := p_court_id is not distinct from player.local_court_id or exists (
    select 1 from public.saved_courts where user_id=uid and court_id=p_court_id);
  if p_action='add' then
    if member then return; end if;
    if (select count(*) from public.get_local_list()) >= 5 then
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
  select exists (select 1 from public.profiles p
    join public.courts c on c.id=cid and not c.is_archived
    left join public.saved_courts s on s.user_id=p.id and s.court_id=cid
    where p.id=uid and (not c.is_test or c.added_by=uid or p.account_tag in ('TEST','REVIEWER','FOUNDER'))
      and (c.verification_status <> 'needs_review' or c.added_by=uid)
      and ((p.local_court_id=cid and (not coalesce(p.is_pro or p.account_tag='TEST',false) or coalesce(s.auto_check_in,true)))
        or ((p.is_pro or p.account_tag='TEST') and s.auto_check_in)))
$$;
revoke all on function private.allows_auto_court(uuid,uuid) from public,anon,authenticated;

-- Anchor to the inspected production definitions; fail the migration on drift.
do $$
declare def text; anchor text;
begin
  def := pg_get_functiondef('public.auto_check_in_arrive(uuid)'::regprocedure);
  anchor := 'if v_local is distinct from p_court_id or v_name is null then';
  if strpos(def,anchor)=0 then raise exception 'Unexpected arrival guard'; end if;
  execute replace(def,anchor,'if not private.allows_auto_court(v_user_id,p_court_id) or v_name is null then');
  def := pg_get_functiondef('public.resume_auto_check_in(uuid)'::regprocedure);
  anchor := 'p.id = v_user_id and p.local_court_id = p_court_id';
  if strpos(def,anchor)=0 then raise exception 'Unexpected resume guard'; end if;
  execute replace(def,anchor,'p.id = v_user_id and private.allows_auto_court(v_user_id,p_court_id)');
end $$;

-- Serialize arrival consent with a concurrent opt-out. Recheck consent when the
-- delayed timer fires (including a subscription lapse during the five-minute hold).
do $$
declare def text; anchor text;
begin
  def := pg_get_functiondef('public.auto_check_in_arrive(uuid)'::regprocedure);
  anchor := 'where p.id = v_user_id;';
  if strpos(def,anchor)=0 then raise exception 'Unexpected arrival profile read'; end if;
  def := replace(def,anchor,'where p.id = v_user_id for update;');
  anchor := 'delete from private.auto_check_in_arrivals where user_id = v_user_id;';
  if strpos(def,anchor)=0 then raise exception 'Unexpected pending arrival cleanup'; end if;
  execute replace(def,anchor,'delete from private.auto_check_in_arrivals where user_id = v_user_id and court_id=p_court_id;');

  def := pg_get_functiondef('private.post_auto_check_in(uuid)'::regprocedure);
  anchor := 'delete from private.auto_check_in_arrivals where user_id = p_user_id;';
  if strpos(def,anchor)=0 then raise exception 'Unexpected delayed arrival function'; end if;
  execute replace(def,anchor,anchor || E'\n  if not private.allows_auto_court(p_user_id,v.court_id) then return ''not_local''; end if;');

  def := pg_get_functiondef('private.end_auto_check_in_on_court_change()'::regprocedure);
  anchor := 'if old.local_court_id is distinct from new.local_court_id then';
  if strpos(def,anchor)=0 then raise exception 'Unexpected default change trigger'; end if;
  def := replace(def,anchor,'if old.local_court_id is distinct from new.local_court_id
    and not private.allows_auto_court(new.id,old.local_court_id) then');
  anchor := 'delete from private.auto_check_in_arrivals where user_id = new.id;';
  if strpos(def,anchor)=0 then raise exception 'Unexpected default change cleanup'; end if;
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
