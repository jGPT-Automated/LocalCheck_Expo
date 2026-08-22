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

test("verified court creation is atomic, quota-bound, and duplicate-safe", async () => {
  const sql = await migrationEndingWith("_add_verified_court_creation.sql");
  assert.match(sql, /create or replace function public\.create_verified_court/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /count\(\*\)\s*>=\s*5/i);
  assert.match(sql, /<=\s*150/);
  assert.match(sql, /to service_role/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]*?to authenticated/i);
});

test("new verified courts do not require a paid, free, or private access classification", async () => {
  const sql = await migrationEndingWith("_make_court_access_optional.sql");
  assert.match(sql, /alter column access_type drop not null/i);
  assert.match(sql, /create or replace function public\.create_verified_court/i);
  assert.doesNotMatch(sql, /p_access_type/i);

  const verification = await readFile(new URL("../../functions/verify-court/courtVerification.ts", import.meta.url), "utf8");
  const edgeFunction = await readFile(new URL("../../functions/verify-court/index.ts", import.meta.url), "utf8");
  const courtService = await readFile(new URL("../../../services/courtService.ts", import.meta.url), "utf8");
  const modal = await readFile(new URL("../../../components/AddCourtModal.tsx", import.meta.url), "utf8");
  for (const source of [verification, edgeFunction, courtService, modal]) {
    assert.doesNotMatch(source, /accessType|ACCESS_OPTIONS|p_access_type/);
  }
  assert.doesNotMatch(modal, />ACCESS</);
  assert.match(edgeFunction, /store:\s*false/);
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
  assert.match(sql, /alter table public\.user_blocks enable row level security/i);
  assert.match(sql, /alter table public\.user_reports enable row level security/i);
  assert.match(sql, /list_blocked_users[\s\S]*where block\.blocker_id = \(select auth\.uid\(\)\)/i);
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

test("scheduled games produce one team result with participant review", async () => {
  const sql = await migrationEndingWith("_add_scheduled_team_results.sql");
  for (const contract of [
    "matches_one_result_per_run_idx",
    "match_participant_reviews",
    "public.log_run_match",
    "public.review_run_match",
    "private.apply_scheduled_match_elo",
  ]) {
    assert.ok(sql.includes(contract), `missing scheduled-result contract ${contract}`);
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
  assert.match(sql, /create or replace function private\.is_match_participant/i);
  assert.match(sql, /from public\.match_participants[\s\S]*user_id\s*=\s*p_user_id/i);
  assert.match(sql, /drop policy if exists matches_select_visible on public\.matches/i);
  assert.match(
    sql,
    /create policy matches_select_visible[\s\S]*private\.is_match_participant\(matches\.id, \(select auth\.uid\(\)\)\)/i,
  );
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
  const backfillSql = await migrationEndingWith("_skip_stale_pending_push_notifications.sql");
  assert.doesNotMatch(deliverySql, /set push_status = 'skipped'/i);
  assert.match(backfillSql, /set push_status = 'skipped'/i);
  assert.match(backfillSql, /push_attempts = 0/i);
  assert.match(backfillSql, /push_sent_at is null/i);
});
