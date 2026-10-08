-- Launch hygiene (D34): real players never see test accounts or test courts;
-- testers keep seeing everything so dev work and game-logging tests go on.
--
--   Hidden accounts  account_tag TEST or REVIEWER.
--   Insiders         account_tag TEST, REVIEWER or FOUNDER. They see all of
--                    it. Everyone else (every new sign-up) gets the real view.
--   Test courts      courts.is_test. Insiders only. Four kept for testing:
--                    Los Angeles  Rancho Cienega (basketball), Cheviot Hills (pickleball)
--                    Houston      Fonde Rec (basketball), Jaycee Park (pickleball)
--   Real courts      Kasmiersky Park (Conroe). Every other seeded court is
--                    archived (hidden from everyone; reversible).
--
-- Data steps:
--   * Every untagged account except JESSE and APPLE becomes TEST (there are no
--     real users yet).
--   * Test accounts whose local court is archived or real move to a test court
--     of the same sport, with the local-court cooldown cleared.
--   * New-court duplicate checks ignore test courts, so a real player can add
--     the real Fonde Rec later.
--
-- RLS: each read policy below keeps its current rule and gains one more:
-- "you own it, OR you're an insider, OR it involves no hidden account and no
-- test court". Participants of a game always keep seeing their own game.
-- Runbook: docs/runbooks/ACCOUNT_TAGS.md.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Policy text is read back and re-parsed below; pin the path both ways.
set local search_path = public;

-- ── Courts ────────────────────────────────────────────────────────────────
alter table public.courts
  add column if not exists is_test boolean not null default false;

comment on column public.courts.is_test is
  'Test court: only insider accounts (TEST, REVIEWER, FOUNDER) can see it. See docs/runbooks/ACCOUNT_TAGS.md.';

update public.courts set is_test = true
where id in (
  '7831e524-8ee8-47a3-9a11-7dae16ff22bb', -- Rancho Cienega, Los Angeles
  'fd528863-bbda-460c-ba5e-428ca5fae940', -- Cheviot Hills, Los Angeles
  '15fb6104-9743-4a1e-ae64-6487539730b3', -- Fonde Rec, Houston
  '3bc01099-488e-4dd2-8d4c-3c18ff314d59'  -- Jaycee Park, Houston
);

update public.courts set is_archived = true
where not is_archived
  and not is_test
  and id <> 'abe05196-a2d2-469e-b919-0435a056d9a3'; -- Kasmiersky Park stays real

-- ── Accounts ──────────────────────────────────────────────────────────────
update public.profiles set account_tag = 'TEST'
where account_tag is null
  and id not in (
    '8ea0f430-a83c-4aec-a9d6-c667f7dc0944', -- JESSE (FOUNDER)
    '069a0d4c-69c0-4ff7-a087-1e95e6b89cfb'  -- APPLE (REVIEWER)
  );

-- Test accounts off archived / real courts, onto a test court of that sport.
create temporary table rehomed on commit drop as
select p.id,
  case when c.sport_type = 'pickleball'
    then '3bc01099-488e-4dd2-8d4c-3c18ff314d59'::uuid   -- Jaycee Park
    else '15fb6104-9743-4a1e-ae64-6487539730b3'::uuid   -- Fonde Rec
  end as court_id,
  p.local_court_changed_at as changed_at
from public.profiles p
join public.courts c on c.id = p.local_court_id
where p.account_tag = 'TEST' and not c.is_test;

update public.profiles p set local_court_id = r.court_id
from rehomed r where r.id = p.id;
update public.profiles p set local_court_changed_at = r.changed_at
from rehomed r where r.id = p.id;

-- ── Helpers ───────────────────────────────────────────────────────────────
create or replace function private.viewer_sees_test_data()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and account_tag in ('TEST', 'REVIEWER', 'FOUNDER')
  );
$$;

create or replace function private.is_hidden_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.profiles
    where id = p_user_id and account_tag in ('TEST', 'REVIEWER')
  );
$$;

create or replace function private.is_test_court(p_court_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_court_id is not null and exists (
    select 1 from public.courts
    where id = p_court_id and (is_test or is_archived)
  );
$$;

create or replace function private.match_has_hidden_player(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_participants mp
    join public.profiles p on p.id = mp.user_id
    where mp.match_id = p_match_id and p.account_tag in ('TEST', 'REVIEWER')
  ) or exists (
    select 1
    from public.matches m
    join public.profiles p on p.id in (m.created_by, m.opponent_id)
    where m.id = p_match_id and p.account_tag in ('TEST', 'REVIEWER')
  );
$$;

revoke all on function private.viewer_sees_test_data() from public, anon;
revoke all on function private.is_hidden_account(uuid) from public, anon;
revoke all on function private.is_test_court(uuid) from public, anon;
revoke all on function private.match_has_hidden_player(uuid) from public, anon;
grant execute on function private.viewer_sees_test_data() to authenticated;
grant execute on function private.is_hidden_account(uuid) to authenticated;
grant execute on function private.is_test_court(uuid) to authenticated;
grant execute on function private.match_has_hidden_player(uuid) to authenticated;

-- ── Read policies: keep each rule, AND the test-data rule onto it ─────────
do $policies$
declare
  v record;
  v_qual text;
begin
  for v in
    select * from (values
      ('profiles', 'profiles_select_authenticated',
       $x$(id = (select auth.uid())) or (select private.viewer_sees_test_data()) or coalesce(account_tag not in ('TEST', 'REVIEWER'), true)$x$),
      ('check_ins', 'check_ins_select_visible',
       $x$(user_id = (select auth.uid())) or (select private.viewer_sees_test_data()) or (not private.is_hidden_account(user_id) and not private.is_test_court(court_id))$x$),
      ('planned_visits', 'planned_visits_select_visible',
       $x$(user_id = (select auth.uid())) or (select private.viewer_sees_test_data()) or (not private.is_hidden_account(user_id) and not private.is_test_court(court_id))$x$),
      ('runs', 'runs_select_visible',
       $x$(organizer_id = (select auth.uid())) or (select private.viewer_sees_test_data()) or (not private.is_hidden_account(organizer_id) and not private.is_test_court(court_id))$x$),
      ('activity_events', 'activity_events_select_visible',
       $x$(actor_id = (select auth.uid())) or (select private.viewer_sees_test_data()) or ((match_id is not null) and private.is_match_participant(match_id, (select auth.uid()))) or (not private.is_hidden_account(actor_id) and not private.is_test_court(court_id) and ((match_id is null) or not private.match_has_hidden_player(match_id)))$x$),
      ('matches', 'matches_select_visible',
       $x$(created_by = (select auth.uid())) or (opponent_id = (select auth.uid())) or private.is_match_participant(id, (select auth.uid())) or (select private.viewer_sees_test_data()) or (not private.is_test_court(court_id) and not private.match_has_hidden_player(id))$x$),
      ('courts', 'Signed-in users can view reviewed and own pending courts',
       $x$(added_by = (select auth.uid())) or (not is_test) or (select private.viewer_sees_test_data())$x$),
      ('courts', 'Anonymous users can view reviewed courts',
       $x$not is_test$x$)
    ) as t(tbl, pol, extra)
  loop
    select qual into v_qual from pg_policies
    where schemaname = 'public' and tablename = v.tbl and policyname = v.pol;
    if v_qual is null then
      raise exception 'policy % on % not found', v.pol, v.tbl;
    end if;
    if position('viewer_sees_test_data' in v_qual) > 0 or position('is_test' in v_qual) > 0 then
      continue; -- already applied
    end if;
    execute format('alter policy %I on public.%I using ((%s) and (%s))', v.pol, v.tbl, v_qual, v.extra);
  end loop;
end
$policies$;

-- ── New courts: duplicate check skips test courts ─────────────────────────
do $patch$
declare
  v_fn text;
  v_def text;
  v_anchor text := E'where not c.is_archived\n    and c.sport_type = p_sport_type';
  v_new text := E'where not c.is_archived and not c.is_test\n    and c.sport_type = p_sport_type';
begin
  foreach v_fn in array array[
    'public.create_court_submission_v3(uuid,text,text,text,text,text,text,text,text,double precision,double precision,text,text,text,boolean,text)',
    'public.create_verified_court(uuid,text,text,text,text,text,double precision,double precision,text,text,text,text)'
  ] loop
    v_def := pg_get_functiondef(v_fn::regprocedure);
    if position('not c.is_test' in v_def) > 0 then
      continue;
    end if;
    if position(v_anchor in v_def) = 0 then
      raise exception '% anchor not found; definition drifted', v_fn;
    end if;
    execute replace(v_def, v_anchor, v_new);
  end loop;
end
$patch$;

commit;
