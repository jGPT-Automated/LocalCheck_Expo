import { LOCALPLUS_DEV_DEFAULT } from "@/constants/flags";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

/**
 * The one place any surface asks "does the viewer have LocalPlus?".
 *
 * Truth is `profiles.is_pro`, which the DB derives from the `subscriptions`
 * table — a real RevenueCat purchase, or a promo row we insert for the
 * first-100 STARTER cohort (and FOUNDER) on launch day. `account_tag` is
 * cosmetic and does NOT grant access; a STARTER's free year lapses when its
 * promo row expires. Until any of that is in place we fall back to
 * LOCALPLUS_DEV_DEFAULT so nobody is wrongly locked out during development.
 */
export function useLocalPlus(): boolean {
  const { isLocalPlus } = useApp();
  const { profile } = useAuth();

  if (isLocalPlus) return true;
  // profile loaded but no is_pro signal yet → honour the dev default.
  return profile ? LOCALPLUS_DEV_DEFAULT : false;
}
