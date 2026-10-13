-- TEST VERSION of 20261012200000_checkout_notice_for_all.sql. Changes nothing.
-- Runs the change, ends a fake 46-minute manual check-in for a test account,
-- runs the undo and checks it, then throws everything away.
-- Expected result: a red error starting TEST_RESULT.

-- Every automatic checkout tells the player (Jesse, Oct 12; D53).
--
-- Before: only an auto check-in ending at 1.5 hours sent "Auto checked out".
-- Now a manual check-in ending at 45 minutes sends the same notification:
-- "Auto checked out / Still at {court}? Tap I'm still here." The data now
-- carries `source` ('manual' or 'auto') so I'm still here checks the player
-- back in the same way (app change, see the front-end handoff).
--
-- Changes one function, private.end_check_in. Saves the current definition
-- first; undo: supabase/rollbacks/20261012200000_checkout_notice_for_all.sql.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into private.migration_backups (migration, kind, name, definition)
select '20261012200000', 'function', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname = 'end_check_in'
on conflict do nothing;

create or replace function private.end_check_in(p_check_in_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.check_ins;
  v_limit interval;
  v_court_name text;
begin
  select * into v from public.check_ins where id = p_check_in_id for update;
  if not found or v.checked_out_at is not null then
    return 'nothing to do';
  end if;
  v_limit := case when v.source = 'auto' then interval '90 minutes' else interval '45 minutes' end;
  if v.checked_in_at + v_limit > now() then
    return 'not due yet';
  end if;

  update public.check_ins
  set checked_out_at = v.checked_in_at + v_limit
  where id = p_check_in_id;

  select coalesce(nullif(btrim(c.short_name), ''), c.name) into v_court_name
  from public.courts c where c.id = v.court_id;
  perform private.create_notification(
    v.user_id, 'auto_check_out', null, null, null, null,
    'Auto checked out',
    left('Still at ' || coalesce(v_court_name, 'the court') || '? Tap I''m still here.', 240),
    jsonb_build_object(
      'path', '/court/' || v.court_id,
      'kind', 'auto_check_out',
      'court_id', v.court_id,
      'source', v.source,
      'category', 'auto-check-out'
    ),
    'auto_check_out:' || p_check_in_id::text
  );
  return 'checked out';
end
$$;

revoke all on function private.end_check_in(uuid) from public, anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261012200000', 'checkout_notice_for_all',
  array['-- applied by Jesse in the SQL editor on 2026-10-12; see supabase/migrations/20261012200000_checkout_notice_for_all.sql'])
on conflict (version) do nothing;


-- ── TEST ONLY: a manual check-in for test account lcqaalpha, 46 minutes old ──
create temp table test_result (o jsonb);

do $dry$
declare
  u1 uuid := 'e42fe8c4-6f71-4ad3-8b31-c2e4ae803d2c';
  court uuid := '7831e524-8ee8-47a3-9a11-7dae16ff22bb';
  v_ci uuid;
  o jsonb := '{}';
begin
  insert into public.check_ins (user_id, court_id, source, checked_in_at)
  values (u1, court, 'manual', now() - interval '46 minutes') returning id into v_ci;
  o := o || jsonb_build_object('manual_end', private.end_check_in(v_ci));
  o := o || jsonb_build_object('manual_note', (select title || ' / ' || body from public.notifications where dedupe_key = 'auto_check_out:' || v_ci));
  o := o || jsonb_build_object('manual_note_source', (select data->>'source' from public.notifications where dedupe_key = 'auto_check_out:' || v_ci));
  o := o || jsonb_build_object('backup_saved', (select count(*) from private.migration_backups where migration = '20261012200000'));
  insert into pg_temp.test_result values (o);
end
$dry$;

-- ── Undo script ──────────────────────────────────────────────────────────────


set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $restore$
declare
  v_def text;
begin
  select definition into v_def from private.migration_backups
  where migration = '20261012200000' and kind = 'function';
  if v_def is null then
    raise exception 'The saved end_check_in is missing; stopping.';
  end if;
  execute v_def;
end
$restore$;

delete from supabase_migrations.schema_migrations where version = '20261012200000';


-- ── TEST ONLY: check the undo, then throw everything away ───────────────────
do $final$
declare
  o jsonb;
begin
  select t.o into o from pg_temp.test_result t;
  o := o || jsonb_build_object('after_undo_manual_quiet_again',
    (select pg_get_functiondef('private.end_check_in(uuid)'::regprocedure) like '%if v.source = ''auto'' then%'));
  raise exception 'TEST_RESULT %', o::text;
end
$final$;

rollback;
