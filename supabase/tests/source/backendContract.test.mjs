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
});
