import React from "react";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { AccountTag } from "@/constants/data";
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
  /** Account tag treatment — see docs/runbooks/ACCOUNT_TAGS.md. FOUNDER/STARTER get the
   *  faint diagonal accent print; REVIEWER shows the Apple mark in place of
   *  initials. */
  tag?: AccountTag | null;
  status?: "active" | "quiet" | "inactive";
  foregroundColor?: string;
}

/** Faint diagonal bands behind the initials — the founding-member "STARTER" mark. */
function StarterPrint({ size }: { size: number }) {
  return (
    <Svg
      height={size}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={size}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Rect
          key={i}
          x={size * (i * 0.3 - 0.35)}
          y={-size}
          width={size * 0.14}
          height={size * 3}
          fill={Colors.accent}
          opacity={i % 2 === 0 ? 0.22 : 0.1}
          transform={`rotate(38 ${size / 2} ${size / 2})`}
        />
      ))}
    </Svg>
  );
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
  tag = null,
  status = "quiet",
  foregroundColor,
}: PlayerAvatarProps) {
  const highlighted = accent || ranked;
  const displayInitials = normalizePlayerInitials(name || initials || playerId);
  const inactive = status === "inactive";
  const printed = (tag === "FOUNDER" || tag === "STARTER") && !inactive;
  const appleMark = tag === "REVIEWER" && !inactive;
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
            borderColor: printed
              ? Colors.accentBorder
              : inactive
                ? Colors.borderSubtle
                : Colors.border,
            overflow: "hidden",
          },
          highlighted ? styles.highlighted : null,
          style,
        ]}
      >
        {printed ? <StarterPrint size={size} /> : null}
        {appleMark ? (
          <FontAwesome
            name="apple"
            size={size * 0.5}
            color={foregroundColor ?? (highlighted ? Colors.text : textColor)}
          />
        ) : (
          <Text
            style={[
              styles.initials,
              highlighted && styles.highlightedInitials,
              {
                fontSize: size * 0.33,
                color:
                  foregroundColor ?? (highlighted ? Colors.text : textColor),
              },
            ]}
          >
            {displayInitials}
          </Text>
        )}
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
