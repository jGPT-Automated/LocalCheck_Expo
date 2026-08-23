import React from "react";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { normalizePlayerInitials } from "@/components/ui/playerIdentity";

interface PlayerAvatarProps {
  initials?: string;
  playerId?: string;
  name?: string;
  size?: number;
  style?: ViewStyle;
  invert?: boolean;
  accent?: boolean;
  ranked?: boolean;
  friend?: boolean;
  status?: "active" | "quiet" | "inactive";
}

export function PlayerAvatar({
  initials,
  playerId,
  name,
  size = 40,
  style,
  invert = false,
  accent = false,
  ranked = false,
  friend = false,
  status = "quiet",
}: PlayerAvatarProps) {
  const highlighted = accent || ranked;
  const displayInitials = normalizePlayerInitials(name || initials || playerId);
  const inactive = status === "inactive";
  const bg = inactive
    ? Colors.surface
    : invert
      ? Colors.surfaceSelected
      : Colors.surfaceHigh;
  const textColor = inactive ? Colors.mutedDark : Colors.text;
  const radius = Math.round(size * 0.18);
  const badgeSize = Math.max(13, Math.round(size * 0.24));
  const label = name
    ? `${name} avatar${friend ? ", friend" : ""}${ranked ? ", ranked" : ""}`
    : undefined;

  return (
    <View
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityRole={label ? "image" : undefined}
      style={[styles.wrap, { width: size, height: size }]}
    >
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor: bg,
            borderRadius: radius,
            borderColor: inactive ? Colors.borderSubtle : Colors.border,
          },
          highlighted ? styles.highlighted : null,
          style,
        ]}
      >
        <Text
          style={[styles.initials, highlighted && styles.highlightedInitials, { fontSize: size * 0.33, color: highlighted ? Colors.text : textColor }]}
        >
          {displayInitials}
        </Text>
      </View>
      {friend ? (
        <View style={[styles.friendBadge, {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          right: -Math.round(badgeSize * 0.18),
          bottom: -Math.round(badgeSize * 0.18),
        }]}>
          <Feather
            name="star"
            size={Math.max(7, Math.round(badgeSize * 0.5))}
            color={Colors.black}
          />
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
  highlighted: {
    backgroundColor: Colors.surfaceSelected,
    ...Platform.select({
      ios: { shadowColor: Colors.accent, shadowOpacity: 0.45, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
      web: { boxShadow: `0 0 10px ${Colors.accentGlow}` } as object,
    }),
  },
  highlightedInitials: { textShadowColor: Colors.accent, textShadowRadius: 7 },
  initials: {
    fontFamily: Typography.headingBold,
    letterSpacing: 0.5,
  },
  friendBadge: {
    position: "absolute",
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
