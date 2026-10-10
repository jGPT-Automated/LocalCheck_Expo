import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import type { FeedItem } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import {
  describeTimelineItem,
  formatDayLabel,
  type GameLine,
  type LineSegment,
  startsNewDay,
  type TimelineMarker,
} from "@/lib/activityPresentation";

const RAIL = 20;
const MARKER = 10;

/**
 * The one shared activity-timeline row: a rail with one marker per item, a day
 * header whenever the day changes, and two weights on the same rail. A game is
 * the notable event, a small card hanging off the rail; check-ins, check-outs
 * and visits stay single quiet lines. Every marker is the same circle; the
 * type is told by fill (game: orange; check-in: outlined; the rest: grey).
 *
 * Pass `previous` (the item above this one) so the row can start a new day and
 * know it is first; `isLast` ends the rail. See lib/activityPresentation.ts
 * for how raw events become "visit" and "checkin_burst" items upstream.
 */
export function ActivityRow({
  item,
  previous,
  isLast = false,
  showActor = false,
  onPress,
  onActorPress,
}: {
  item: FeedItem;
  previous?: FeedItem;
  isLast?: boolean;
  /** Lists that mix players (the court feed) lead each line with the name. */
  showActor?: boolean;
  onPress?: () => void;
  onActorPress?: () => void;
}) {
  const [burstExpanded, setBurstExpanded] = React.useState(false);
  const model = describeTimelineItem(item, { showActor });
  const isFirst = !previous;
  const isBurst = item.type === "checkin_burst";
  const handlePress = isBurst ? () => setBurstExpanded((open) => !open) : onPress;
  const canPress = Boolean(handlePress);

  return (
    <View>
      {startsNewDay(item, previous) ? (
        <DayHeader first={isFirst} label={formatDayLabel(item.occurredAtIso)} />
      ) : null}
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={[styles.railSegment, isFirst && styles.railHidden]} />
          <View style={[styles.marker, markerStyle[model.marker]]} />
          <View style={[styles.railSegment, isLast && styles.railHidden]} />
        </View>
        <View style={styles.copy}>
          <Pressable
            accessibilityHint={
              model.kind === "game"
                ? "Opens the final game result"
                : isBurst
                  ? "Shows who checked in"
                  : "Opens the related detail"
            }
            accessibilityLabel={model.accessibilityLabel}
            accessibilityRole={canPress ? "button" : undefined}
            disabled={!canPress}
            onPress={handlePress}
            style={({ pressed }) => [
              model.kind === "game" ? styles.card : styles.line,
              pressed && canPress && (model.kind === "game" ? styles.cardPressed : styles.linePressed),
            ]}
          >
            {model.kind === "game" ? (
              <>
                <GameLineView line={model.lines[0]} />
                <GameLineView line={model.lines[1]} />
                <Text numberOfLines={1} style={styles.caption}>
                  {model.caption}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.lineContent}>
                  {model.segments
                    .filter((segment) => segment.text)
                    .map((segment, index) => (
                      <SegmentText
                        key={index}
                        onActorPress={onActorPress}
                        segment={segment}
                      />
                    ))}
                </View>
                {burstExpanded && model.expandedText ? (
                  <Text style={styles.expanded}>{model.expandedText}</Text>
                ) : null}
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function DayHeader({ label, first }: { label: string; first: boolean }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.rail}>
        <View style={[styles.railSegment, first && styles.railHidden]} />
      </View>
      <Text accessibilityRole="header" style={[styles.headerText, first && styles.headerFirst]}>
        {label}
      </Text>
    </View>
  );
}

function SegmentText({
  segment,
  onActorPress,
}: {
  segment: LineSegment;
  onActorPress?: () => void;
}) {
  return (
    <Text
      numberOfLines={1}
      onPress={segment.actor ? onActorPress : undefined}
      style={[
        segment.tone === "name"
          ? styles.segmentName
          : segment.tone === "time"
            ? styles.segmentTime
            : styles.segmentText,
        segment.shrink ? styles.shrink : styles.fixed,
      ]}
    >
      {segment.text}
    </Text>
  );
}

function GameLineView({ line }: { line: GameLine }) {
  return (
    <View style={styles.gameLine}>
      <Text
        numberOfLines={1}
        style={[styles.gameName, line.winner ? styles.winnerText : styles.loserText]}
      >
        {line.name}
      </Text>
      <Text style={[styles.gameScore, line.winner ? styles.winnerText : styles.loserText]}>
        {line.score}
      </Text>
    </View>
  );
}

const markerStyle = StyleSheet.create({
  // Game: the notable event, filled orange.
  game: { backgroundColor: Colors.accent },
  // Check-in: outlined, so it reads as lighter than a game.
  checkin: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
  },
  // Check-out, visit, other: quiet grey.
  quiet: { backgroundColor: Colors.mutedDark },
} satisfies Record<TimelineMarker, object>);

const styles = StyleSheet.create({
  row: {
    paddingLeft: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "stretch",
  },
  rail: { width: RAIL, alignItems: "center", justifyContent: "center" },
  railSegment: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
  },
  railHidden: { backgroundColor: "transparent" },
  marker: {
    width: MARKER,
    height: MARKER,
    marginVertical: Space.xs,
    borderRadius: MARKER / 2,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: Space.sm,
    paddingRight: Layout.screenGutter,
    justifyContent: "center",
  },

  // ── Day header ──
  headerRow: {
    paddingLeft: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "stretch",
  },
  headerText: {
    ...TextStyles.labelSmall,
    marginLeft: Space.sm,
    paddingTop: Space.xl,
    paddingBottom: Space.xs,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: Colors.muted,
  },
  headerFirst: { paddingTop: Space.sm },

  // ── Quiet single line (check-in, check-out, visit) ──
  line: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: Radius.lg,
  },
  linePressed: { backgroundColor: Colors.surfacePressed },
  lineContent: { flexDirection: "row", alignItems: "center", gap: Space.xs },
  shrink: { flexShrink: 1, minWidth: 0 },
  fixed: { flexShrink: 0 },
  segmentName: { ...TextStyles.bodySmall, fontFamily: Typography.bodySemiBold, color: Colors.text },
  segmentText: { ...TextStyles.bodySmall, color: Colors.textSecondary },
  segmentTime: { ...TextStyles.bodySmall, color: Colors.muted },
  expanded: { ...TextStyles.metadata, paddingBottom: Space.sm, color: Colors.textSecondary },

  // ── Game card hanging off the rail ──
  card: {
    marginVertical: Space.xs,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  cardPressed: { backgroundColor: Colors.surfacePressed },
  gameLine: { flexDirection: "row", alignItems: "center", gap: Space.md },
  gameName: { ...TextStyles.listName, flex: 1, minWidth: 0 },
  gameScore: {
    ...TextStyles.statSmall,
    minWidth: 28,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  winnerText: { color: Colors.text },
  loserText: { color: Colors.textSecondary },
  caption: { ...TextStyles.labelSmall, marginTop: Space.xs, color: Colors.muted },
});
