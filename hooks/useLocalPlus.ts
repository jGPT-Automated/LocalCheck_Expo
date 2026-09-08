import { LOCALPLUS_DEV_DEFAULT } from "@/constants/flags";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

/**
 * The one place any surface asks "does the viewer have LocalPlus?".
 *
 * Truth is `profiles.is_pro`, which the DB derives from the subscriptions
 * table (RevenueCat webhooks, or the launch-day founding grant). FOUNDER and
 * STARTER tags carry LocalPlus regardless (see docs/runbooks/ACCOUNT_TAGS.md). Until the
 * real grant is in place we fall back to LOCALPLUS_DEV_DEFAULT.
 */
export function useLocalPlus(): boolean {
  const { isLocalPlus } = useApp();
  const { profile } = useAuth();

  if (isLocalPlus) return true;
  if (profile?.account_tag === "FOUNDER" || profile?.account_tag === "STARTER") {
    return true;
  }
  // profile loaded but no pro/tag signal yet → honour the dev default.
  return profile ? LOCALPLUS_DEV_DEFAULT : false;
}
