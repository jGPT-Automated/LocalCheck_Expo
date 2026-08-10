import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import type { Player } from "@/constants/data";

export function PersonTile({
  player,
  friend,
  onPress,
}: {
  player: Player;
  friend?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`View ${player.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <PlayerAvatar
        friend={friend}
        initials={player.avatar}
        name={player.name}
        playerId={player.id}
        size={42}
        status="active"
      />
      <Text numberOfLines={1} style={styles.name}>
        {player.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 62,
    minHeight: Layout.minTouchTarget + 28,
    alignItems: "center",
    gap: Space.sm,
    paddingVertical: Space.xs,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  name: {
    width: "100%",
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
