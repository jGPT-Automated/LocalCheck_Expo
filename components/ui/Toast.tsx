import type { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext } from "react";
import { AccessibilityInfo, Platform } from "react-native";

type ToastInput = {
  title: string;
  body?: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
};

type ToastApi = { showToast: (toast: ToastInput) => void };
const ToastContext = createContext<ToastApi>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/** Action feedback stays tactile/accessibility-only; no temporary app banner. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const showToast = useCallback(({ title, body }: ToastInput) => {
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    AccessibilityInfo.announceForAccessibility([title, body].filter(Boolean).join(". "));
  }, []);

  return <ToastContext.Provider value={{ showToast }}>{children}</ToastContext.Provider>;
}
