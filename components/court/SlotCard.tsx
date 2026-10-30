import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatForMaxPlayers } from "@/components/schedule/scheduledGameModel";
import { Colors, Radius } from "@/constants/colors";
import type { CourtSport, GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { slotMetaLabel } from "@/lib/slotModel";

export interface SlotAttendee {
  id: string;
  name: string;
  initials: string;
  isMine: boolean;
  visitId?: string;
}

/**
 * view: just look (the court page's Week). plan / full: I'm going and the
 * hour's game or open run (Home, the drawer, Schedule).
 */
export type SlotMode = "view" | "plan" | "full";

const AVATARS_MAX = 5;
const FACE = 36;

/**
 * One hour at a court (Oct 29 Home reference): the hour with how many are
 * coming beside it, the people on the left and I'm going on the right, then
 * the hour's game with Join, or an open run when nobody has scheduled one.
 * `bare` drops the panel so it can sit inside another card (Today).
 */
export function SlotCard({
  title,
  attendees,
  hidden,
  mine,
  mode,
  current = false,
  here = 0,
  checkedIn = false,
  saving = false,
  notice = null,
  onToggle,
  runs,
  sport = "BASKETBALL",
  meId,
  bare = false,
}: {
  title: string;
  attendees: SlotAttendee[];
  /** Planned visits that keep their name private. */
  hidden: number;
  mine: boolean;
  mode: SlotMode;
  /** The slot is happening now: the button means "I'm here". */
  current?: boolean;
  /** People on court right now, counted but not listed (Here now lists them); only the current slot has any. */
  here?: number;
  /** You are checked in at this court: the button is on and checking out turns it off. */
  checkedIn?: boolean;
  saving?: boolean;
  notice?: string | null;
  onToggle?: () => void;
  runs: GameRun[];
  sport?: CourtSport;
  meId?: string;
  bare?: boolean;
}) {
  const total = attendees.length + hidden;
  const acts = mode !== "view";
  const run = runs[0];
  const on = mine || checkedIn;
  // Faces only; people who keep their name private are counted in the line
  // above, never as a lone "+N" box.
  const people = attendees.length > 0;
  return (
    <View style={bare ? null : styles.card}>
      <View style={styles.head}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{slotMetaLabel({ current, here, planned: total })}</Text>
      </View>

      {people || acts ? (
        <View style={styles.peopleRow}>
          {people ? (
            <View style={styles.faces}>
              {attendees.slice(0, AVATARS_MAX).map((attendee) => (
                <Pressable
                  accessibilityLabel={attendee.isMine ? "You" : attendee.name}
                  accessibilityRole="button"
                  key={attendee.id}
                  onPress={() => router.push(`/player/${attendee.id}`)}
                >
                  <PlayerAvatar accent={attendee.isMine} initials={attendee.initials} name={attendee.name} playerId={attendee.id} size={FACE} />
                </Pressable>
              ))}
              {attendees.length > AVATARS_MAX ? (
                <View style={styles.more}>
                  <Text style={styles.moreText}>+{attendees.length - AVATARS_MAX}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {acts ? (
            <Pressable
              accessibilityLabel={checkedIn ? "You're here" : mine ? "I'm not coming" : current ? "I'm here" : "I'm going"}
              accessibilityRole="button"
              accessibilityState={{ busy: saving, selected: on, disabled: checkedIn }}
              disabled={saving || checkedIn}
              onPress={onToggle}
              style={({ pressed }) => [styles.going, !people && styles.goingWide, on && styles.goingOn, pressed && styles.pressed]}
            >
              <Feather color={on ? Colors.background : Colors.text} name={on ? "check" : "plus"} size={14} />
              <Text style={[styles.goingText, on && styles.goingTextOn]}>
                {on ? (current ? "Here" : "Going") : current ? "I'm here" : "I'm going"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {run ? (
        <GameRow meId={meId} run={run} />
      ) : acts ? (
        <OpenRunRow sport={sport} />
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

/** The hour's scheduled game: title, format and how full it is, Join. */
function GameRow({ run, meId }: { run: GameRun; meId?: string }) {
  const joined = Boolean(meId && run.participants.some((player) => player.id === meId));
  return (
    <View style={styles.game}>
      <View style={styles.gameBody}>
        <View style={styles.gameTitleRow}>
          <View style={styles.gameDot} />
          <Text numberOfLines={1} style={styles.gameTitle}>{run.title}</Text>
        </View>
        <Text numberOfLines={1} style={styles.gameSub}>
          {[formatForMaxPlayers(run.maxPlayers)?.toLowerCase(), `${run.participants.length} of ${run.maxPlayers} going`]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={`Open ${run.title}`}
        accessibilityRole="button"
        onPress={() => router.push(`/run/${run.id}`)}
        style={({ pressed }) => [styles.join, joined && styles.joinOn, pressed && styles.pressed]}
      >
        <Text style={[styles.joinText, joined && styles.joinTextOn]}>{joined ? "Joined" : "Join"}</Text>
      </Pressable>
    </View>
  );
}

/**
 * No game this hour: an open run. Joining one needs the open-run backend
 * (not built), so it shows the format and count only, no button.
 */
function OpenRunRow({ sport }: { sport: CourtSport }) {
  const max = sport === "PICKLEBALL" ? 4 : 10;
  return (
    <View style={styles.game}>
      <View style={styles.gameBody}>
        <View style={styles.gameTitleRow}>
          <View style={[styles.gameDot, styles.gameDotOpen]} />
          <Text numberOfLines={1} style={styles.gameTitle}>Open run</Text>
        </View>
        <Text numberOfLines={1} style={styles.gameSub}>
          {[formatForMaxPlayers(max)?.toLowerCase(), `0 of ${max} going`].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: Radius.panel, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel },
  head: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  title: { flexShrink: 0, fontFamily: Typography.headingBold, fontSize: 26, lineHeight: 28, letterSpacing: -0.4, textTransform: "uppercase", color: Colors.text },
  meta: { flexShrink: 1, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  peopleRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  faces: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6, overflow: "hidden" },
  more: { width: FACE, height: FACE, borderRadius: Math.round(FACE * 0.18), borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed, alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: Typography.headingSemiBold, fontSize: 12, color: Colors.textSecondary },
  going: { height: 44, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.text },
  goingWide: { flex: 1 },
  goingOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  goingText: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: Colors.text },
  goingTextOn: { color: Colors.background },
  pressed: { opacity: 0.72 },
  game: { marginTop: 16, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderTopColor: Colors.hairline },
  gameBody: { flex: 1, minWidth: 0 },
  gameTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gameDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.text },
  gameDotOpen: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: Colors.inkSoft },
  gameTitle: { flexShrink: 1, fontFamily: Typography.headingBold, fontSize: 20, lineHeight: 22, letterSpacing: -0.2, textTransform: "uppercase", color: Colors.text },
  gameSub: { marginTop: 4, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  join: { width: 84, height: 44, borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.text, alignItems: "center", justifyContent: "center" },
  joinOn: { backgroundColor: Colors.text },
  joinText: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: Colors.text },
  joinTextOn: { color: Colors.background },
  notice: { marginTop: 8, fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.loss },
});
