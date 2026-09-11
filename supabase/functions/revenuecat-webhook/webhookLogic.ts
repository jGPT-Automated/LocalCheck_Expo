// Pure mapping logic for the RevenueCat webhook, isolated from Deno.serve /
// Supabase I/O so it can run under Node's test runner (see webhookLogic.test.mts).

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSupabaseUserId(value: string | undefined | null): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

export function mapBillingProvider(store: string | undefined): string {
  switch ((store ?? "").toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "app_store";
    case "PLAY_STORE":
      return "play_store";
    case "STRIPE":
      return "stripe";
    case "PROMOTIONAL":
      return "promo";
    default:
      return "unknown";
  }
}

export function msToIso(ms: number | null | undefined): string | null {
  return typeof ms === "number" && Number.isFinite(ms)
    ? new Date(ms).toISOString()
    : null;
}

export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type Verdict = {
  status: SubscriptionStatus;
  will_renew: boolean | null;
  clearsCancelledAt: boolean;
  setsCancelledAtNow: boolean;
};

/**
 * One switch, one place, mapping every RevenueCat event type this project
 * handles to the subscription row it produces. Unlisted/unknown types (e.g.
 * TRANSFER, SUBSCRIBER_ALIAS) return null and are logged + skipped by the
 * caller rather than guessed at — they're rare, and a wrong guess is worse
 * than a 200 no-op.
 */
export function verdictFor(
  eventType: string,
  periodType: string | undefined,
): Verdict | null {
  const trial = (periodType ?? "").toUpperCase() === "TRIAL";
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
      return {
        status: trial ? "trialing" : "active",
        will_renew: true,
        clearsCancelledAt: true,
        setsCancelledAtNow: false,
      };
    case "NON_RENEWING_PURCHASE":
      return {
        status: "active",
        will_renew: false,
        clearsCancelledAt: true,
        setsCancelledAtNow: false,
      };
    case "CANCELLATION":
      // Auto-renew turned off; the grant is still valid until expiration_at_ms.
      return {
        status: "active",
        will_renew: false,
        clearsCancelledAt: false,
        setsCancelledAtNow: true,
      };
    case "BILLING_ISSUE":
      return {
        status: "past_due",
        will_renew: true,
        clearsCancelledAt: false,
        setsCancelledAtNow: false,
      };
    case "SUBSCRIPTION_PAUSED":
      return {
        status: "inactive",
        will_renew: false,
        clearsCancelledAt: false,
        setsCancelledAtNow: false,
      };
    case "EXPIRATION":
    case "REFUND":
      return {
        status: "expired",
        will_renew: false,
        clearsCancelledAt: false,
        setsCancelledAtNow: false,
      };
    default:
      return null;
  }
}

/** Resolves the `cancelled_at` column for an upsert given the verdict and
 *  whatever the row already had (a RENEWAL, say, must not erase a prior
 *  cancellation timestamp it has no opinion on). */
export function resolveCancelledAt(
  verdict: Verdict,
  existingCancelledAt: string | null,
): string | null {
  if (verdict.setsCancelledAtNow) return new Date().toISOString();
  if (verdict.clearsCancelledAt) return null;
  return existingCancelledAt;
}
