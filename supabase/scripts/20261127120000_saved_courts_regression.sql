-- Run in a disposable migrated database. All fixture changes roll back.
begin;

create function pg_temp.court(n integer) returns uuid language sql immutable as $$
  select ('11111111-cafe-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

insert into auth.users(id, email)
values ('22222222-cafe-4000-8000-000000000001', 'listqa@example.invalid');
insert into public.courts (id, slug, name, short_name, address, city, state, market,
  location, latitude, longitude, sport_type, access_type, setting, launch_reason,
  verification_status, source_url, source_tier)
select pg_temp.court(n), 'list-qa-' || n, 'List QA ' || n, 'List QA ' || n,
  'Test', 'Test', 'CA', 'Test', 'Test', 34, -118, 'basketball', 'public_free',
  'outdoor', 'Database regression fixture', 'source_verified', 'https://example.invalid', 'official'
from generate_series(1,7) n;
select set_config('request.jwt.claims',
  '{"sub":"22222222-cafe-4000-8000-000000000001","role":"authenticated"}', true);
update public.profiles set local_court_id=pg_temp.court(1), is_pro=true where id=auth.uid();

-- Fill five slots including an explicitly enabled default. Exercise the old
-- update as the actual authenticated role with its pre-existing column grant.
set local role authenticated;
do $$
begin
  for n in 1..5 loop
    perform public.update_local_list('add',pg_temp.court(n));
    perform public.update_local_list('auto',pg_temp.court(n),true);
  end loop;
  begin
    update public.profiles set local_court_id=pg_temp.court(6) where id=auth.uid();
    raise exception 'Legacy client added a sixth default';
  exception when raise_exception then
    if sqlerrm not like 'You can add up to 5 courts%' then raise; end if;
  end;
  if (select court->>'id' from public.get_local_list() where is_default)
    is distinct from pg_temp.court(1)::text then raise exception 'Default changed'; end if;
  update public.profiles set local_court_id=pg_temp.court(5) where id=auth.uid();
  if (select court->>'id' from public.get_local_list() where is_default)
    is distinct from pg_temp.court(5)::text then raise exception 'Legacy default switch failed'; end if;
  update public.profiles set local_court_id=pg_temp.court(1) where id=auth.uid();
end $$;

-- Archive, fill the freed slot, then restore. Every court eligible on the
-- server must still be present in the authenticated player's picker.
reset role;
update public.courts set is_archived=true where id=pg_temp.court(2);
set local role authenticated;
select public.update_local_list('add',pg_temp.court(6));
select public.update_local_list('auto',pg_temp.court(6),true);
reset role;
update public.courts set is_archived=false where id=pg_temp.court(2);
set local role authenticated;
create temp table picker as select (court->>'id')::uuid as id from public.get_local_list();
reset role;
do $$
begin
  if (select count(*) from picker) <> 5 then raise exception 'Expected five visible courts'; end if;
  for n in 1..6 loop
    if private.allows_auto_court(auth.uid(),pg_temp.court(n)) is distinct from
      exists (select 1 from picker where id=pg_temp.court(n)) then
      raise exception 'Picker and auto check-in disagree at court %', n;
    end if;
  end loop;
end $$;

-- A regular paid account loses visibility of two test courts. An invisible
-- membership must not consume a visible slot inside the privileged write RPC.
update public.courts set is_test=true where id in (pg_temp.court(2),pg_temp.court(3));
set local role authenticated;
select public.update_local_list('add',pg_temp.court(7));
select public.update_local_list('auto',pg_temp.court(1),false);
do $$
begin
  if exists (select 1 from public.get_local_list() where court->>'id' in
      (pg_temp.court(2)::text, pg_temp.court(3)::text))
    or not exists (select 1 from public.get_local_list() where court->>'id'=pg_temp.court(7)::text)
    then raise exception 'Hidden-court visibility mismatch'; end if;
end $$;

reset role;
update public.profiles set is_pro=false where id=auth.uid();
do $$
begin
  if private.allows_auto_court(auth.uid(),pg_temp.court(1)) then
    raise exception 'An explicit Off was lost on expiry';
  end if;
end $$;
set local role authenticated;
do $$
begin
  if public.auto_check_in_arrive(pg_temp.court(1))->>'status' is distinct from 'not_local' then
    raise exception 'Disabled default accepted an arrival after expiry';
  end if;
end $$;
select public.update_local_list('auto',pg_temp.court(1),true);
do $$
begin
  if (select count(*) from public.get_local_list()) <> 1 then raise exception 'Free list leaked extras'; end if;
  begin
    perform public.update_local_list('auto',pg_temp.court(4),true);
    raise exception 'Free account enabled another court';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if not private.allows_auto_court(auth.uid(),pg_temp.court(1)) or
    private.allows_auto_court(auth.uid(),pg_temp.court(4)) then
    raise exception 'Free default opt-in or extra-court denial failed';
  end if;
end $$;
rollback;
