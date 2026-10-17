import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import {
  activityDayLabels,
  activityTime,
  type GameActivityEvent,
} from "@/lib/gameActivity";

const TIME_COLUMN = 90;
const RAIL = 20;
const MARKER = 9;
/** Every column lines up on the centre of the sentence's first line. */
const ROW_PAD = Space.sm;
const LINE = TextStyles.bodySmall.lineHeight;
const DAY_LINE = TextStyles.labelSmall.lineHeight;
const TIME_LINE = TextStyles.metadata.lineHeight;

/**
 * Game activity (D47) on the game page: the same rail as the activity feed.
 * Left of the rail, the day sits above the time on the first row of each day,
 * so the list scans straight down even across several days. Played is the
 * orange marker, what happened since is grey, what's still to come is hollow.
 */
export function GameActivityList({ events }: { events: GameActivityEvent[] }) {
  const days = activityDayLabels(events);
  if (events.length === 0) return null;
  return (
    <View accessibilityLabel="Game activity" style={styles.list}>
      {events.map((event, index) => {
        const first = index === 0;
        const last = index === events.length - 1;
        const marker =
          event.kind === "played"
            ? styles.markerPlayed
            : event.kind === "waiting"
              ? styles.markerWaiting
              : styles.markerDone;
        return (
          <View key={event.key} style={styles.row}>
            <View style={[styles.when, { paddingTop: ROW_PAD + (LINE - (days[index] ? DAY_LINE : TIME_LINE)) / 2 }]}>
              {days[index] ? (
                <Text numberOfLines={1} style={styles.day}>
                  {days[index]}
                </Text>
              ) : null}
              <Text numberOfLines={1} style={styles.time}>
                {activityTime(event.at, event.kind)}
              </Text>
            </View>
            <View style={styles.rail}>
              <View style={[styles.segmentTop, first && styles.segmentHidden]} />
              <View style={[styles.marker, marker]} />
              <View style={[styles.segment, last && styles.segmentHidden]} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.line}>
                <Text style={event.kind === "waiting" ? styles.waiting : styles.lead}>
                  {event.lead}
                </Text>
                {event.rest ? <Text style={styles.rest}>{` ${event.rest}`}</Text> : null}
              </Text>
              {event.detail ? <Text style={styles.detail}>{event.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: Space.xs },
  row: { flexDirection: "row", alignItems: "stretch", minHeight: 48 },
  when: {
    width: TIME_COLUMN,
    paddingRight: Space.sm,
    alignItems: "flex-end",
    gap: 2,
  },
  day: { ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 0.6 },
  time: { ...TextStyles.metadata, color: Colors.muted, fontVariant: ["tabular-nums"] },
  rail: { width: RAIL, alignItems: "center" },
  segment: { flex: 1, width: StyleSheet.hairlineWidth, backgroundColor: Colors.borderLight },
  // Its own style, not segment + flex: 0: web keeps flex's zero basis and
  // drops the height, which floated every marker above its line.
  segmentTop: { width: StyleSheet.hairlineWidth, height: ROW_PAD + (LINE - MARKER) / 2, backgroundColor: Colors.borderLight },
  segmentHidden: { backgroundColor: "transparent" },
  marker: { width: MARKER, height: MARKER, borderRadius: MARKER / 2 },
  markerPlayed: { backgroundColor: Colors.accent },
  markerDone: { backgroundColor: Colors.mutedDark },
  markerWaiting: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: Space.sm,
    paddingTop: ROW_PAD,
    paddingBottom: Space.md,
    gap: 2,
  },
  line: { ...TextStyles.bodySmall, color: Colors.textSecondary },
  lead: { fontFamily: Typography.bodySemiBold, color: Colors.text },
  waiting: { color: Colors.textSecondary },
  rest: { color: Colors.textSecondary },
  detail: { ...TextStyles.metadata, color: Colors.muted },
});
