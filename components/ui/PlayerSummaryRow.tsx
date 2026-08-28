import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors } from "@/constants/colors";
import type { Player } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

import { EloStat } from "./EloStat";

export function PlayerSummaryRow({
  player,
  detail,
  checkInCount,
  friend = false,
  ranked = false,
  inactive = false,
  onPress,
}: {
  player: Player;
  detail: string;
  checkInCount?: number;
  friend?: boolean;
  ranked?: boolean;
  inactive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Opens this player's profile"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <PlayerAvatar
        friend={friend}
        initials={player.avatar}
        name={player.name}
        playerId={player.id}
        ranked={ranked}
        size={42}
        status={inactive ? "inactive" : "quiet"}
      />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.name, inactive && styles.quiet]}>
          {player.name}
        </Text>
        <Text numberOfLines={1} style={styles.detail}>
          {detail}
        </Text>
      </View>
      {checkInCount !== undefined ? (
        <View
          accessibilityLabel={`${checkInCount} check-ins`}
          style={styles.checkIns}
        >
          <Text numberOfLines={1} style={styles.checkInLabel}>
            {checkInCount} {checkInCount === 1 ? "CHECK-IN" : "CHECK-INS"}
          </Text>
        </View>
      ) : null}
      <EloStat alignEnd value={player.elo} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    paddingHorizontal: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  pressed: { backgroundColor: Colors.surfacePressed },
  copy: { flex: 1, minWidth: 0 },
  name: {
    ...TextStyles.listName,
    color: Colors.text,
    textTransform: "uppercase",
  },
  quiet: { color: Colors.textSecondary },
  detail: {
    marginTop: 2,
    ...TextStyles.caption,
    color: Colors.muted,
    letterSpacing: 0,
  },
  checkIns: { minWidth: 68, alignItems: "center", justifyContent: "center" },
  checkInLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 0,
  },
});
