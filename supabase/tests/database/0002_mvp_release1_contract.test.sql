begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(23);

select has_table('public', 'user_blocks', 'user_blocks exists');
select has_table('public', 'user_reports', 'user_reports exists');
select has_table('public', 'push_delivery_attempts', 'push delivery attempts exist');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_blocks'::regclass),
  'user_blocks has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_reports'::regclass),
  'user_reports has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_delivery_attempts'::regclass),
  'push delivery attempts have RLS enabled'
);

select ok(
  to_regprocedure('public.create_verified_court(uuid,text,text,text,text,text,double precision,double precision,text,text,text,text)') is not null,
  'verified court insertion RPC exists'
);
select ok(to_regprocedure('public.block_user(uuid)') is not null, 'block RPC exists');
select ok(to_regprocedure('public.report_user(uuid,text,text)') is not null, 'report RPC exists');
select ok(
  to_regprocedure('public.claim_push_notifications(uuid,integer)') is not null,
  'push claim RPC exists'
);
select ok(
  to_regprocedure('private.apply_match_elo(uuid,text)') is not null,
  'sport Elo application function exists'
);
select ok(
  to_regprocedure('private.auto_confirm_due_matches()') is not null,
  'automatic confirmation function exists'
);

select has_column('public', 'profiles', 'elo_basketball', 'basketball Elo exists');
select has_column('public', 'profiles', 'elo_pickleball', 'pickleball Elo exists');
select has_column('public', 'matches', 'review_due_at', 'match review deadline exists');
select has_column('public', 'matches', 'confirmation_method', 'confirmation method exists');
select has_column('public', 'notifications', 'next_push_attempt_at', 'push retry deadline exists');

select ok(
  has_function_privilege(
    'service_role',
    'public.create_verified_court(uuid,text,text,text,text,text,double precision,double precision,text,text,text,text)',
    'EXECUTE'
  ),
  'service role can create a verified court'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_verified_court(uuid,text,text,text,text,text,double precision,double precision,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot bypass court verification'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_push_notifications(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot claim push work'
);
select ok(
  not has_table_privilege('authenticated', 'public.user_reports', 'SELECT'),
  'report rows are not client-readable'
);

select ok(
  exists (
    select 1 from cron.job
    where jobname = 'localcheck-auto-confirm-due-matches'
  ),
  'three-day match confirmation job is scheduled'
);
select ok(
  exists (
    select 1 from cron.job
    where jobname = 'localcheck-notification-dispatch'
  ),
  'notification dispatch job is scheduled'
);

select * from finish();
rollback;
