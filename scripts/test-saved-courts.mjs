// Disposable PostgreSQL 17 fixture; never connects to Supabase or a host DB.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
const env = { ...process.env };
for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"]) delete env[key];
const name = `localcheck-saved-courts-${process.pid}`;
const docker = (...args) => execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const sql = (source) => execFileSync("docker", ["--host=unix:///var/run/docker.sock", "exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { env, input: source, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function originalFunction(file, signature) {
  const source = read(file);
  const start = source.indexOf(`create or replace function ${signature}`);
  const end = source.indexOf("$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing baseline function: ${signature}`);
  return source.slice(start, end + 3);
}
let created = false;
try {
  docker("run", "--detach", "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17");
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { docker("exec", name, "pg_isready", "-U", "postgres", "-h", "127.0.0.1"); ready = true; break; } catch { await setTimeout(100); }
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not start");
  sql(read("supabase/tests/fixtures/saved_courts_bootstrap.sql"));
  sql([
    originalFunction("supabase/migrations/20261009120000_auto_check_in.sql", "public.auto_check_in_arrive("),
    originalFunction("supabase/migrations/20261009120000_auto_check_in.sql", "public.resume_auto_check_in("),
    originalFunction("supabase/migrations/20261012180000_qstash_timers.sql", "private.post_auto_check_in("),
  ].join("\n"));
  sql(read("supabase/migrations/20261029103544_localplus_saved_courts.sql"));
  sql(read("supabase/tests/database/localplus_saved_courts.sql"));
  // Two transactions race for the final slot. The second must see five after
  // acquiring the profile lock, rather than both inserting a fifth/sixth.
  const { spawn } = await import("node:child_process");
  const uid = "33333333-3333-4333-8333-333333333333";
  const court = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  sql(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select public.save_court('${court(2)}'); select public.save_court('${court(3)}'); select public.save_court('${court(4)}');`);
  const race = (n) => new Promise((resolve) => {
    const child = spawn("docker", ["--host=unix:///var/run/docker.sock", "exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], {env, stdio:["pipe","pipe","pipe"]});
    let error = "";
    child.stderr.on("data", data => { error += data; });
    child.on("exit", code => resolve({code,error}));
    child.stdin.end(`begin; set role authenticated; select set_config('request.jwt.claim.sub','${uid}',true); select public.save_court('${court(n)}'); select pg_sleep(0.2); commit;`);
  });
  const races = await Promise.all([race(5), race(6)]);
  if (races.filter(r=>r.code===0).length!==1 || !races.some(r=>r.error.includes("up to 5 courts"))) throw new Error("Concurrent sixth addition was not rejected");
  const count = sql(`select count(*) from saved_courts where user_id='${uid}';`);
  if (!/\b5\b/.test(count)) throw new Error("Concurrent additions violated cap");
  sql(read("supabase/rollbacks/20261029103544_localplus_saved_courts.sql"));
  sql(`do $$ begin if to_regclass('public.saved_courts') is not null then raise exception 'rollback kept table'; end if; end $$; set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false); do $$ begin if (public.auto_check_in_arrive('00000000-0000-4000-8000-000000000001')->>'status') <> 'pending' then raise exception 'rollback broke free arrival'; end if; end $$;`);
  console.log("Saved courts: owner RLS, paid/free boundary, duplicates, five-court limit, concurrent additions, per-court auto eligibility, pending cancellation and delayed-post guard verified in PostgreSQL 17.");
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally { if (created) docker("rm", "--force", name); }
