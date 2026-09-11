import { useEffect, useState } from "react";

import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { subscribeLocalPlusFastPath } from "@/services/purchasesService";

/**
 * The one place any surface asks "does the viewer have LocalPlus?".
 *
 * Truth is `profiles.is_pro`, which the DB derives from the `subscriptions`
 * table — a real RevenueCat purchase (via the revenuecat-webhook edge
 * function), or a promo row we insert for FOUNDER, REVIEWER, and STARTER-via-
 * offer-code (see docs/runbooks/ACCOUNT_TAGS.md). `account_tag` itself grants
 * nothing on its own — with one deliberate exception below.
 *
 * Between "the SDK confirms a purchase" and "the webhook has written
 * profiles.is_pro", `isLocalPlus` is briefly stale — RevenueCat's own local
 * CustomerInfo (subscribeLocalPlusFastPath) is checked first so the unlock is
 * instant on this device; the server value stays authoritative everywhere
 * else (other devices, re-installs, App Review's own check).
 *
 * TEST-tagged accounts are the one standing exception: they're Jesse's QA
 * fixtures, kept fully unlocked indefinitely so they stay useful for testing
 * every other feature (leaderboard, history, court insights), independent of
 * any real grant. Every other account — including a brand-new sign-up — gets
 * the real answer: locked unless a real subscriptions row says otherwise.
 * There is no blanket "unlock everyone" fallback anymore.
 */
export function useLocalPlus(): boolean {
  const { isLocalPlus } = useApp();
  const { profile } = useAuth();
  const [rcEntitlementActive, setRcEntitlementActive] = useState(false);

  useEffect(() => subscribeLocalPlusFastPath(setRcEntitlementActive), []);

  if (isLocalPlus) return true;
  if (rcEntitlementActive) return true;
  if (profile?.account_tag === "TEST") return true;
  return false;
}
