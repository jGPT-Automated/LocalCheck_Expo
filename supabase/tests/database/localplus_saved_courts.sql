-- Run in an isolated PostgreSQL fixture or an authorized rolled-back test.
-- Fixture UUIDs refer only to synthetic users/courts; never insert real test
-- users into production just to run this file.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
  if (select count(*) from public.saved_courts) <> 1 then raise exception 'primary not seeded / owner RLS'; end if;
end $$;
-- The automatic legacy migration may not overwrite an explicit setting.
select public.resolve_saved_court_auto_check_in('00000000-0000-4000-8000-000000000001',false);
select public.set_saved_court_auto_check_in('00000000-0000-4000-8000-000000000001',true);
do $$ begin
  if not public.resolve_saved_court_auto_check_in('00000000-0000-4000-8000-000000000001',false) then raise exception 'legacy resolution overwrote explicit opt-in'; end if;
end $$;
select public.save_court('00000000-0000-4000-8000-000000000002');
select public.save_court('00000000-0000-4000-8000-000000000002');
select public.save_court('00000000-0000-4000-8000-000000000003');
select public.save_court('00000000-0000-4000-8000-000000000004');
select public.save_court('00000000-0000-4000-8000-000000000005');
do $$ begin
  if (select count(*) from saved_courts) <> 5 then raise exception 'duplicate/cap broken'; end if;
  begin
    perform public.save_court('00000000-0000-4000-8000-000000000006');
    raise exception 'sixth add allowed';
  exception when check_violation then null; end;
  begin
    perform public.save_court('00000000-0000-4000-8000-000000000009');
    raise exception 'hidden test court allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into saved_courts(user_id,court_id) values(auth.uid(),'00000000-0000-4000-8000-000000000007');
    raise exception 'direct write allowed';
  exception when insufficient_privilege then null; end;
end $$;
select public.set_saved_court_auto_check_in('00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if not (select auto_check_in_enabled from saved_courts where court_id='00000000-0000-4000-8000-000000000002') then raise exception 'toggle not saved'; end if;
end $$;
do $$ begin
  if (public.auto_check_in_arrive('00000000-0000-4000-8000-000000000002')->>'status') <> 'pending' then raise exception 'enabled paid arrival denied'; end if;
  if public.resume_auto_check_in('00000000-0000-4000-8000-000000000003') <> 'not_local' then raise exception 'disabled paid resume allowed'; end if;
end $$;
select public.set_saved_court_auto_check_in('00000000-0000-4000-8000-000000000002',false);
reset role;
do $$ begin
  if exists(select 1 from private.auto_check_in_arrivals where user_id='11111111-1111-4111-8111-111111111111') then raise exception 'disable kept pending arrival'; end if;
end $$;
insert into private.auto_check_in_arrivals(user_id,court_id,arrived_at) values('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000002',now()-interval '6 minutes');
do $$ begin
  if private.post_auto_check_in('11111111-1111-4111-8111-111111111111') <> 'not_local' then raise exception 'disabled queued arrival posted'; end if;
end $$;
set local role authenticated;
select public.set_saved_court_auto_check_in('00000000-0000-4000-8000-000000000002',true);
select public.remove_saved_court('00000000-0000-4000-8000-000000000001');
do $$ begin
  if (select count(*) from saved_courts) <> 4 then raise exception 'remove broken'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
  if (select count(*) from saved_courts) <> 1 then raise exception 'another user can read list'; end if;
  begin
    perform public.save_court('00000000-0000-4000-8000-000000000002');
    raise exception 'free account can add court';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_saved_court_auto_check_in('00000000-0000-4000-8000-000000000001',true);
    raise exception 'free account can use paid toggle';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if not private.auto_check_in_court_allowed('22222222-2222-4222-8222-222222222222','00000000-0000-4000-8000-000000000001') then raise exception 'free primary auto changed'; end if;
  if private.auto_check_in_court_allowed('22222222-2222-4222-8222-222222222222','00000000-0000-4000-8000-000000000002') then raise exception 'free non-primary auto allowed'; end if;
  if not private.auto_check_in_court_allowed('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000002') then raise exception 'paid enabled court denied'; end if;
  if private.auto_check_in_court_allowed('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000003') then raise exception 'paid disabled court allowed'; end if;
end $$;
-- A court becoming moderated is no longer eligible even if previously saved.
update public.courts set verification_status='needs_review' where id='00000000-0000-4000-8000-000000000002';
do $$ begin
  if private.auto_check_in_court_allowed('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000002') then raise exception 'moderated court remained eligible'; end if;
end $$;
-- An inaccessible court remains visible as a removable owner membership;
-- its metadata stays hidden by the existing court RLS.
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
  if not exists(select 1 from saved_courts where court_id='00000000-0000-4000-8000-000000000002') then raise exception 'unavailable membership disappeared'; end if;
  if exists(select 1 from courts where id='00000000-0000-4000-8000-000000000002') then raise exception 'moderated court metadata exposed'; end if;
end $$;
select public.remove_saved_court('00000000-0000-4000-8000-000000000002');
select public.save_court('00000000-0000-4000-8000-000000000006');
reset role;
update profiles set is_pro=false where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$ begin
  if (select count(*) from saved_courts) <> 1 then raise exception 'downgrade exposed extra saved courts'; end if;
end $$;
reset role;
insert into profiles(id,is_pro) values('44444444-4444-4444-8444-444444444444',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.save_court('00000000-0000-4000-8000-000000000003');
reset role;
do $$ begin
  if (select local_court_id from profiles where id='44444444-4444-4444-8444-444444444444') <> '00000000-0000-4000-8000-000000000003' then raise exception 'first saved court did not establish primary'; end if;
  if private.auto_check_in_court_allowed('44444444-4444-4444-8444-444444444444','00000000-0000-4000-8000-000000000003') then raise exception 'new first court opted in automatically'; end if;
end $$;
rollback;
