import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { useAuth } from "@/context/AuthContext";
import {
  fetchLocalPlusPackage,
  getIdentityState,
  type LocalPlusPlan,
  purchaseLocalPlus,
  retryIdentifyPurchaser,
  subscribeIdentityState,
} from "@/services/purchasesService";

/**
 * Buy one LocalPlus plan straight from Apple's purchase sheet.
 *
 * `available` is false when there's nothing to sell on this device (no
 * RevenueCat key, Expo Go without the Test Store key, or the offering isn't
 * set up). Callers fall back to the LocalPlus screen then.
 */
export function useLocalPlusPurchase(plan: LocalPlusPlan, enabled = true) {
  const { refreshProfile } = useAuth();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [checked, setChecked] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [identityState, setIdentityState] = useState(getIdentityState());

  useEffect(() => subscribeIdentityState(setIdentityState), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchLocalPlusPackage(plan).then((found) => {
      if (cancelled) return;
      setPkg(found);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, plan]);

  /** Resolves true when the purchase went through. */
  const buy = useCallback(async (): Promise<boolean> => {
    if (purchasing || !pkg) return false;
    // A purchase before RevenueCat knows the account would charge with no
    // account to credit. Retry identifying instead of buying.
    if (identityState !== "ready") {
      if (identityState === "error") void retryIdentifyPurchaser();
      Alert.alert("One moment", "Still connecting your account. Try again in a few seconds.");
      return false;
    }
    setPurchasing(true);
    const result = await purchaseLocalPlus(pkg);
    setPurchasing(false);
    if (result.outcome === "error") {
      Alert.alert("Couldn't complete purchase", result.message);
      return false;
    }
    if (result.outcome === "purchased") {
      void refreshProfile();
      return true;
    }
    return false;
  }, [identityState, pkg, purchasing, refreshProfile]);

  return {
    available: pkg !== null,
    checked,
    priceString: pkg?.product.priceString ?? null,
    purchasing,
    buy,
  };
}
