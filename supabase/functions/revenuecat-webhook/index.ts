// RevenueCat -> public.subscriptions -> profiles.is_pro.
//
// RevenueCat POSTs one event per subscriber state change. This function is the
// only writer of public.subscriptions from a real purchase; the launch-day
// FOUNDER grant writes the same table directly with billing_provider = 'promo'
// (see docs/runbooks/ACCOUNT_TAGS.md). The two never collide: they're keyed
// (user_id, billing_provider), so a promo row and a real store row can coexist
// for the same person, and private.sync_profile_is_pro grants is_pro if
// *either* qualifies.
//
// Auth: RevenueCat is configured with a single Authorization header value
// (Project settings -> Integrations -> Webhooks). No platform JWT — this is a
// server-to-server webhook, not a user request. verify_jwt = false in
// supabase/config.toml; this function checks its own secret instead.
//
// Ordering + races: RevenueCat delivers at-least-once (retries repeat the
// same event.id) and not-necessarily-in-order; event_timestamp_ms is
// documented as informational, and RevenueCat's own docs note
// BILLING_ISSUE/CANCELLATION/EXPIRATION can be dispatched with identical
// timestamps for genuinely different events. So dedup is by event id (an
// exact retry is a no-op), and the timestamp only rejects a strictly
// older/stale event, never a same-instant distinct one. The whole
// check-and-set happens in ONE database statement
// (public.apply_subscription_event) so it can't race with itself — doing the
// read here and the write after would let two concurrent calls both read the
// same last_event_ms/last_event_id and both pass.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  isSupabaseUserId,
  mapBillingProvider,
  msToIso,
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
    // The app requires Purchases.logIn(<supabase user id>) to succeed before
    // it will let anyone tap "subscribe" (see services/purchasesService.ts),
    // so a non-UUID app_user_id here means either a sandbox tester purchased
    // before ever signing in, or identification failed in a way the client
    // didn't catch. Either way there's no account to credit — log it loudly
    // so it can be reconciled by hand rather than silently dropped.
    console.error(
      "revenuecat-webhook: app_user_id is not a Supabase user id — cannot credit this purchase",
      { app_user_id: userId, event_type: event.type, product_id: event.product_id },
    );
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

  const { data: applied, error: rpcError } = await admin.rpc("apply_subscription_event", {
    p_user_id: userId,
    p_revenuecat_app_user_id: userId,
    p_original_app_user_id: event.original_app_user_id ?? null,
    p_product_id: event.product_id ?? null,
    p_entitlement_id: event.entitlement_ids?.[0] ?? "localplus",
    p_status: verdict.status,
    p_billing_provider: mapBillingProvider(event.store),
    p_will_renew: verdict.will_renew,
    p_current_period_starts_at: msToIso(event.purchased_at_ms),
    p_current_period_ends_at: msToIso(event.expiration_at_ms),
    p_trial_ends_at:
      (event.period_type ?? "").toUpperCase() === "TRIAL"
        ? msToIso(event.expiration_at_ms)
        : null,
    p_cancelled_at_mode: verdict.cancelledAtMode,
    p_expires_at: msToIso(event.expiration_at_ms),
    p_raw_payload: payload,
    p_event_id: event.id ?? null,
    p_event_ms: eventMs,
  });
  if (rpcError) {
    console.error("revenuecat-webhook: apply_subscription_event failed", rpcError.message);
    return json(500, { error: "Write failed" });
  }

  return json(200, { ok: true, applied: Boolean(applied) });
});
