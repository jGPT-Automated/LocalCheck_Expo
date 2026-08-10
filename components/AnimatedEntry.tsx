import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Springs children in on mount (scale + fade). Used for roster avatars so a
 * player checking in visibly "arrives" on every screen showing that court.
 * Core Animated API only — ships over OTA, no native module needed.
 */
export function AnimatedEntry({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        // damping ~1.0, response ~0.35s feel (see DESIGN.md §6)
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        delay,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, delay]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}
