import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import type { FeedItem } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import {
  describeTimelineItem,
  formatClock,
  formatDayLabel,
  formatDurationMinutes,
  shortAgo,
  startsNewDay,
} from "@/lib/activityPresentation";

type Kind = "in" | "out" | "game" | "plan" | "other";

function kindOf(item: FeedItem): Kind {
  switch (item.type) {
    case "checkin":
    case "checkin_burst":
      return "in";
    case "checkout":
    case "visit":
      return "out";
    case "game_result":
    case "run_result":
      return "game";
    case "run_started":
      return "plan";
    default:
      return "other";
  }
}

/**
 * The one shared activity row (court-flow feed): every row the same height,
 * an icon tile on the left that says what happened (small orange dot for a
 * check-in, small grey dot for a check-out, VS for a game result, a
 * calendar for a scheduled game), the sentence and a quiet detail line, then
 * the score and time on the right. Day headers split the days.
 *
 * Pass `previous` (the item above this one) so the row knows when a new day
 * starts. See lib/activityPresentation.ts for how raw events become "visit"
 * and "checkin_burst" items upstream.
 */
export function ActivityRow({
  item,
  previous,
  showActor = false,
  onPress,
  onActorPress,
}: {
  item: FeedItem;
  previous?: FeedItem;
  /** Kept for callers; the last row no longer needs closing. */
  isLast?: boolean;
  /** Lists that mix players (the court feed) lead each line with the name. */
  showActor?: boolean;
  onPress?: () => void;
  onActorPress?: () => void;
}) {
  const [burstExpanded, setBurstExpanded] = React.useState(false);
  const model = describeTimelineItem(item, { showActor });
  const kind = kindOf(item);
  const isBurst = item.type === "checkin_burst";
  const handlePress = isBurst ? () => setBurstExpanded((open) => !open) : onPress;
  const actor = item.playerName.trim() || "Someone";
  const court = item.courtName?.trim();

  let who = "";
  let what = "";
  let meta = "";
  let score: string | null = null;
  if (model.kind === "game") {
    const [win, lose] = model.lines;
    who = win.name;
    what = `def. ${lose.name}`;
    score = `${win.score}–${lose.score}`;
    meta = [item.match?.ranked === false ? "Casual" : "Ranked", showActor ? null : court].filter(Boolean).join(" · ");
  } else if (item.type === "visit") {
    // An earlier day: one row, how long they played and when they left.
    const played = formatDurationMinutes(item.visit?.durationMinutes ?? null);
    who = showActor ? actor : "";
    what = showActor ? `played ${played}` : `Played ${played}${court ? ` at ${court}` : ""}`;
    meta = `Checked out ${formatClock(item.visit?.checkOutIso ?? item.occurredAtIso)}`;
  } else if (isBurst) {
    const count = item.burst?.count ?? item.burst?.playerNames.length ?? 0;
    who = `${count} people`;
    what = "checked in";
    const names = item.burst?.playerNames ?? [];
    meta = burstExpanded || names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
  } else {
    const verb =
      item.type === "checkin"
        ? "checked in"
        : item.type === "checkout"
          ? "checked out"
          : item.type === "run_started"
            ? "scheduled a game"
            : item.type === "new_court"
              ? "added a court"
              : model.kind === "line"
                ? model.segments.filter((s) => s.tone !== "name").map((s) => s.text).join(" ")
                : "";
    who = showActor ? actor : "";
    what = showActor ? verb : `${verb.charAt(0).toUpperCase()}${verb.slice(1)}${court ? ` at ${court}` : ""}`;
    // Today's check-out knows how long they played.
    meta =
      item.type === "checkout" && item.visit
        ? `Played ${formatDurationMinutes(item.visit.durationMinutes)} · ${formatClock(item.occurredAtIso)}`
        : formatClock(item.occurredAtIso);
  }

  return (
    <View>
      {startsNewDay(item, previous) ? <DayHeader first={!previous} label={formatDayLabel(item.occurredAtIso)} /> : null}
      <Pressable
        accessibilityHint={kind === "game" ? "Opens the final game result" : isBurst ? "Shows who checked in" : undefined}
        accessibilityLabel={model.accessibilityLabel}
        accessibilityRole={handlePress ? "button" : undefined}
        disabled={!handlePress}
        onPress={handlePress}
        style={({ pressed }) => [styles.row, pressed && handlePress && styles.rowPressed]}
      >
        <IconTile item={item} kind={kind} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {who ? (
              <Text onPress={onActorPress && kind !== "game" ? onActorPress : undefined} style={styles.who}>
                {who}{" "}
              </Text>
            ) : null}
            {what}
          </Text>
          {meta ? <Text numberOfLines={burstExpanded ? 3 : 1} style={styles.meta}>{meta}</Text> : null}
        </View>
        <View style={styles.side}>
          {score ? <Text style={styles.score}>{score}</Text> : null}
          <Text style={styles.ago}>{shortAgo(item.occurredAtIso)}</Text>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * The tile that says what happened: a small solid dot (orange in, grey out),
 * VS for a game result, a calendar for a scheduled game. Library icons only.
 */
function IconTile({ item, kind }: { item: FeedItem; kind: Kind }) {
  return (
    <View style={styles.tile}>
      {kind === "in" && item.type !== "checkin_burst" ? <View style={[styles.dot, styles.dotIn]} /> : null}
      {kind === "out" ? <View style={[styles.dot, styles.dotOut]} /> : null}
      {kind === "game" ? <Text style={styles.vs}>VS</Text> : null}
      {kind === "in" && item.type === "checkin_burst" ? (
        <MaterialCommunityIcons color={Colors.accent} name="account-group" size={15} />
      ) : null}
      {kind === "plan" ? <MaterialCommunityIcons color={Colors.inkSoft} name="calendar-check" size={15} /> : null}
      {kind === "other" ? <MaterialCommunityIcons color={Colors.muted} name="map-marker-radius" size={15} /> : null}
    </View>
  );
}

function DayHeader({ label, first }: { label: string; first: boolean }) {
  return (
    <View style={[styles.dayHeader, first && styles.dayHeaderFirst]}>
      <Text accessibilityRole="header" style={styles.dayText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    marginHorizontal: Layout.screenGutter,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(242,242,246,0.06)",
  },
  rowPressed: { opacity: 0.7 },
  tile: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.08)",
    backgroundColor: Colors.panel,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotIn: { backgroundColor: Colors.accent },
  dotOut: { backgroundColor: Colors.checkOutDot },
  vs: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 0.6, color: Colors.textSecondary },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: Typography.bodyMedium, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  who: { fontFamily: Typography.bodySemiBold, color: Colors.text },
  meta: { fontFamily: Typography.bodyMedium, fontSize: 11, lineHeight: 15, color: Colors.muted },
  side: { flexShrink: 0, alignItems: "flex-end", gap: 2 },
  score: { fontFamily: Typography.headingSemiBold, fontSize: 19, lineHeight: 21, letterSpacing: -0.4, color: Colors.text, fontVariant: ["tabular-nums"] },
  ago: { fontFamily: Typography.bodySemiBold, fontSize: 10, color: Colors.muted },
  dayHeader: { paddingHorizontal: Layout.screenGutter, paddingTop: Space.xl, paddingBottom: Space.xs },
  dayHeaderFirst: { paddingTop: Space.md },
  dayText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
});
