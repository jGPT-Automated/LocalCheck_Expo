begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(11);

select has_table(
  'private',
  'court_verification_attempt_states',
  'server-only Add Court attempt state exists'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'private.court_verification_attempt_states'::regclass),
  'Add Court attempt state has RLS enabled'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.court_verification_attempt_states',
    'SELECT'
  ),
  'authenticated clients cannot read Add Court attempt state'
);
select ok(
  to_regprocedure('public.reserve_court_verification_attempt(uuid)') is not null,
  'attempt reservation RPC exists'
);
select ok(
  to_regprocedure('public.cancel_court_verification_attempt(uuid,uuid)') is not null,
  'attempt cancellation RPC exists'
);
select ok(
  to_regprocedure('public.reject_court_verification_attempt(uuid,uuid)') is not null,
  'attempt rejection RPC exists'
);
select ok(
  to_regprocedure(
    'public.create_live_court_submission_v4(uuid,uuid,text,text,text,text,text,text,text,text,double precision,double precision,text,text,text,boolean,text)'
  ) is not null,
  'live Add Court insertion RPC exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_court_verification_attempt(uuid)',
    'EXECUTE'
  ),
  'service role can reserve an Add Court attempt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_court_verification_attempt(uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot reserve attempts directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_live_court_submission_v4(uuid,uuid,text,text,text,text,text,text,text,text,double precision,double precision,text,text,text,boolean,text)',
    'EXECUTE'
  ),
  'service role can publish a verified live court'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_live_court_submission_v4(uuid,uuid,text,text,text,text,text,text,text,text,double precision,double precision,text,text,text,boolean,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot publish a court directly'
);

select * from finish();
rollback;
