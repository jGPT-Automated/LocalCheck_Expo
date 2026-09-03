import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationDir = new URL("../../migrations/", import.meta.url);

async function migrationEndingWith(suffix) {
  const names = await readdir(migrationDir);
  const name = names.find((candidate) => candidate.endsWith(suffix));
  assert.ok(name, `missing Supabase migration ending in ${suffix}`);
  return readFile(new URL(name, migrationDir), "utf8");
}

test("signed-in users can persist a validated profile ZIP", async () => {
  const columnSql = await migrationEndingWith("_add_profile_postal_code.sql");
  const grantSql = await migrationEndingWith(
    "_grant_profile_postal_code_update.sql",
  );

  assert.match(columnSql, /add column if not exists postal_code text/i);
  assert.match(columnSql, /postal_code ~ '\^\[0-9\]\{5\}\$'/i);
  assert.match(
    grantSql,
    /grant update \(postal_code\)[\s\S]*on table public\.profiles[\s\S]*to authenticated/i,
  );
});

test("verified court creation is atomic, quota-bound, and duplicate-safe", async () => {
  const sql = await migrationEndingWith("_add_verified_court_creation.sql");
  assert.match(
    sql,
    /create or replace function public\.create_verified_court/i,
  );
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /count\(\*\)\s*>=\s*5/i);
  assert.match(sql, /<=\s*150/);
  assert.match(sql, /to service_role/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]*?to authenticated/i);
});

test("new verified courts do not require a paid, free, or private access classification", async () => {
  const sql = await migrationEndingWith("_make_court_access_optional.sql");
  assert.match(sql, /alter column access_type drop not null/i);
  assert.match(
    sql,
    /create or replace function public\.create_verified_court/i,
  );
  assert.doesNotMatch(sql, /p_access_type/i);

  const verification = await readFile(
    new URL(
      "../../functions/verify-court/courtVerification.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const edgeFunction = await readFile(
    new URL("../../functions/verify-court/index.ts", import.meta.url),
    "utf8",
  );
  const courtService = await readFile(
    new URL("../../../services/courtService.ts", import.meta.url),
    "utf8",
  );
  const modal = await readFile(
    new URL("../../../components/AddCourtModal.tsx", import.meta.url),
    "utf8",
  );
  for (const source of [verification, edgeFunction, courtService, modal]) {
    assert.doesNotMatch(source, /accessType|ACCESS_OPTIONS|p_access_type/);
  }
  assert.doesNotMatch(modal, />ACCESS</);
  assert.match(edgeFunction, /store:\s*false/);
});

test("community court names stay private and pending manual review", async () => {
  const sql = await migrationEndingWith(
    "_add_court_submission_name_review.sql",
  );
  for (const contract of [
    "private.court_submission_reviews",
    "source_official_name",
    "source_short_name",
    "submitted_official_name",
    "submitted_short_name",
    "name_was_edited",
    "gemini_name_ok",
    "public.create_court_submission_v3",
    "'needs_review'",
  ]) {
    assert.ok(sql.includes(contract), `missing court review contract ${contract}`);
  }
  assert.match(
    sql,
    /create policy "Submitters can view pending courts"[\s\S]*added_by = \(select auth\.uid\(\)\)/i,
  );
  assert.match(
    sql,
    /revoke execute on function public\.create_court_submission_v3[\s\S]*from public, anon, authenticated/i,
  );
  assert.doesNotMatch(
    sql,
    /grant execute on function public\.create_court_submission_v3[^;]*to authenticated/i,
  );
});

test("live Add Court submissions enforce two failed photo attempts and a 24-hour cooldown", async () => {
  const sql = await migrationEndingWith(
    "_add_court_verification_attempt_cooldown.sql",
  );
  for (const contract of [
    "private.court_verification_attempt_states",
    "public.reserve_court_verification_attempt",
    "public.cancel_court_verification_attempt",
    "public.reject_court_verification_attempt",
    "public.create_live_court_submission_v4",
    "reservation_id",
    "interval '24 hours'",
    "'source_and_detection'",
  ]) {
    assert.ok(sql.includes(contract), `missing Add Court attempt contract ${contract}`);
  }
  assert.match(sql, /failed_attempts between 0 and 2/i);
  assert.match(
    sql,
    /revoke execute on function public\.create_live_court_submission_v4[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.create_live_court_submission_v4[\s\S]*to service_role/i,
  );

  const edgeFunction = await readFile(
    new URL("../../functions/verify-court/index.ts", import.meta.url),
    "utf8",
  );
  const courtService = await readFile(
    new URL("../../../services/courtService.ts", import.meta.url),
    "utf8",
  );
  assert.match(edgeFunction, /reserve_court_verification_attempt/);
  assert.match(edgeFunction, /reject_court_verification_attempt/);
  assert.match(edgeFunction, /create_live_court_submission_v4/);
  assert.match(edgeFunction, /failureCode:\s*inCooldown \? "cooldown" : "not_a_court"/);
  assert.match(courtService, /cooldownUntil/);
  assert.match(courtService, /attemptsUsed/);
});

test("safety controls enforce blocking across reads and social writes", async () => {
  const sql = await migrationEndingWith("_add_user_safety_controls.sql");
  for (const contract of [
    "public.user_blocks",
    "public.user_reports",
    "private.users_are_blocked",
    "public.block_user",
    "public.unblock_user",
    "public.list_blocked_users",
    "public.report_user",
    "prevent_blocked_run_participation",
    "public.request_friend",
  ]) {
    assert.ok(sql.includes(contract), `missing safety contract ${contract}`);
  }
  assert.match(
    sql,
    /alter table public\.user_blocks enable row level security/i,
  );
  assert.match(
    sql,
    /alter table public\.user_reports enable row level security/i,
  );
  assert.match(
    sql,
    /list_blocked_users[\s\S]*where block\.blocker_id = \(select auth\.uid\(\)\)/i,
  );
});

test("sport ratings use a three-day review window and scheduled auto-confirmation", async () => {
  const sql = await migrationEndingWith("_complete_sport_elo_review.sql");
  for (const contract of [
    "elo_basketball",
    "elo_pickleball",
    "private.apply_match_elo",
    "private.auto_confirm_due_matches",
  ]) {
    assert.ok(sql.includes(contract), `missing rating contract ${contract}`);
  }
  assert.match(sql, /interval '3 days'/i);
  assert.doesNotMatch(sql, /interval '7 days'/i);
  assert.match(sql, /localcheck-auto-confirm-due-matches/i);
  assert.match(sql, /log_match[\s\S]*private\.users_are_blocked/i);
});

test("sport Elo rollout preserves existing profile ratings and history", async () => {
  const sql = await migrationEndingWith("_complete_sport_elo_review.sql");
  assert.doesNotMatch(sql, /Replay confirmed history once/i);
  assert.doesNotMatch(sql, /update public\.profiles\s+set\s+elo_basketball\s*=\s*1200/i);
  assert.doesNotMatch(sql, /where status = 'confirmed'[\s\S]*update public\.profiles/i);
  assert.match(sql, /no historical replay is performed/i);
});

test("scheduled games produce one team result with participant review", async () => {
  const sql = await migrationEndingWith("_add_scheduled_team_results.sql");
  for (const contract of [
    "matches_one_result_per_run_idx",
    "match_participant_reviews",
    "public.log_run_match",
    "public.review_run_match",
    "private.apply_scheduled_match_elo",
  ]) {
    assert.ok(
      sql.includes(contract),
      `missing scheduled-result contract ${contract}`,
    );
  }
  assert.match(sql, /avg\(case when mp\.side = 'a'/i);
  assert.match(sql, /interval '3 days'/i);
  assert.match(sql, /decision = 'disputed'/i);
  assert.match(sql, /v_roster_count <> v_run\.max_players/i);
  assert.match(sql, /GAME DISPUTED/i);
  assert.match(sql, /DISPUTE WITHDRAWN/i);
  assert.match(sql, /GAME INVITATION/i);
  assert.doesNotMatch(sql, /captain/i);
});

test("every scheduled match participant can read the pending result", async () => {
  const sql = await migrationEndingWith("_add_scheduled_team_results.sql");
  assert.match(
    sql,
    /create or replace function private\.is_match_participant/i,
  );
  assert.match(
    sql,
    /from public\.match_participants[\s\S]*user_id\s*=\s*p_user_id/i,
  );
  assert.match(
    sql,
    /drop policy if exists matches_select_visible on public\.matches/i,
  );
  assert.match(
    sql,
    /create policy matches_select_visible[\s\S]*private\.is_match_participant\(matches\.id, \(select auth\.uid\(\)\)\)/i,
  );
});

test("scheduled results preserve privacy and refresh the full roster", async () => {
  const sql = await migrationEndingWith("_add_scheduled_team_results.sql");
  assert.match(
    sql,
    /case when v_run\.is_open_invite then 'public' else 'private' end/i,
  );
  assert.match(
    sql,
    /private\.send_invalidation\([\s\S]*?'user:' \|\| v_user_id::text, 'matches', 'UPDATE'/i,
  );
  assert.match(sql, /v_transition_id uuid := gen_random_uuid\(\)/i);
  assert.match(sql, /run-match-disputed:[^\n]+v_transition_id::text/i);
  assert.match(sql, /run-match-dispute-withdrawn:[^\n]+v_transition_id::text/i);
});

test("ad-hoc team games keep equal rosters and participant review", async () => {
  const sql = await migrationEndingWith("_add_ad_hoc_team_matches.sql");
  for (const contract of [
    "team_size",
    "public.log_team_match",
    "public.review_team_match",
    "private.apply_ad_hoc_team_elo",
  ]) {
    assert.ok(
      sql.includes(contract),
      `missing ad-hoc team contract ${contract}`,
    );
  }
  assert.match(sql, /v_team_size not between 2 and 5/i);
  assert.match(sql, /cardinality\(p_team_b_ids\) <> v_team_size/i);
  assert.match(sql, /count\(distinct id\)/i);
  assert.match(sql, /team-match-review:/i);
  assert.match(sql, /decision = 'disputed'/i);
});

test("match disputes use one bounded hold and revision lifecycle", async () => {
  const sql = await migrationEndingWith("_match_dispute_resolution.sql");
  for (const contract of [
    "dispute_count",
    "revision_number",
    "resolution_due_at",
    "last_submitted_by",
    "public.respond_to_match",
    "public.update_held_match",
  ]) {
    assert.ok(
      sql.includes(contract),
      `missing dispute lifecycle contract ${contract}`,
    );
  }
  assert.match(sql, /status in \('pending', 'held', 'confirmed', 'voided'\)/i);
  assert.match(sql, /now\(\) \+ interval '3 days'/i);
  assert.match(sql, /now\(\) \+ interval '7 days'/i);
  assert.match(sql, /v_next_dispute >= 3[\s\S]*status = 'voided'/i);
  assert.match(sql, /status = 'held'[\s\S]*resolution_due_at <= now\(\)/i);
  assert.match(sql, /only participants can update this match/i);
  assert.match(sql, /approval must come from the opposite side/i);
  assert.match(sql, /GAME UPDATED/i);
  assert.match(sql, /GAME VOIDED/i);
});

test("hardened match responses audit disputes, bound notes, and scope team approvals", async () => {
  const sql = await migrationEndingWith("_harden_match_review_lifecycle.sql");
  assert.match(sql, /insert into public\.match_participant_reviews[\s\S]*values \(v_match\.id, v_user_id, 'disputed', now\(\)\)/i);
  assert.match(sql, /dispute_note text/i);
  assert.match(sql, /char_length\(v_explanation\) > 280/i);
  assert.match(sql, /status = 'held'[\s\S]*resolution_due_at = now\(\) \+ interval '7 days'/i);
  assert.match(sql, /status = 'pending'[\s\S]*review_due_at = now\(\) \+ interval '3 days'/i);
  assert.match(sql, /v_next_dispute >= 3[\s\S]*status = 'voided'/i);
  assert.match(sql, /v_match\.team_size > 1 and exists[\s\S]*decision <> 'approved'/i);
  assert.match(sql, /where match_id = v_match\.id[\s\S]*decision = case when user_id = v_user_id then 'approved' else 'pending' end/i);
  assert.match(sql, /old\.status is not distinct from new\.status[\s\S]*revision_number[\s\S]*return new/i);
  assert.match(sql, /new\.status = 'pending'[\s\S]*revision_number[\s\S]*GAME UPDATED/i);
  assert.match(sql, /match-revised:' \|\| new\.id::text[\s\S]*new\.revision_number::text[\s\S]*v_user_id::text/i);
  assert.match(sql, /for v_user_id in[\s\S]*private\.create_notification[\s\S]*private\.send_invalidation/i);
});

test("push delivery uses Vault, durable tickets, cron retry, and receipt reconciliation", async () => {
  const sql = await migrationEndingWith("_complete_push_delivery.sql");
  for (const contract of [
    "public.push_delivery_attempts",
    "vault.decrypted_secrets",
    "net.http_post",
    "localcheck-notification-dispatch",
  ]) {
    assert.ok(sql.includes(contract), `missing push contract ${contract}`);
  }
  assert.match(sql, /create extension if not exists pg_net/i);
  assert.match(sql, /create extension if not exists pg_cron/i);
  assert.match(sql, /cron\.schedule/i);
});

test("stale push backfill is isolated from the applied delivery migration", async () => {
  const deliverySql = await migrationEndingWith("_complete_push_delivery.sql");
  const backfillSql = await migrationEndingWith(
    "_skip_stale_pending_push_notifications.sql",
  );
  assert.doesNotMatch(deliverySql, /set push_status = 'skipped'/i);
  assert.match(backfillSql, /set push_status = 'skipped'/i);
  assert.match(backfillSql, /push_attempts = 0/i);
  assert.match(backfillSql, /push_sent_at is null/i);
});

test("scheduled games persist and enforce their team assignment mode", async () => {
  const sql = await migrationEndingWith("_add_scheduled_game_team_assignment.sql");
  for (const contract of [
    "team_assignment_mode",
    "team_side",
    "private.assign_balanced_run_teams",
    "public.create_scheduled_game",
    "public.join_scheduled_game",
  ]) {
    assert.ok(sql.includes(contract), `missing team assignment contract ${contract}`);
  }
  assert.match(sql, /team_assignment_mode in \('elo_balance', 'choose_teams'\)/i);
  assert.match(sql, /p_team_side not in \('a', 'b'\)/i);
  assert.match(sql, /v_side_count >= v_run\.max_players \/ 2/i);
  assert.match(sql, /v_roster_count <> v_run\.max_players/i);
  assert.match(sql, /submitted teams do not match the scheduled teams/i);
  assert.match(sql, /grant execute on function public\.create_scheduled_game[\s\S]*to authenticated/i);
  assert.match(sql, /grant execute on function public\.join_scheduled_game[\s\S]*to authenticated/i);
});
