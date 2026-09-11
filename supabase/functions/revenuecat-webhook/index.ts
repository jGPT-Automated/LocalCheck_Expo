// RevenueCat -> public.subscriptions -> profiles.is_pro.
//
// RevenueCat POSTs one event per subscriber state change. This function is the
// only writer of public.subscriptions from a real purchase; the launch-day
// STARTER/FOUNDER grant writes the same table directly with billing_provider
// = 'promo' (see docs/runbooks/ACCOUNT_TAGS.md) and never collides with this
// path (a user has one row; a real purchase upsert simply supersedes the promo
// one, per the trigger private.sync_profile_is_pro which only cares whether
// *any* row is active/trialing and unexpired).
//
// Auth: RevenueCat is configured with a single Authorization header value
// (Project settings -> Integrations -> Webhooks). No platform JWT — this is a
// server-to-server webhook, not a user request. verify_jwt = false in
// supabase/config.toml; this function checks its own secret instead.
//
// Ordering: RevenueCat delivers at-least-once and not-necessarily-in-order.
// Each event carries event_timestamp_ms; we only apply an event newer than the
// last one written for that subscriber (public.subscriptions.last_event_ms).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  isSupabaseUserId,
  mapBillingProvider,
  msToIso,
  resolveCancelledAt,
  verdictFor,
} from "./webhookLogic.ts";

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

// RevenueCat's documented webhook event shape (fields we use). Extra fields on
// the real payload are ignored; nothing here is exhaustive of their schema.
interface RevenueCatEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[];
  period_type?: string; // NORMAL | TRIAL | INTRO | PROMOTIONAL
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  store?: string; // APP_STORE | MAC_APP_STORE | PLAY_STORE | STRIPE | PROMOTIONAL | ...
  environment?: string; // SANDBOX | PRODUCTION
  cancel_reason?: string;
  expiration_reason?: string;
  transferred_from?: string[];
  transferred_to?: string[];
}

interface RevenueCatPayload {
  api_version?: string;
  event?: RevenueCatEvent;
}

// Existing row fields this function reads back before merging, so an event
// that doesn't speak to a field (e.g. a RENEWAL doesn't carry a cancellation
// reason) doesn't clobber it.
interface ExistingRow {
  cancelled_at: string | null;
  last_event_ms: number | null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER");
  const receivedAuth = request.headers.get("authorization");
  if (!expectedAuth || receivedAuth !== expectedAuth) {
    return json(401, { error: "Unauthorized" });
  }

  const payload = (await request.json().catch(() => null)) as RevenueCatPayload | null;
  const event = payload?.event;
  if (!event || typeof event.type !== "string") {
    return json(400, { error: "Malformed payload" });
  }

  // RevenueCat's dashboard "Send test event" — acknowledge, write nothing.
  if (event.type === "TEST") return json(200, { ok: true, skipped: "test_event" });

  // Rare identity-merge events. Handled manually if/when they occur rather
  // than guessed at automatically.
  if (event.type === "TRANSFER" || event.type === "SUBSCRIBER_ALIAS") {
    console.warn("revenuecat-webhook: unhandled identity event", {
      type: event.type,
      app_user_id: event.app_user_id,
      transferred_from: event.transferred_from,
      transferred_to: event.transferred_to,
    });
    return json(200, { ok: true, skipped: "identity_event" });
  }

  const userId = event.app_user_id ?? "";
  if (!isSupabaseUserId(userId)) {
    // The app always calls Purchases.logIn(<supabase user id>) before a
    // purchase is possible, so a non-UUID app_user_id here means the SDK
    // fired before login (or a sandbox tester used the anonymous id).
    console.warn("revenuecat-webhook: app_user_id is not a Supabase user id", userId);
    return json(200, { ok: true, skipped: "non_user_app_user_id" });
  }

  const verdict = verdictFor(event.type, event.period_type);
  if (!verdict) {
    console.warn("revenuecat-webhook: unhandled event type", event.type);
    return json(200, { ok: true, skipped: "unhandled_event_type" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readBackendKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) return json(500, { error: "Server configuration is missing" });
  const admin: SupabaseClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const eventMs = event.event_timestamp_ms ?? Date.now();

  const { data: existing, error: readError } = await admin
    .from("subscriptions")
    .select("cancelled_at,last_event_ms")
    .eq("user_id", userId)
    .maybeSingle<ExistingRow>();
  if (readError) {
    console.error("revenuecat-webhook: read failed", readError.message);
    return json(500, { error: "Read failed" });
  }

  // Out-of-order / duplicate delivery guard.
  if (existing?.last_event_ms != null && existing.last_event_ms >= eventMs) {
    return json(200, { ok: true, skipped: "stale_event" });
  }

  const cancelledAt = resolveCancelledAt(verdict, existing?.cancelled_at ?? null);

  const row = {
    user_id: userId,
    revenuecat_app_user_id: userId,
    original_app_user_id: event.original_app_user_id ?? null,
    product_id: event.product_id ?? null,
    entitlement_id: event.entitlement_ids?.[0] ?? "localplus",
    status: verdict.status,
    billing_provider: mapBillingProvider(event.store),
    will_renew: verdict.will_renew,
    current_period_starts_at: msToIso(event.purchased_at_ms),
    current_period_ends_at: msToIso(event.expiration_at_ms),
    trial_ends_at:
      (event.period_type ?? "").toUpperCase() === "TRIAL"
        ? msToIso(event.expiration_at_ms)
        : null,
    cancelled_at: cancelledAt,
    expires_at: msToIso(event.expiration_at_ms),
    raw_payload: payload,
    last_event_ms: eventMs,
    updated_at: new Date().toISOString(),
  };

  const { error: writeError } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });
  if (writeError) {
    console.error("revenuecat-webhook: write failed", writeError.message);
    return json(500, { error: "Write failed" });
  }

  return json(200, { ok: true });
});
