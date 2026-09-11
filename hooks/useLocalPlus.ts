import { useEffect, useState } from "react";

import { LOCALPLUS_DEV_DEFAULT } from "@/constants/flags";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { subscribeLocalPlusFastPath } from "@/services/purchasesService";

/**
 * The one place any surface asks "does the viewer have LocalPlus?".
 *
 * Truth is `profiles.is_pro`, which the DB derives from the `subscriptions`
 * table — a real RevenueCat purchase (via the revenuecat-webhook edge
 * function), or a promo row we insert for the first-100 STARTER cohort (and
 * FOUNDER) on launch day. `account_tag` is cosmetic and does NOT grant access;
 * a STARTER's free year lapses when its promo row expires.
 *
 * Between "the SDK confirms a purchase" and "the webhook has written
 * profiles.is_pro", `isLocalPlus` is briefly stale — RevenueCat's own local
 * CustomerInfo (subscribeLocalPlusFastPath) is checked first so the unlock is
 * instant on this device; the server value stays authoritative everywhere
 * else (other devices, re-installs, App Review's own check).
 *
 * Until a real subscriptions row exists at all, we fall back to
 * LOCALPLUS_DEV_DEFAULT so nobody is wrongly locked out during development.
 */
export function useLocalPlus(): boolean {
  const { isLocalPlus } = useApp();
  const { profile } = useAuth();
  const [rcEntitlementActive, setRcEntitlementActive] = useState(false);

  useEffect(() => subscribeLocalPlusFastPath(setRcEntitlementActive), []);

  if (isLocalPlus) return true;
  if (rcEntitlementActive) return true;
  // profile loaded but no is_pro signal yet → honour the dev default.
  return profile ? LOCALPLUS_DEV_DEFAULT : false;
}
