// A tiny PostgREST/GoTrue stand-in so the exported web app renders signed-in
// screens without touching any real Supabase project. Only the query
// features the app's services use are implemented (filters, embeds by
// foreign key, order, limit, exact counts, single-row reads, a few RPCs).
import { ME, tables } from "./fixtures.mjs";

const FK_COL = { courts: "court_id", courts_with_stats: "court_id", profiles: "user_id", matches: "match_id", runs: "run_id" };
const CHILD_COL = { runs: "run_id", matches: "match_id", activity_events: "activity_event_id" };

function splitTop(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseSelect(s) {
  return splitTop(s || "*").map((item) => {
    const paren = item.indexOf("(");
    if (paren < 0) return { col: item };
    const head = item.slice(0, paren);
    const sub = item.slice(paren + 1, -1);
    let alias = null, rest = head;
    if (head.includes(":")) [alias, rest] = head.split(":");
    let [table, hint] = rest.split("!");
    hint = hint?.replace(/^inner$/, "");
    return { alias: alias || table, table, hint: hint || null, sub: parseSelect(sub) };
  });
}

function shape(parentTable, row, spec) {
  const out = { ...row };
  for (const item of spec) {
    if (!item.table) continue;
    const target = tables[item.table] ?? [];
    let value;
    if (item.hint && item.hint.endsWith("_fkey")) {
      const col = item.hint.replace(`${parentTable}_`, "").replace(/_fkey$/, "");
      value = target.find((r) => r.id === row[col]) ?? null;
      value = value ? shape(item.table, value, item.sub) : null;
    } else if (FK_COL[item.table] && FK_COL[item.table] in row) {
      value = target.find((r) => r.id === row[FK_COL[item.table]]) ?? null;
      value = value ? shape(item.table, value, item.sub) : null;
    } else {
      const col = CHILD_COL[parentTable] ?? `${parentTable.replace(/s$/, "")}_id`;
      value = target.filter((r) => r[col] === row.id).map((r) => shape(item.table, r, item.sub));
    }
    out[item.alias] = value;
  }
  return out;
}

function cmp(a, b) {
  if (a == null || b == null) return NaN;
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== "boolean") return na - nb;
  const da = Date.parse(a), db = Date.parse(b);
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return String(a).localeCompare(String(b));
}

function test(row, col, expr) {
  let neg = false;
  if (expr.startsWith("not.")) { neg = true; expr = expr.slice(4); }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const raw = decodeURIComponent(expr.slice(dot + 1));
  const v = row[col];
  let ok;
  switch (op) {
    case "eq": ok = String(v) === raw; break;
    case "neq": ok = String(v) !== raw; break;
    case "gt": ok = cmp(v, raw) > 0; break;
    case "gte": ok = cmp(v, raw) >= 0; break;
    case "lt": ok = cmp(v, raw) < 0; break;
    case "lte": ok = cmp(v, raw) <= 0; break;
    case "is": ok = raw === "null" ? v == null : String(v) === raw; break;
    case "in": ok = raw.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(v)); break;
    case "ilike": case "like": {
      const re = new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*")}$`, "i");
      ok = re.test(String(v ?? ""));
      break;
    }
    default: ok = true;
  }
  return neg ? !ok : ok;
}

function orTest(row, expr) {
  return splitTop(expr.replace(/^\(|\)$/g, "")).some((part) => {
    if (part.startsWith("and(")) return splitTop(part.slice(4, -1)).every((p) => condTest(row, p));
    return condTest(row, part);
  });
}
function condTest(row, part) {
  const i = part.indexOf(".");
  return test(row, part.slice(0, i), part.slice(i + 1));
}

export function handleRest(method, url, headers, body = {}) {
  const u = new URL(url);
  const path = u.pathname.replace(/^\/rest\/v1\//, "");
  if (path.startsWith("rpc/")) return rpc(path.slice(4), u, body);
  if (method !== "GET" && method !== "HEAD") return { status: 201, body: method === "DELETE" ? "" : "[]" };
  const table = path;
  let rows = [...(tables[table] ?? [])];
  const spec = parseSelect(u.searchParams.get("select"));
  for (const [key, value] of u.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (key === "or") { rows = rows.filter((r) => orTest(r, value)); continue; }
    if (key.includes(".")) continue;
    rows = rows.filter((r) => test(r, key, value));
  }
  const order = u.searchParams.get("order");
  if (order) {
    const [col, dir, nulls] = order.split(",")[0].split(".");
    rows.sort((a, b) => (dir === "desc" ? -1 : 1) * (cmp(a[col], b[col]) || 0));
  }
  const total = rows.length;
  const offset = Number(u.searchParams.get("offset") ?? 0);
  const limit = u.searchParams.get("limit");
  if (limit) rows = rows.slice(offset, offset + Number(limit));
  const range = headers["range"];
  if (range) {
    const [a, b] = range.split("-").map(Number);
    rows = rows.slice(a, b + 1);
  }
  const shaped = rows.map((r) => shape(table, r, spec));
  const contentRange = total ? `0-${total - 1}/${total}` : "*/0";
  const accept = headers["accept"] ?? "";
  if (accept.includes("vnd.pgrst.object")) {
    if (shaped.length !== 1) {
      return { status: 406, body: JSON.stringify({ code: "PGRST116", details: `The result contains ${shaped.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" }) };
    }
    return { status: 200, body: JSON.stringify(shaped[0]), headers: { "content-range": contentRange } };
  }
  return { status: 200, body: method === "HEAD" ? "" : JSON.stringify(shaped), headers: { "content-range": contentRange } };
}

function rpc(name, u, body) {
  switch (name) {
    case "save_court": {
      if (tables.saved_courts.some((s) => s.court_id === body.p_court_id && s.user_id === ME)) return { status: 200, body: "true" };
      if (tables.saved_courts.length >= 5) return { status: 400, body: JSON.stringify({code:"23514",message:"LocalPlus: up to 5 courts"}) };
      tables.saved_courts.push({user_id:ME,court_id:body.p_court_id,auto_check_in_enabled:false,created_at:new Date().toISOString()});
      return {status:200,body:"true"};
    }
    case "resolve_saved_court_auto_check_in": {
      const row=tables.saved_courts.find(s=>s.user_id===ME&&s.court_id===body.p_court_id);
      if(row&&row.auto_check_in_enabled===null)row.auto_check_in_enabled=body.p_enabled;
      return {status:200,body:JSON.stringify(row?.auto_check_in_enabled??false)};
    }
    case "set_saved_court_auto_check_in": {
      const row=tables.saved_courts.find(s=>s.user_id===ME&&s.court_id===body.p_court_id);
      if (row) row.auto_check_in_enabled=body.p_enabled;
      return {status:200,body:JSON.stringify(Boolean(row))};
    }
    case "remove_saved_court": {
      const index=tables.saved_courts.findIndex(s=>s.user_id===ME&&s.court_id===body.p_court_id);
      if(index>=0)tables.saved_courts.splice(index,1);
      if(tables.profiles[0].local_court_id===body.p_court_id)tables.profiles[0].local_court_id=tables.saved_courts[0]?.court_id??null;
      return {status:200,body:"true"};
    }
    case "court_planned_times":
      return { status: 200, body: JSON.stringify(tables.planned_visits.map((v) => v.planned_at)) };
    case "safety_controls_available":
      return { status: 200, body: "true" };
    case "my_pending_auto_check_in":
      return { status: 200, body: "null" };
    case "list_blocked_users":
      return { status: 200, body: "[]" };
    default:
      return { status: 200, body: "null" };
  }
}

function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
const exp = Math.floor(Number(process.env.FAKE_NOW || Date.now()) / 1000) + 30 * 24 * 3600;
export const ACCESS_TOKEN = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: ME, role: "authenticated", aud: "authenticated", exp, email: "harness@example.com" })}.sig`;
export const USER = {
  id: ME,
  aud: "authenticated",
  role: "authenticated",
  email: "harness@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date(Date.now() - 60 * 864e5).toISOString(),
};
export const SESSION = {
  access_token: ACCESS_TOKEN,
  refresh_token: "harness-refresh",
  token_type: "bearer",
  expires_in: 30 * 24 * 3600,
  expires_at: exp,
  user: USER,
};

export function handleAuth(url) {
  const u = new URL(url);
  if (u.pathname.endsWith("/user")) return { status: 200, body: JSON.stringify(USER) };
  if (u.pathname.endsWith("/token")) return { status: 200, body: JSON.stringify(SESSION) };
  return { status: 200, body: "{}" };
}
