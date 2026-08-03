import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

import { Motion } from "@/constants/layout";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

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
  const reducedMotion = useReducedMotion();
  const animateThisMount = useRef(reducedMotion === false).current;
  const scale = useRef(new Animated.Value(animateThisMount ? 0.96 : 1)).current;
  const opacity = useRef(new Animated.Value(animateThisMount ? 0 : 1)).current;

  useEffect(() => {
    if (!animateThisMount || reducedMotion !== false) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        delay,
        duration: Motion.state,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        delay,
        duration: Motion.state,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animateThisMount, scale, opacity, delay, reducedMotion]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}
