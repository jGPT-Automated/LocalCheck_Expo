import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";

interface LivePulseProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function LivePulse({ size = 8, color = Colors.accent, style }: LivePulseProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 2.2, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={[{ width: size * 2.5, height: size * 2.5, alignItems: "center", justifyContent: "center" }, style]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale: pulse }],
            opacity,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
  },
  dot: {
    position: "absolute",
  },
});
