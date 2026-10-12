// Timed follow-ups on QStash (migration 20261012180000_qstash_timers.sql).
//
// Two callers, told apart by how they prove who they are:
//
//   1. The database (private.book_timer, via pg_net) asks to BOOK a timer.
//      It sends x-localcheck-webhook-secret, the same secret the push sender
//      uses. This function publishes a QStash message that will call this
//      same function at the timer's time, then records the message id.
//
//   2. QStash, at that time, asks to FIRE the timer. It signs the request
//      (Upstash-Signature). This function checks the signature with the
//      current and next signing keys and runs public.fire_timer. If QStash
//      delivered early (its free plan delays at most 7 days), the timer is
//      booked again for the rest of the wait.
//
// Anything else gets 401. A failure returns 500 so QStash tries again
// (3 times by default: after about 12 seconds, 2.5 minutes and 30 minutes).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Receiver } from "npm:@upstash/qstash@2";

import { deduplicationId, notBeforeSeconds, publishUrl } from "./timerLogic.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readBackendKey(collectionName: string, legacyName: string): string | null {
  const collection = Deno.env.get(collectionName);
  if (collection) {
    try {
      const keys = JSON.parse(collection) as Record<string, unknown>;
      const preferred = keys.default ?? Object.values(keys)[0];
      if (typeof preferred === "string" && preferred) return preferred;
    } catch {
      // Fall through while projects transition from legacy service-role keys.
    }
  }
  return Deno.env.get(legacyName) ?? null;
}

function destinationUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/timers`;
}

async function book(
  admin: SupabaseClient,
  supabaseUrl: string,
  timerId: string,
  runAt: string,
): Promise<string> {
  const qstashUrl = Deno.env.get("QSTASH_URL") ?? "https://qstash.upstash.io";
  const token = Deno.env.get("QSTASH_TOKEN");
  if (!token) throw new Error("QSTASH_TOKEN is not set");

  const notBefore = notBeforeSeconds(runAt, Date.now());
  const response = await fetch(publishUrl(qstashUrl, destinationUrl(supabaseUrl)), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Not-Before": String(notBefore),
      "Upstash-Deduplication-Id": deduplicationId(timerId, notBefore),
      "Upstash-Retries": "3",
    },
    body: JSON.stringify({ timer_id: timerId }),
  });
  const payload = await response.json().catch(() => ({})) as { messageId?: unknown; error?: unknown };
  if (!response.ok || typeof payload.messageId !== "string") {
    throw new Error(`QStash publish failed (${response.status}): ${String(payload.error ?? "")}`);
  }

  const { error } = await admin.rpc("timer_booked", {
    p_timer_id: timerId,
    p_message_id: payload.messageId,
  });
  if (error) throw new Error(`timer_booked failed: ${error.message}`);
  console.log(JSON.stringify({ event: "timer_booked", timer_id: timerId, not_before: notBefore }));
  return payload.messageId;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readBackendKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) return json(500, { error: "Server configuration is missing" });
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");

  // ── QStash: the timer is due ───────────────────────────────────────────────
  if (signature) {
    const currentSigningKey = Deno.env.get("QSTASH_CURRENT_SIGNING_KEY");
    const nextSigningKey = Deno.env.get("QSTASH_NEXT_SIGNING_KEY");
    if (!currentSigningKey || !nextSigningKey) {
      return json(500, { error: "QStash signing keys are not set" });
    }
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const valid = await receiver
      .verify({ signature, body: rawBody, url: destinationUrl(supabaseUrl) })
      .catch(() => false);
    if (!valid) return json(401, { error: "Invalid signature" });

    const body = JSON.parse(rawBody || "{}") as { timer_id?: unknown };
    if (typeof body.timer_id !== "string") return json(400, { error: "timer_id is required" });

    try {
      const { data, error } = await admin.rpc("fire_timer", { p_timer_id: body.timer_id });
      if (error) throw new Error(error.message);
      const result = data as { result?: string; run_at?: string } | null;
      if (result?.result === "early" && typeof result.run_at === "string") {
        await book(admin, supabaseUrl, body.timer_id, result.run_at);
      }
      console.log(JSON.stringify({ event: "timer_fired", timer_id: body.timer_id, result: result?.result }));
      return json(200, { ok: true, result: result?.result ?? null });
    } catch (error) {
      console.error(JSON.stringify({ event: "timer_fire_failed", timer_id: body.timer_id, error: String(error) }));
      return json(500, { error: "fire failed" });
    }
  }

  // ── The database: book a timer ─────────────────────────────────────────────
  const expectedSecret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
  const receivedSecret = request.headers.get("x-localcheck-webhook-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return json(401, { error: "Unauthorized" });
  }

  const body = JSON.parse(rawBody || "{}") as { action?: unknown; timer_id?: unknown; run_at?: unknown };
  if (body.action !== "book" || typeof body.timer_id !== "string" || typeof body.run_at !== "string") {
    return json(400, { error: "Expected {action: 'book', timer_id, run_at}" });
  }
  try {
    const messageId = await book(admin, supabaseUrl, body.timer_id, body.run_at);
    return json(200, { ok: true, message_id: messageId });
  } catch (error) {
    console.error(JSON.stringify({ event: "timer_book_failed", timer_id: body.timer_id, error: String(error) }));
    return json(500, { error: "book failed" });
  }
});
