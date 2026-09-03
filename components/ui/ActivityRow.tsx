import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatActivityCopy,
  formatMatchSide,
} from "@/components/home/homePresentation";
import { Colors } from "@/constants/colors";
import type { FeedItem } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

export function ActivityRow({
  item,
  isFirst = false,
  isLast = false,
  quietRail = false,
  onPress,
  onActorPress,
}: {
  item: FeedItem;
  isFirst?: boolean;
  isLast?: boolean;
  quietRail?: boolean;
  onPress?: () => void;
  onActorPress?: () => void;
}) {
  const copy = formatActivityCopy(item);
  const isGame = item.type === "game_result" && Boolean(item.match);
  const winningSide =
    item.match?.winnerSide === "a"
      ? item.match.sideA
      : (item.match?.sideB ?? []);
  const losingSide =
    item.match?.winnerSide === "a"
      ? item.match.sideB
      : (item.match?.sideA ?? []);
  const winningScore =
    item.match?.winnerSide === "a" ? item.match.scoreA : item.match?.scoreB;
  const losingScore =
    item.match?.winnerSide === "a" ? item.match.scoreB : item.match?.scoreA;
  const nodeStyle = isGame
    ? styles.gameNode
    : quietRail && (item.type === "checkin" || item.type === "checkout")
      ? styles.quietNode
      : item.type === "checkin"
        ? styles.checkInNode
        : item.type === "checkout"
          ? styles.checkOutNode
          : styles.neutralNode;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {!isFirst ? (
          <View style={[styles.lineTop, quietRail && styles.quietLine]} />
        ) : (
          <View style={styles.lineCap} />
        )}
        <View style={[styles.node, nodeStyle]} />
        {!isLast ? (
          <View style={[styles.lineBottom, quietRail && styles.quietLine]} />
        ) : (
          <View style={styles.lineCap} />
        )}
      </View>

      <Pressable
        accessibilityHint={
          isGame ? "Opens the final game result" : "Opens the related detail"
        }
        accessibilityLabel={`${item.message}, ${item.timestamp}`}
        accessibilityRole={onPress ? "button" : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
      >
        {isGame && item.match ? (
          <View style={styles.gameLine}>
            <Text numberOfLines={2} style={styles.gameTeams}>
              <Text style={styles.winner}>{formatMatchSide(winningSide)}</Text>
              <Text style={styles.action}> beat </Text>
              <Text style={styles.loser}>{formatMatchSide(losingSide)}</Text>
              <Text style={styles.score}>
                , {winningScore}–{losingScore}
              </Text>
            </Text>
            <Text style={styles.time}>{item.timestamp}</Text>
          </View>
        ) : (
          <View style={styles.activityLine}>
            <Text numberOfLines={2} style={styles.sentence}>
              <Text
                onPress={onActorPress}
                suppressHighlighting={false}
                style={styles.actor}
              >
                {copy.actor}
              </Text>
              <Text style={styles.action}>
                {" "}
                {sentenceAction(item.type, copy.action)}
              </Text>
            </Text>
            <Text style={styles.time}>{item.timestamp}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function sentenceAction(type: FeedItem["type"], fallback: string): string {
  if (type === "checkin") return "checked in";
  if (type === "checkout") return "checked out";
  if (type === "run_started") return "scheduled a game";
  if (type === "new_court") return "added a court";
  return fallback.toLocaleLowerCase();
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingLeft: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "stretch",
  },
  rail: { width: 20, alignItems: "center", justifyContent: "center" },
  node: {
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 1,
  },
  checkInNode: {
    backgroundColor: Colors.textSecondary,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
  },
  checkOutNode: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.mutedDark,
  },
  quietNode: {
    width: 6,
    height: 6,
    backgroundColor: Colors.muted,
    borderWidth: 0,
  },
  gameNode: {
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  neutralNode: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  lineTop: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    minHeight: 18,
    marginBottom: 4,
    backgroundColor: Colors.border,
  },
  lineBottom: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    minHeight: 18,
    marginTop: 4,
    backgroundColor: Colors.border,
  },
  quietLine: { backgroundColor: Colors.mutedDark },
  lineCap: { flex: 1, width: StyleSheet.hairlineWidth },
  copy: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    marginLeft: Space.sm,
    paddingRight: Layout.screenGutter,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  pressed: { backgroundColor: Colors.surfacePressed },
  activityLine: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  sentence: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18 },
  actor: { fontFamily: Typography.bodySemiBold, color: Colors.text },
  action: { fontFamily: Typography.body, color: Colors.textSecondary },
  time: {
    flexShrink: 0,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  gameLine: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  gameTeams: {
    flex: 1,
    minWidth: 0,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  winner: { color: Colors.win, textTransform: "uppercase" },
  loser: { color: Colors.loss, textTransform: "uppercase" },
  score: { color: Colors.text, fontFamily: Typography.heading },
});
