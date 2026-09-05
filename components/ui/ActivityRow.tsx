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
import { formatDurationMinutes, formatRelativeDay } from "@/lib/activityPresentation";

/**
 * The one shared activity-timeline row. Presence (checkin/checkout, or a
 * collapsed visit on a profile) stays compact and quiet — it's the ambient
 * signal. A game is the notable event and gets real visual weight: bigger,
 * score-forward, still on the same rail. See lib/activityPresentation.ts for
 * how raw events become "visit" and "checkin_burst" items upstream of this
 * component — it only decides how each type reads once it exists.
 */
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
  const [burstExpanded, setBurstExpanded] = React.useState(false);
  const isGame = item.type === "game_result" && Boolean(item.match);
  const isPresence =
    item.type === "checkin" || item.type === "checkout";

  const nodeStyle = isGame
    ? styles.gameNode
    : item.type === "visit"
      ? styles.visitNode
      : item.type === "checkin_burst"
        ? styles.checkInNode
        : quietRail && isPresence
          ? styles.quietNode
          : item.type === "checkin"
            ? styles.checkInNode
            : item.type === "checkout"
              ? styles.checkOutNode
              : styles.neutralNode;
  const nodeSize = item.type === "visit" ? styles.nodeLarge : null;

  const rowHeight = isGame
    ? styles.rowGame
    : item.type === "visit" || item.type === "checkin_burst"
      ? styles.rowMedium
      : styles.rowCompact;

  const handlePress = () => {
    if (item.type === "checkin_burst") {
      setBurstExpanded((expanded) => !expanded);
      return;
    }
    onPress?.();
  };
  const canPress = Boolean(onPress) || item.type === "checkin_burst";

  return (
    <View style={[styles.row, rowHeight]}>
      <View style={styles.rail}>
        {!isFirst ? (
          <View style={[styles.lineTop, quietRail && styles.quietLine]} />
        ) : (
          <View style={styles.lineCap} />
        )}
        <View style={[styles.node, nodeStyle, nodeSize]} />
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
        accessibilityRole={canPress ? "button" : undefined}
        disabled={!canPress}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.copy,
          rowHeight,
          pressed && canPress && styles.pressed,
        ]}
      >
        {isGame && item.match ? (
          <GameContent item={item} />
        ) : item.type === "visit" ? (
          <VisitContent item={item} />
        ) : item.type === "checkin_burst" ? (
          <BurstContent expanded={burstExpanded} item={item} />
        ) : (
          <PresenceContent item={item} onActorPress={onActorPress} />
        )}
      </Pressable>
    </View>
  );
}

function PresenceContent({
  item,
  onActorPress,
}: {
  item: FeedItem;
  onActorPress?: () => void;
}) {
  const copy = formatActivityCopy(item);
  return (
    <View style={styles.presenceLine}>
      <Text numberOfLines={1} style={styles.sentence}>
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
  );
}

function GameContent({ item }: { item: FeedItem }) {
  const match = item.match!;
  const winningSide = match.winnerSide === "a" ? match.sideA : match.sideB;
  const losingSide = match.winnerSide === "a" ? match.sideB : match.sideA;
  const winningScore =
    match.winnerSide === "a" ? match.scoreA : match.scoreB;
  const losingScore = match.winnerSide === "a" ? match.scoreB : match.scoreA;

  return (
    <View style={styles.gameBlock}>
      <View style={styles.gameHeader}>
        <Text style={styles.gameLabel}>GAME · FINAL</Text>
        <Text style={styles.time}>{item.timestamp}</Text>
      </View>
      <View style={styles.gameSide}>
        <Text numberOfLines={1} style={styles.gameName}>
          {formatMatchSide(winningSide)}
        </Text>
        <View style={styles.gameScoreGroup}>
          <Text style={styles.winTag}>WIN</Text>
          <Text style={[styles.gameScore, styles.winnerScore]}>
            {winningScore}
          </Text>
        </View>
      </View>
      <View style={styles.gameSide}>
        <Text numberOfLines={1} style={styles.gameName}>
          {formatMatchSide(losingSide)}
        </Text>
        <Text style={styles.gameScore}>{losingScore}</Text>
      </View>
      {item.courtName ? (
        <Text numberOfLines={1} style={styles.gameCourt}>
          {item.courtName}
        </Text>
      ) : null}
    </View>
  );
}

function VisitContent({ item }: { item: FeedItem }) {
  const duration = formatDurationMinutes(item.visit?.durationMinutes ?? null);
  const day = item.visit ? formatRelativeDay(item.visit.checkOutIso) : "";
  return (
    <View style={styles.visitBlock}>
      <Text style={styles.visitLabel}>VISIT</Text>
      <Text numberOfLines={1} style={styles.visitCourt}>
        {item.courtName ?? "A court"}
      </Text>
      <Text style={styles.visitMeta}>
        {duration}
        {day ? ` · ${day}` : ""}
      </Text>
    </View>
  );
}

function BurstContent({
  item,
  expanded,
}: {
  item: FeedItem;
  expanded: boolean;
}) {
  const burst = item.burst;
  const names = burst?.playerNames ?? [];
  const preview =
    names.length > 3
      ? `${names.slice(0, 3).join(", ")} +${names.length - 3}`
      : names.join(", ");
  return (
    <View style={styles.visitBlock}>
      <Text style={styles.visitLabel}>{burst?.count ?? 0} PEOPLE CHECKED IN</Text>
      <Text numberOfLines={expanded ? undefined : 1} style={styles.visitCourt}>
        {expanded ? names.join(", ") : preview}
      </Text>
      <Text style={styles.visitMeta}>{item.timestamp}</Text>
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
    paddingLeft: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "stretch",
  },
  rowCompact: { minHeight: 56 },
  rowMedium: { minHeight: 72 },
  rowGame: { minHeight: 96 },
  rail: { width: 20, alignItems: "center", justifyContent: "center" },
  node: {
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 1,
  },
  nodeLarge: { width: 11, height: 11, borderRadius: 5.5 },
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
  visitNode: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
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
    minHeight: 14,
    marginBottom: 4,
    backgroundColor: Colors.border,
  },
  lineBottom: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    minHeight: 14,
    marginTop: 4,
    backgroundColor: Colors.border,
  },
  quietLine: { backgroundColor: Colors.mutedDark },
  lineCap: { flex: 1, width: StyleSheet.hairlineWidth },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: Space.sm,
    paddingRight: Layout.screenGutter,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  pressed: { backgroundColor: Colors.surfacePressed },

  // ── Presence (checkin/checkout) — compact, no card, ambient ──
  presenceLine: { flexDirection: "row", alignItems: "center", gap: Space.sm },
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

  // ── Game — the notable event, score carries the weight ──
  gameBlock: { paddingVertical: Space.sm, gap: 3 },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gameLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  gameSide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
  },
  gameName: {
    flex: 1,
    minWidth: 0,
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.text,
    textTransform: "uppercase",
  },
  gameScoreGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  gameScore: {
    fontFamily: Typography.headingBold,
    fontSize: 18,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  winnerScore: { color: Colors.accent },
  winTag: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1,
  },
  gameCourt: {
    marginTop: 2,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
  },

  // ── Visit / burst — medium weight, profile & grouped-arrival context ──
  visitBlock: { paddingVertical: Space.xs, gap: 2 },
  visitLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  visitCourt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.text,
  },
  visitMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
  },
});
