import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { formatDayLabel } from "@/lib/activityPresentation";
import { gameTitle, type HeadToHeadGame, teamsLine } from "@/lib/headToHead";

const TILE = 44;

/**
 * One row of GAMES TOGETHER: a W / L tile, "2v2 at Rancho", who played and
 * when, and your score with your ELO change under it. The date and "Casual"
 * never get cut: the names give way first.
 */
export function HeadToHeadGameRow({
  game,
  isLast = false,
  onPress,
}: {
  game: HeadToHeadGame;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const title = gameTitle(game);
  const lead = teamsLine(game);
  const day = formatDayLabel(game.playedAtIso);
  const tail = `· ${day}${game.ranked ? "" : " · Casual"}`;
  const delta = game.myEloDelta;
  return (
    <Pressable
      accessibilityHint={onPress ? "Opens the final game result" : undefined}
      accessibilityLabel={`${game.won ? "Win" : "Loss"}, ${title}, ${lead}, ${day}${
        game.scoresHidden ? ", score hidden" : `, ${game.myScore} to ${game.theirScore}`
      }`}
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
      <View style={[styles.body, !isLast && styles.separator]}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <View style={styles.subtitleLine}>
            <Text numberOfLines={1} style={[styles.subtitle, styles.shrink]}>
              {lead}
            </Text>
            <Text numberOfLines={1} style={[styles.subtitle, styles.tail]}>
              {tail}
            </Text>
          </View>
        </View>
        {game.scoresHidden ? (
          <Text numberOfLines={1} style={styles.hidden}>
            Score hidden
          </Text>
        ) : (
          <View style={styles.result}>
            <Text numberOfLines={1} style={styles.score}>
              <Text style={game.won ? styles.scoreWinner : styles.scoreLoser}>{game.myScore}</Text>
              <Text style={styles.scoreLoser}>–</Text>
              <Text style={game.won ? styles.scoreLoser : styles.scoreWinner}>{game.theirScore}</Text>
            </Text>
            {delta ? (
              <View style={styles.elo}>
                <Feather
                  color={delta > 0 ? Colors.win : Colors.loss}
                  name={delta > 0 ? "arrow-up" : "arrow-down"}
                  size={12}
                />
                <Text style={[styles.eloText, { color: delta > 0 ? Colors.win : Colors.loss }]}>
                  {Math.abs(delta)}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingLeft: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
  },
  // Full-width row: highlight, don't scale (Design and motion rules).
  pressed: { backgroundColor: Colors.surface },
  tile: {
    width: TILE,
    height: TILE,
    marginRight: Space.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },
  tileWin: { backgroundColor: Colors.text },
  tileLoss: { borderWidth: 1, borderColor: Colors.borderLight },
  tileText: { fontFamily: Typography.headingBold, fontSize: 20, lineHeight: 26 },
  tileTextWin: { color: Colors.black },
  tileTextLoss: { color: Colors.muted },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: TILE + Space.md * 2,
    paddingVertical: Space.md,
    paddingRight: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...TextStyles.listName, fontSize: 15, lineHeight: 20, color: Colors.text },
  subtitleLine: { flexDirection: "row", alignItems: "center", gap: Space.xs },
  subtitle: { ...TextStyles.metadata, color: Colors.textSecondary },
  shrink: { flexShrink: 1, minWidth: 0 },
  tail: { flexShrink: 0, color: Colors.muted },
  result: { flexShrink: 0, alignItems: "flex-end", gap: 2 },
  score: { ...TextStyles.stat, fontVariant: ["tabular-nums"] },
  scoreWinner: { color: Colors.text },
  scoreLoser: { color: Colors.textSecondary },
  elo: { flexDirection: "row", alignItems: "center", gap: 2 },
  eloText: {
    ...TextStyles.metadata,
    fontFamily: Typography.bodySemiBold,
    fontVariant: ["tabular-nums"],
  },
  hidden: { ...TextStyles.metadata, flexShrink: 0, color: Colors.muted },
});
