import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { Durations, Ease, Springs } from "@/constants/motion";
import { TextStyles, Typography } from "@/constants/typography";

/**
 * A short confirmation that drops in from the top after an action (check-in,
 * game logged) and can be swiped up to dismiss. Hides itself after a few
 * seconds. One at a time; a new one replaces the old.
 */

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

const VISIBLE_MS = 3500;
const HIDDEN_Y = -160;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastInput & { key: number }) | null>(null);
  const showToast = useCallback((next: ToastInput) => {
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setToast({ ...next, key: Date.now() });
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? <ToastView key={toast.key} onGone={() => setToast(null)} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onGone }: { toast: ToastInput; onGone: () => void }) {
  const { top } = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : HIDDEN_Y);
  const opacity = useSharedValue(reduced ? 0 : 1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (reduced) {
      opacity.set(withTiming(0, { duration: Durations.small }, () => scheduleOnRN(onGone)));
    } else {
      y.set(withTiming(HIDDEN_Y, { duration: 220, easing: Ease.out }, () => scheduleOnRN(onGone)));
    }
  }, [onGone, opacity, reduced, y]);

  useEffect(() => {
    if (reduced) opacity.set(withTiming(1, { duration: Durations.small }));
    else y.set(withSpring(0, Springs.sheet));
    timer.current = setTimeout(hide, VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hide, opacity, reduced, y]);

  // Plain RN-side functions; worklets hand off to them with scheduleOnRN.
  const pauseTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const restartTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, VISIBLE_MS);
  }, [hide]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      scheduleOnRN(pauseTimer);
    })
    .onUpdate((event) => {
      // Up moves freely; down resists.
      y.set(event.translationY < 0 ? event.translationY : event.translationY * 0.15);
    })
    .onEnd((event) => {
      if (event.translationY < -30 || event.velocityY < -500) {
        y.set(withTiming(HIDDEN_Y, { duration: 200, easing: Ease.out }, () => scheduleOnRN(onGone)));
      } else {
        y.set(withSpring(0, { ...Springs.snapBack, velocity: event.velocityY }));
        scheduleOnRN(restartTimer);
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(hide);
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
    opacity: opacity.get(),
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { top: top + Space.sm }, style]}
      >
        <View style={styles.icon}>
          <Feather color={Colors.black} name={toast.icon ?? "check"} size={15} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{toast.title}</Text>
          {toast.body ? <Text numberOfLines={2} style={styles.body}>{toast.body}</Text> : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: Space.lg,
    right: Space.lg,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceHigh,
    shadowColor: Colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  icon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: Colors.accent,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: Typography.heading, fontSize: 15, letterSpacing: 0.6, color: Colors.text },
  body: { ...TextStyles.caption, lineHeight: 15, color: Colors.textSecondary },
});
