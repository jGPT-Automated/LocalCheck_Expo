begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(12);

select has_table('public', 'courts', 'courts exists');
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'check_ins', 'check_ins exists');
select has_table('public', 'runs', 'runs exists');
select has_table('public', 'matches', 'matches exists');
select has_table('public', 'friendships', 'friendships exists');
select has_table('public', 'planned_visits', 'planned_visits exists');
select has_table('public', 'notifications', 'notifications exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.check_ins'::regclass),
  'check_ins has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications has RLS enabled'
);

select has_function('public', 'switch_active_checkin', 'atomic check-in RPC exists');
select has_function('public', 'join_run', 'capacity-aware run join RPC exists');

select * from finish();
rollback;
