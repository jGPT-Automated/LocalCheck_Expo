import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSupabaseUserId,
  mapBillingProvider,
  msToIso,
  verdictFor,
} from "./webhookLogic.ts";

test("recognizes a Supabase user id and rejects RevenueCat's anonymous ids", () => {
  assert.equal(isSupabaseUserId("8ea0f430-a83c-4aec-a9d6-c667f7dc0944"), true);
  assert.equal(isSupabaseUserId("$RCAnonymousID:61f0edc6c8a64f62"), false);
  assert.equal(isSupabaseUserId(undefined), false);
  assert.equal(isSupabaseUserId(""), false);
});

test("maps RevenueCat stores to the subscriptions.billing_provider check constraint", () => {
  assert.equal(mapBillingProvider("APP_STORE"), "app_store");
  assert.equal(mapBillingProvider("MAC_APP_STORE"), "app_store");
  assert.equal(mapBillingProvider("PLAY_STORE"), "play_store");
  assert.equal(mapBillingProvider("STRIPE"), "stripe");
  assert.equal(mapBillingProvider("PROMOTIONAL"), "promo");
  assert.equal(mapBillingProvider("ROKU"), "unknown");
  assert.equal(mapBillingProvider(undefined), "unknown");
});

test("converts epoch milliseconds to ISO, passing through null/undefined", () => {
  assert.equal(msToIso(1_757_000_000_000), new Date(1_757_000_000_000).toISOString());
  assert.equal(msToIso(null), null);
  assert.equal(msToIso(undefined), null);
  assert.equal(msToIso(Number.NaN), null);
});

test("a purchase or renewal grants access and clears any prior cancellation", () => {
  for (const type of ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"]) {
    const verdict = verdictFor(type, "NORMAL");
    assert.equal(verdict?.status, "active");
    assert.equal(verdict?.will_renew, true);
    assert.equal(verdict?.cancelledAtMode, "clear");
  }
});

test("a trial period is reported as trialing, not active", () => {
  const verdict = verdictFor("INITIAL_PURCHASE", "TRIAL");
  assert.equal(verdict?.status, "trialing");
});

test("cancellation keeps access (paid through period end) but stops renewal and stamps cancelled_at", () => {
  const verdict = verdictFor("CANCELLATION", "NORMAL");
  assert.equal(verdict?.status, "active");
  assert.equal(verdict?.will_renew, false);
  assert.equal(verdict?.cancelledAtMode, "now");
});

test("billing issues and expirations move status without touching cancelled_at", () => {
  assert.equal(verdictFor("BILLING_ISSUE", "NORMAL")?.status, "past_due");
  assert.equal(verdictFor("EXPIRATION", "NORMAL")?.status, "expired");
  assert.equal(verdictFor("REFUND", "NORMAL")?.status, "expired");
  assert.equal(verdictFor("EXPIRATION", "NORMAL")?.cancelledAtMode, "preserve");
  assert.equal(verdictFor("BILLING_ISSUE", "NORMAL")?.cancelledAtMode, "preserve");
});

test("unhandled event types (identity merges, unknown future types) return null", () => {
  assert.equal(verdictFor("TRANSFER", "NORMAL"), null);
  assert.equal(verdictFor("SUBSCRIBER_ALIAS", "NORMAL"), null);
  assert.equal(verdictFor("SOMETHING_NEW_APPLE_ADDS_LATER", "NORMAL"), null);
});
