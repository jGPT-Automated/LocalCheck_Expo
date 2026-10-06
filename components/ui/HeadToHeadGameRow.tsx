import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import {
  gameFormatLabel,
  type HeadToHeadGame,
  signed,
  teamsLine,
} from "@/lib/headToHead";

/** One row of GAMES TOGETHER: W/L tile, format, who played, where, your score. */
export function HeadToHeadGameRow({
  game,
  onPress,
}: {
  game: HeadToHeadGame;
  onPress?: () => void;
}) {
  const place = `${game.courtName} · ${new Date(game.playedAtIso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })}`.toUpperCase();
  const footnote = !game.ranked
    ? "Unranked"
    : game.myEloDelta != null && game.myEloDelta !== 0
      ? signed(game.myEloDelta)
      : null;
  return (
    <Pressable
      accessibilityLabel={`${game.won ? "Win" : "Loss"} ${game.myScore} to ${game.theirScore}, ${teamsLine(game)}, ${place}`}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.tile, game.won ? styles.tileWin : styles.tileLoss]}>
        <Text style={[styles.tileText, game.won ? styles.tileTextWin : styles.tileTextLoss]}>
          {game.won ? "W" : "L"}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.format}>{gameFormatLabel(game)}</Text>
        <Text numberOfLines={1} style={styles.teams}>{teamsLine(game)}</Text>
        <Text numberOfLines={1} style={styles.place}>{place}</Text>
      </View>
      <View style={styles.result}>
        <Text style={styles.score}>{game.myScore}–{game.theirScore}</Text>
        {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 84,
    paddingVertical: Space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pressed: { opacity: 0.7 },
  tile: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },
  tileWin: { backgroundColor: Colors.text },
  tileLoss: { borderWidth: 1, borderColor: Colors.borderLight },
  tileText: { fontFamily: Typography.headingBold, fontSize: 20, lineHeight: 26 },
  tileTextWin: { color: Colors.black },
  tileTextLoss: { color: Colors.muted },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  format: { ...TextStyles.listName, fontSize: 16, lineHeight: 21, color: Colors.text },
  teams: { ...TextStyles.metadata, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  place: {
    ...TextStyles.caption,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 1.2,
    color: Colors.muted,
  },
  result: { alignItems: "flex-end" },
  score: { fontFamily: Typography.headingBold, fontSize: 24, lineHeight: 30, color: Colors.text },
  footnote: { ...TextStyles.metadata, color: Colors.textSecondary },
});
