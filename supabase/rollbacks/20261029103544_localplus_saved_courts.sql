-- MANUAL rollback only: removes the paid saved-court list/preferences.
-- Does not remove profiles.local_court_id or affect the single-court feature.
-- Jesse must approve/run this destructive rollback; never run automatically.
begin;
do $undo$
declare v_def text; v_anchor text;
begin
  v_def := pg_get_functiondef('public.auto_check_in_arrive(uuid)'::regprocedure);
  v_anchor := 'if not private.auto_check_in_court_allowed(v_user_id, p_court_id) or v_name is null then';
  if position(v_anchor in v_def)=0 then raise exception 'arrive rollback anchor changed'; end if;
  execute replace(v_def,v_anchor,'if v_local is distinct from p_court_id or v_name is null then');
  v_def := pg_get_functiondef('public.resume_auto_check_in(uuid)'::regprocedure);
  v_anchor := 'where p.id = v_user_id and private.auto_check_in_court_allowed(v_user_id, p_court_id)';
  if position(v_anchor in v_def)=0 then raise exception 'resume rollback anchor changed'; end if;
  execute replace(v_def,v_anchor,'where p.id = v_user_id and p.local_court_id = p_court_id');
  v_def := pg_get_functiondef('private.post_auto_check_in(uuid)'::regprocedure);
  v_anchor := $guard$
  if not private.auto_check_in_court_allowed(p_user_id, v.court_id) then
    return 'not_local';
  end if;
  -- Same court, still checked in: nothing to post.
$guard$;
  if position(v_anchor in v_def)=0 then raise exception 'post rollback anchor changed'; end if;
  execute replace(v_def,v_anchor,'-- Same court, still checked in: nothing to post.');
end $undo$;
drop trigger mirror_primary_saved_court on public.profiles;
drop table public.saved_courts;
drop function public.save_court(uuid),public.remove_saved_court(uuid),public.set_saved_court_auto_check_in(uuid,boolean),public.resolve_saved_court_auto_check_in(uuid,boolean);
drop function private.change_saved_court(uuid,text,boolean),private.resolve_saved_court_auto_check_in(uuid,boolean),private.mirror_primary_saved_court(),private.broadcast_saved_court_invalidation();
drop function private.can_read_saved_court(uuid,uuid),private.auto_check_in_court_allowed(uuid,uuid);
drop function private.saved_courts_has_plus(uuid);
commit;
