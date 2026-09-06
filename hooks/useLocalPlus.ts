import { LOCALPLUS_DEV_DEFAULT } from "@/constants/flags";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

/**
 * The one place any surface asks "does the viewer have LocalPlus?".
 *
 * Truth is `profiles.is_pro`, which the DB derives from the subscriptions
 * table (RevenueCat webhooks, or the founding-member promo grant). Until that
 * grant is backfilled we fall back to LOCALPLUS_DEV_DEFAULT so the founding
 * cohort isn't locked out of what they were promised for free.
 */
export function useLocalPlus(): boolean {
  const { isLocalPlus } = useApp();
  const { profile } = useAuth();

  if (isLocalPlus) return true;
  if (profile?.is_founding_member) return true;
  // profile loaded but no pro/founding signal yet → honour the dev default.
  return profile ? LOCALPLUS_DEV_DEFAULT : false;
}
