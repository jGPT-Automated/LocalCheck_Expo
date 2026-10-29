-- LocalPlus: five saved courts and per-court auto check-in. LocalLite keeps
-- profiles.local_court_id and its existing auto check-in semantics.
begin;

create table public.saved_courts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  -- NULL only for the inherited primary: keep the existing device opt-in.
  auto_check_in_enabled boolean default false,
  created_at timestamptz not null default now(),
  primary key (user_id, court_id)
);
alter table public.saved_courts enable row level security;
revoke all on public.saved_courts from public, anon, authenticated;
grant select on public.saved_courts to authenticated;
grant all on public.saved_courts to service_role;
create policy saved_courts_select_self on public.saved_courts for select
  to authenticated using (user_id = (select auth.uid()));

create function private.saved_courts_has_plus(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_pro or p.account_tag = 'TEST'
    from public.profiles p where p.id = p_user_id), false);
$$;
revoke all on function private.saved_courts_has_plus(uuid) from public, anon, authenticated;

create function private.can_read_saved_court(p_user_id uuid, p_court_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id=p_user_id
      and (private.saved_courts_has_plus(p_user_id) or p.local_court_id=p_court_id)
  );
$$;
revoke all on function private.can_read_saved_court(uuid,uuid) from public, anon;
grant execute on function private.can_read_saved_court(uuid,uuid) to authenticated;
alter policy saved_courts_select_self on public.saved_courts
  using (private.can_read_saved_court(user_id,court_id));

-- SQL-only helper called by privileged auto-check-in functions. Retains the
-- old single-primary rule for LocalLite, including older installed clients.
create function private.auto_check_in_court_allowed(p_user_id uuid, p_court_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.courts c on c.id = p_court_id
    where p.id = p_user_id and not c.is_archived
      and (c.verification_status <> 'needs_review' or c.added_by = p_user_id)
      and (not c.is_test or c.added_by = p_user_id or p.account_tag in ('TEST','REVIEWER','FOUNDER'))
      and (case when private.saved_courts_has_plus(p_user_id) then exists (
        select 1 from public.saved_courts s where s.user_id = p_user_id and s.court_id = p_court_id
          and (s.auto_check_in_enabled or (s.auto_check_in_enabled is null and p.local_court_id = p_court_id))
      ) else p.local_court_id = p_court_id end)
  );
$$;
revoke all on function private.auto_check_in_court_allowed(uuid,uuid) from public, anon, authenticated;

create function private.change_saved_court(p_court_id uuid, p_action text, p_auto boolean default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_primary uuid;
  v_next uuid;
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  -- Serializes duplicate and concurrent sixth additions for this account.
  select local_court_id into v_primary from public.profiles where id=v_user for update;
  if not private.saved_courts_has_plus(v_user) then
    raise exception 'LocalPlus' using errcode='42501';
  end if;
  if p_action = 'save' then
    if not exists (select 1 from public.courts c where c.id=p_court_id and not c.is_archived
      and (c.verification_status <> 'needs_review' or c.added_by=v_user)
      and (not c.is_test or c.added_by=v_user or exists(select 1 from public.profiles p where p.id=v_user and p.account_tag in ('TEST','REVIEWER','FOUNDER')))) then
      raise exception 'Court not found' using errcode='42501';
    end if;
    if exists(select 1 from public.saved_courts where user_id=v_user and court_id=p_court_id) then return true; end if;
    if (select count(*) from public.saved_courts where user_id=v_user) >= 5 then
      raise exception 'LocalPlus: up to 5 courts' using errcode='23514';
    end if;
    insert into public.saved_courts(user_id,court_id,auto_check_in_enabled) values(v_user,p_court_id,false);
    if v_primary is null then
      update public.profiles set local_court_id=p_court_id where id=v_user;
    end if;
  elsif p_action = 'auto' then
    if p_auto is null then raise exception 'AUTO CHECK-IN' using errcode='22004'; end if;
    update public.saved_courts set auto_check_in_enabled=p_auto where user_id=v_user and court_id=p_court_id;
    if not found then raise exception 'Court not found' using errcode='42501'; end if;
    if not p_auto then delete from private.auto_check_in_arrivals where user_id=v_user and court_id=p_court_id; end if;
  elsif p_action = 'remove' then
    delete from public.saved_courts where user_id=v_user and court_id=p_court_id;
    if v_primary = p_court_id then
      select court_id into v_next from public.saved_courts where user_id=v_user order by created_at,court_id limit 1;
      update public.profiles set local_court_id=v_next where id=v_user;
    end if;
    delete from private.auto_check_in_arrivals where user_id=v_user and court_id=p_court_id;
    update public.check_ins set checked_out_at=now() where user_id=v_user and court_id=p_court_id and source='auto' and checked_out_at is null;
  else
    raise exception 'Invalid action' using errcode='22023';
  end if;
  return true;
end $$;
revoke all on function private.change_saved_court(uuid,text,boolean) from public, anon;
grant execute on function private.change_saved_court(uuid,text,boolean) to authenticated;

-- Resolve legacy device opt-in once. Compare-and-set prevents an automatic
-- migration from overwriting a concurrent explicit Settings choice.
create function private.resolve_saved_court_auto_check_in(p_court_id uuid,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_enabled boolean;
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  perform 1 from public.profiles where id=v_user for update;
  if not private.saved_courts_has_plus(v_user) then raise exception 'LocalPlus' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'AUTO CHECK-IN' using errcode='22004'; end if;
  update public.saved_courts set auto_check_in_enabled=p_enabled
    where user_id=v_user and court_id=p_court_id and auto_check_in_enabled is null;
  select auto_check_in_enabled into v_enabled from public.saved_courts where user_id=v_user and court_id=p_court_id;
  if not found then raise exception 'Court not found' using errcode='42501'; end if;
  return v_enabled;
end $$;
revoke all on function private.resolve_saved_court_auto_check_in(uuid,boolean) from public,anon;
grant execute on function private.resolve_saved_court_auto_check_in(uuid,boolean) to authenticated;
create function public.resolve_saved_court_auto_check_in(p_court_id uuid,p_enabled boolean)
returns boolean language sql security invoker set search_path='' as $$ select private.resolve_saved_court_auto_check_in(p_court_id,p_enabled); $$;
revoke all on function public.resolve_saved_court_auto_check_in(uuid,boolean) from public,anon;
grant execute on function public.resolve_saved_court_auto_check_in(uuid,boolean) to authenticated;

create function public.save_court(p_court_id uuid) returns boolean
language sql security invoker set search_path='' as $$ select private.change_saved_court(p_court_id,'save'); $$;
create function public.remove_saved_court(p_court_id uuid) returns boolean
language sql security invoker set search_path='' as $$ select private.change_saved_court(p_court_id,'remove'); $$;
create function public.set_saved_court_auto_check_in(p_court_id uuid,p_enabled boolean) returns boolean
language sql security invoker set search_path='' as $$ select private.change_saved_court(p_court_id,'auto',p_enabled); $$;
revoke all on function public.save_court(uuid),public.remove_saved_court(uuid),public.set_saved_court_auto_check_in(uuid,boolean) from public, anon;
grant execute on function public.save_court(uuid),public.remove_saved_court(uuid),public.set_saved_court_auto_check_in(uuid,boolean) to authenticated;

create function private.mirror_primary_saved_court() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.local_court_id is null then return new; end if;
  if not private.saved_courts_has_plus(new.id) then
    -- A free player changing their primary still has exactly one court.
    delete from public.saved_courts where user_id=new.id and court_id<>new.local_court_id;
  elsif not exists(select 1 from public.saved_courts where user_id=new.id and court_id=new.local_court_id)
    and (select count(*) from public.saved_courts where user_id=new.id)>=5 then
    -- Legacy installed clients can still change primary. Replace their old
    -- primary at the cap rather than making a sixth entry.
    delete from public.saved_courts where user_id=new.id and court_id=(
      select court_id from public.saved_courts where user_id=new.id
      order by (court_id=old.local_court_id) desc nulls last,created_at,court_id limit 1
    );
  end if;
  insert into public.saved_courts(user_id,court_id,auto_check_in_enabled)
    values(new.id,new.local_court_id,null) on conflict do nothing;
  return new;
end $$;
revoke all on function private.mirror_primary_saved_court() from public, anon, authenticated;
create trigger mirror_primary_saved_court after insert or update of local_court_id on public.profiles
  for each row execute function private.mirror_primary_saved_court();
insert into public.saved_courts(user_id,court_id,auto_check_in_enabled)
  select id,local_court_id,null from public.profiles where local_court_id is not null;

create function private.broadcast_saved_court_invalidation() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
  if tg_op='DELETE' then v_user:=old.user_id; else v_user:=new.user_id; end if;
  perform private.send_invalidation('user:'||v_user::text,'saved_courts',tg_op);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.broadcast_saved_court_invalidation() from public, anon, authenticated;
create trigger broadcast_saved_court_invalidation after insert or update or delete on public.saved_courts
  for each row execute function private.broadcast_saved_court_invalidation();

-- Patch the inspected live bodies at exact anchors. Refuse schema drift;
-- preserve all existing timer, arrival, friend-alert and notification logic.
do $patch$
declare v_def text; v_anchor text;
begin
  v_def := pg_get_functiondef('public.auto_check_in_arrive(uuid)'::regprocedure);
  v_anchor := 'if v_local is distinct from p_court_id or v_name is null then';
  if position(v_anchor in v_def)=0 then raise exception 'auto_check_in_arrive anchor changed'; end if;
  execute replace(v_def,v_anchor,'if not private.auto_check_in_court_allowed(v_user_id, p_court_id) or v_name is null then');

  v_def := pg_get_functiondef('public.resume_auto_check_in(uuid)'::regprocedure);
  v_anchor := 'where p.id = v_user_id and p.local_court_id = p_court_id';
  if position(v_anchor in v_def)=0 then raise exception 'resume_auto_check_in anchor changed'; end if;
  execute replace(v_def,v_anchor,'where p.id = v_user_id and private.auto_check_in_court_allowed(v_user_id, p_court_id)');

  v_def := pg_get_functiondef('private.post_auto_check_in(uuid)'::regprocedure);
  v_anchor := '-- Same court, still checked in: nothing to post.';
  if position(v_anchor in v_def)=0 then raise exception 'post_auto_check_in anchor changed'; end if;
  execute replace(v_def,v_anchor,$guard$
  if not private.auto_check_in_court_allowed(p_user_id, v.court_id) then
    return 'not_local';
  end if;
  -- Same court, still checked in: nothing to post.
$guard$);
end $patch$;
commit;
