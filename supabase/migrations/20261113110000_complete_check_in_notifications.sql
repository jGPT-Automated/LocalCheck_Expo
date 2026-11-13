-- Complete own-event log and delayed manual friend notices. Source only until
-- deliberately applied; no historical audience is inferred or backfilled.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Reuse the installed clients' own-notice types (auto_check_in/out); the
-- explicit source field distinguishes manual events without breaking build 46.
alter table private.timers drop constraint timers_kind_check;
alter table private.timers add constraint timers_kind_check check (kind in (
  'challenge_expiry','challenge_reminder','auto_check_in_post','check_in_end','match_due','manual_check_in_notice'
));

create function private.record_check_in_notice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if current_setting('localcheck.suppress_activity', true) = 'on' then return new; end if;
  select coalesce(nullif(c.short_name,''),c.name) into v_name from public.courts c where c.id=new.court_id;
  if tg_op = 'INSERT' and new.source = 'manual' then
    insert into public.notifications(user_id,type,title,body,data,dedupe_key,push_status,created_at)
    values(new.user_id,'auto_check_in','Checked in',left('You''re at ' || v_name || '.',240),
      jsonb_build_object('path','/court/' || new.court_id,'court_id',new.court_id,'visibility',new.visibility,'source',new.source),
      'own_check_in:' || new.id,'skipped',new.checked_in_at) on conflict(dedupe_key) do nothing;
    perform private.schedule_timer('manual_check_in_notice',new.id,new.checked_in_at + interval '1 minute');
  elsif tg_op = 'UPDATE' and old.checked_out_at is null and new.checked_out_at is not null
    and coalesce(current_setting('localcheck.checkout_notice', true),'') <> 'timer' then
    insert into public.notifications(user_id,type,title,body,data,dedupe_key,push_status,created_at)
    values(new.user_id,'auto_check_out','Checked out',left('You left ' || v_name || '.',240),
      jsonb_build_object('path','/court/' || new.court_id,'court_id',new.court_id,'visibility',new.visibility,'source',new.source),
      'own_check_out:' || new.id,'skipped',new.checked_out_at) on conflict(dedupe_key) do nothing;
  end if;
  return new;
end
$$;
revoke all on function private.record_check_in_notice() from public, anon, authenticated;
create trigger record_check_in_notice after insert or update of checked_out_at on public.check_ins
for each row execute function private.record_check_in_notice();

create function private.notify_manual_check_in(p_check_in_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.check_ins; v_name text; v_court text;
begin
  select * into v from public.check_ins where id=p_check_in_id for update;
  if not found or v.source <> 'manual' or v.checked_out_at is not null then return 'nothing to do'; end if;
  if v.checked_in_at + interval '1 minute' > now() then return 'not due yet'; end if;
  if v.visibility = 'private' then return 'private'; end if;
  select coalesce(nullif(p.display_name,''),p.username,'A friend') into v_name
  from public.profiles p where p.id=v.user_id and p.share_auto_check_ins;
  if not found then return 'sharing off'; end if;
  select coalesce(nullif(c.short_name,''),c.name) into v_court from public.courts c where c.id=v.court_id;
  insert into public.notifications(user_id,type,actor_id,title,body,data,dedupe_key)
  select fp.id,'friend_check_in',v.user_id,'A friend just checked in',left(v_name || ' is at ' || v_court,240),
    jsonb_build_object('path','/court/' || v.court_id,'court_id',v.court_id,'source','manual'),
    'friend_check_in:' || v.id || ':' || fp.id
  from public.friendships f
  join public.profiles fp on fp.id=case when f.requester_id=v.user_id then f.addressee_id else f.requester_id end
  where f.status='accepted' and (f.requester_id=v.user_id or f.addressee_id=v.user_id)
    and fp.notify_friend_check_ins and not private.users_are_blocked(v.user_id,fp.id)
    and (not private.is_hidden_account(v.user_id) or fp.account_tag in ('TEST','REVIEWER','FOUNDER'))
    and not exists(select 1 from public.notifications n where n.user_id=fp.id and n.actor_id=v.user_id
      and n.type='friend_check_in' and n.created_at>now()-interval '2 hours')
  on conflict(dedupe_key) do nothing;
  return 'notified';
end
$$;
revoke all on function private.notify_manual_check_in(uuid) from public, anon, authenticated;

-- Enrich only newly generated automatic own notices. Historical rows stay as
-- recorded. The check-in row owns the privacy/source snapshot, not today's profile.
create function private.snapshot_check_in_notice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.check_ins; v_id text;
begin
  if new.type not in ('auto_check_in','auto_check_out') then return new; end if;
  v_id := split_part(new.dedupe_key,':',2);
  if v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v from public.check_ins where id=v_id::uuid and user_id=new.user_id;
    if found then new.data := coalesce(new.data,'{}'::jsonb) || jsonb_build_object('visibility',v.visibility,'source',v.source); end if;
  end if;
  return new;
end
$$;
revoke all on function private.snapshot_check_in_notice() from public, anon, authenticated;
create trigger snapshot_check_in_notice before insert on public.notifications
for each row execute function private.snapshot_check_in_notice();

do $$
declare v_def text; v_anchor text;
begin
  v_def := pg_get_functiondef('private.run_timer(uuid)'::regprocedure);
  v_anchor := 'when ''check_in_end'' then private.end_check_in(v_timer.ref_id)';
  if position(v_anchor in v_def)=0 then raise exception 'run_timer anchor drifted'; end if;
  execute replace(v_def,v_anchor,v_anchor || E'\n    when ''manual_check_in_notice'' then private.notify_manual_check_in(v_timer.ref_id)');
  v_def := pg_get_functiondef('private.end_check_in(uuid)'::regprocedure);
  v_anchor := 'update public.check_ins';
  if position(v_anchor in v_def)=0 then raise exception 'end_check_in anchor drifted'; end if;
  execute replace(v_def,v_anchor,'perform set_config(''localcheck.checkout_notice'',''timer'',true);' || E'\n  ' || v_anchor);
  -- Reset the flag as soon as the update's triggers have completed.
  v_def := pg_get_functiondef('private.end_check_in(uuid)'::regprocedure);
  v_anchor := 'where id = p_check_in_id;';
  if position(v_anchor in v_def)=0 then raise exception 'end_check_in reset anchor drifted'; end if;
  execute replace(v_def,v_anchor,v_anchor || E'\n  perform set_config(''localcheck.checkout_notice'','''',true);');
end
$$;
notify pgrst, 'reload schema';
commit;
