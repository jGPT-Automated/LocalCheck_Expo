import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

let cachedPreference: boolean | null = null;
const listeners = new Set<(enabled: boolean) => void>();

function publish(enabled: boolean) {
  cachedPreference = enabled;
  listeners.forEach((listener) => listener(enabled));
}

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(
    cachedPreference,
  );

  useEffect(() => {
    let mounted = true;
    listeners.add(setReducedMotion);
    if (cachedPreference === null) {
      void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
        if (mounted) publish(enabled);
      });
    } else {
      setReducedMotion(cachedPreference);
    }

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      publish,
    );
    return () => {
      mounted = false;
      listeners.delete(setReducedMotion);
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
