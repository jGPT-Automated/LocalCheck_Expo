-- Read-only snapshot from LocalCheckProd, November 13, 2026.
CREATE OR REPLACE FUNCTION private.end_check_in(p_check_in_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION private.run_timer(p_timer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_timer private.timers;
  v_did text;
begin
  select * into v_timer from private.timers where id = p_timer_id for update;
  if not found then
    return jsonb_build_object('result', 'missing');
  end if;
  if v_timer.fired_at is not null then
    return jsonb_build_object('result', 'already', 'run_at', v_timer.run_at);
  end if;
  if v_timer.run_at > now() then
    return jsonb_build_object('result', 'early', 'run_at', v_timer.run_at);
  end if;

  v_did := case v_timer.kind
    when 'challenge_expiry' then private.expire_challenge(v_timer.ref_id)
    when 'challenge_reminder' then private.remind_challenge(v_timer.ref_id)
    when 'auto_check_in_post' then private.post_auto_check_in(v_timer.ref_id)
    when 'check_in_end' then private.end_check_in(v_timer.ref_id)
    when 'match_due' then private.settle_due_match(v_timer.ref_id)
  end;

  update private.timers
  set fired_at = now(), result = v_did
  where id = p_timer_id;
  return jsonb_build_object('result', 'ran', 'did', v_did, 'run_at', v_timer.run_at);
end
$function$
;
