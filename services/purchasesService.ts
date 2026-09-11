// Thin wrapper around react-native-purchases (RevenueCat). This is the only
// file that imports the SDK directly — every screen goes through here.
//
// Entitlement truth is still server-side: profiles.is_pro, derived from
// public.subscriptions, which only the revenuecat-webhook edge function (real
// purchases) or a launch-day promo row (FOUNDER/STARTER) writes. This service
// exists to (a) drive the purchase/restore/redeem UI and (b) give
// useLocalPlus() a same-device fast path so a purchase unlocks instantly
// instead of waiting on the webhook -> DB -> profile-refetch round trip.
//
// iOS only for now — there is no EXPO_PUBLIC_REVENUECAT_ANDROID_KEY and no
// Android product configured. Every export below no-ops safely off iOS or
// without a configured key (e.g. Expo Go, web preview) rather than throwing.
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

/** Must match the RevenueCat entitlement identifier and the migration's
 * default (`services/gameService` writes nothing here — only the webhook and
 * the promo-row runbook set entitlement_id, both to this same string). */
export const LOCALPLUS_ENTITLEMENT_ID = "localplus";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

let configured = false;
let lastKnownActive = false;
const fastPathListeners = new Set<(active: boolean) => void>();

function notifyFastPath(active: boolean) {
  lastKnownActive = active;
  fastPathListeners.forEach((listener) => listener(active));
}

export function hasActiveEntitlement(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[LOCALPLUS_ENTITLEMENT_ID]);
}

/** Configures the SDK once. Call at app start (see app/_layout.tsx). Safe to
 * call repeatedly; safe on platforms/builds with no key (no-ops). */
export function initPurchases(): void {
  if (configured || Platform.OS !== "ios" || !IOS_API_KEY) return;
  Purchases.configure({ apiKey: IOS_API_KEY });
  configured = true;
  Purchases.addCustomerInfoUpdateListener((info) =>
    notifyFastPath(hasActiveEntitlement(info)),
  );
  void Purchases.getCustomerInfo()
    .then((info) => notifyFastPath(hasActiveEntitlement(info)))
    .catch(() => {
      /* first-launch network hiccup — the listener above will catch up */
    });
}

/** Ties purchases to the signed-in Supabase user so RevenueCat's app_user_id
 * IS the profiles.id the webhook writes against. Call on sign-in. */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!configured) return;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    notifyFastPath(hasActiveEntitlement(customerInfo));
  } catch (error) {
    console.warn("purchasesService: logIn failed", error);
  }
}

/** Breaks the RevenueCat<->account link on sign-out so the next signed-in
 * account (a different person on a shared device) never inherits this one's
 * cached entitlement state. */
export async function resetPurchaser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Throws if already logged out / anonymous — nothing to do.
  } finally {
    notifyFastPath(false);
  }
}

/** The one package LocalPlus sells. Null if offerings aren't configured yet
 * (e.g. the App Store subscription is still missing price/availability). */
export async function fetchLocalPlusPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.monthly ?? null;
  } catch (error) {
    console.warn("purchasesService: getOfferings failed", error);
    return null;
  }
}

export type PurchaseOutcome =
  | { outcome: "purchased"; isLocalPlus: boolean }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

export async function purchaseLocalPlus(
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = hasActiveEntitlement(customerInfo);
    notifyFastPath(active);
    return { outcome: "purchased", isLocalPlus: active };
  } catch (error) {
    const rcError = error as { userCancelled?: boolean; message?: string };
    if (rcError.userCancelled) return { outcome: "cancelled" };
    return {
      outcome: "error",
      message: rcError.message ?? "Purchase failed. Try again.",
    };
  }
}

/** "Restore Purchases" — required by App Store review guidelines on any
 * screen that sells a subscription. */
export async function restorePurchases(): Promise<PurchaseOutcome> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const active = hasActiveEntitlement(customerInfo);
    notifyFastPath(active);
    return { outcome: "purchased", isLocalPlus: active };
  } catch (error) {
    const rcError = error as { message?: string };
    return {
      outcome: "error",
      message: rcError.message ?? "Restore failed. Try again.",
    };
  }
}

/** Apple's native "redeem a code" sheet — for the first-100 STARTER offer
 * codes. iOS only; no-ops elsewhere. */
export async function redeemOfferCode(): Promise<void> {
  if (Platform.OS !== "ios" || !configured) return;
  try {
    await Purchases.presentCodeRedemptionSheet();
  } catch (error) {
    console.warn("purchasesService: redemption sheet failed", error);
  }
}

/** Reactive same-device fast path — see the module comment. Fires
 * immediately with the last known value, then on every RevenueCat update. */
export function subscribeLocalPlusFastPath(
  listener: (active: boolean) => void,
): () => void {
  fastPathListeners.add(listener);
  listener(lastKnownActive);
  return () => {
    fastPathListeners.delete(listener);
  };
}
