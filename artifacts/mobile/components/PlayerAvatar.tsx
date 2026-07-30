import React from "react";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

interface PlayerAvatarProps {
  initials: string;
  size?: number;
  style?: ViewStyle;
  invert?: boolean;
  accent?: boolean;
  ranked?: boolean;
  friend?: boolean;
}

export function PlayerAvatar({
  initials,
  size = 40,
  style,
  invert = false,
  accent = false,
  ranked = false,
  friend = false,
}: PlayerAvatarProps) {
  const highlighted = accent || ranked;
  const bg = invert ? Colors.surfaceHigh : Colors.surfaceHigh;
  const textColor = Colors.text;
  const radius = Math.round(size * 0.18);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor: bg,
            borderRadius: radius,
            borderColor: highlighted ? Colors.accent : Colors.border,
          },
          highlighted ? styles.ranked : styles.elevated,
          style,
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.33, color: textColor }]}>
          {initials}
        </Text>
      </View>
      {friend ? (
        <View style={styles.friendBadge}>
          <Feather name="star" size={Math.max(7, size * 0.18)} color={Colors.black} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  elevated: {
    shadowColor: Colors.black,
    shadowOpacity: 0.32,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ranked: {
    shadowColor: Colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  initials: {
    fontFamily: Typography.heading,
    letterSpacing: 0.5,
  },
  friendBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
