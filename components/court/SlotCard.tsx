import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatForMaxPlayers } from "@/components/schedule/scheduledGameModel";
import { Colors, Radius } from "@/constants/colors";
import type { CourtSport, GameRun, Player } from "@/constants/data";
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
 * view: just look (the court page's Week). plan: + to say you're going
 * (Home, the drawer). full: + and a game action (the Schedule page).
 */
export type SlotMode = "view" | "plan" | "full";

const AVATARS_MAX = 5;
const TILE = 44;

/**
 * One hour at a court (the Oct 29 schedule reference): the hour and how many
 * are going on top, the people as tiles with a + to add yourself, then the
 * hour's game, or an open run with its empty spots when nobody has scheduled
 * one. `bare` drops the panel so it can sit inside another card (Today).
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
  onCreate,
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
  /** The slot is happening now: the + means "I'm here". */
  current?: boolean;
  /** People on court right now, counted but not listed (Here now lists them); only the current slot has any. */
  here?: number;
  /** You are checked in at this court: the + is on and checking out turns it off. */
  checkedIn?: boolean;
  saving?: boolean;
  notice?: string | null;
  onToggle?: () => void;
  /** Starts a game in this hour (the open run's Join until open runs are live). */
  onCreate?: () => void;
  runs: GameRun[];
  sport?: CourtSport;
  meId?: string;
  bare?: boolean;
}) {
  const total = attendees.length + hidden;
  const extra = hidden + Math.max(0, attendees.length - AVATARS_MAX);
  const acts = mode !== "view";
  const run = runs[0];
  const on = mine || checkedIn;
  return (
    <View style={bare ? null : styles.card}>
      <View style={styles.head}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{slotMetaLabel({ current, here, planned: total })}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.tiles} horizontal showsHorizontalScrollIndicator={false} style={styles.tileRow}>
        {attendees.slice(0, AVATARS_MAX).map((attendee) => (
          <Pressable
            accessibilityLabel={attendee.isMine ? "You" : attendee.name}
            accessibilityRole="button"
            key={attendee.id}
            onPress={() => router.push(`/player/${attendee.id}`)}
          >
            <PlayerAvatar accent={attendee.isMine} initials={attendee.initials} name={attendee.name} playerId={attendee.id} size={TILE} />
          </Pressable>
        ))}
        {extra > 0 ? (
          <View style={styles.more}>
            <Text style={styles.moreText}>+{extra}</Text>
          </View>
        ) : null}
        {acts ? (
          <Pressable
            accessibilityLabel={checkedIn ? "You're here" : mine ? "I'm not coming" : current ? "I'm here" : "I'm going"}
            accessibilityRole="button"
            accessibilityState={{ busy: saving, selected: on, disabled: checkedIn }}
            disabled={saving || checkedIn}
            onPress={onToggle}
            style={({ pressed }) => [styles.add, on && styles.addOn, pressed && styles.pressed]}
          >
            <Feather color={on ? Colors.background : Colors.text} name={on ? "check" : "plus"} size={18} />
          </Pressable>
        ) : null}
        {!acts && attendees.length === 0 && extra === 0 ? (
          <View style={styles.emptyTile} />
        ) : null}
      </ScrollView>

      {run ? (
        <GameRow meId={meId} run={run} />
      ) : acts ? (
        <OpenRunRow onJoin={onCreate} sport={sport} />
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
        <Spots filled={run.participants} max={run.maxPlayers} sport={run.sport} />
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

/** No game this hour: an open run with every spot free. */
function OpenRunRow({ sport, onJoin }: { sport: CourtSport; onJoin?: () => void }) {
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
        <Spots filled={[]} max={max} sport={sport} />
      </View>
      {onJoin ? (
        <Pressable
          accessibilityLabel="Join the open run"
          accessibilityRole="button"
          onPress={onJoin}
          style={({ pressed }) => [styles.join, pressed && styles.pressed]}
        >
          <Text style={styles.joinText}>Join</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A game's spots. Basketball: one small square per player, the two teams on
 * two rows. Pickleball: the court from above, one quarter per player.
 */
function Spots({ sport, max, filled }: { sport: CourtSport; max: number; filled: Player[] }) {
  if (sport === "PICKLEBALL") {
    const quarters = Array.from({ length: 4 }, (_, index) => filled[index]);
    return (
      <View style={styles.pbCourt}>
        {[0, 1].map((half) => (
          <View key={half} style={[styles.pbHalf, half === 1 && styles.pbHalfRight]}>
            {[0, 1].map((row) => {
              const player = quarters[half * 2 + row];
              return (
                <View key={row} style={[styles.pbQuarter, row === 1 && styles.pbQuarterBottom]}>
                  <View style={[styles.pbSpot, player && styles.spotTaken]} />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  }
  const side = Math.max(1, Math.round(max / 2));
  return (
    <View style={styles.spots}>
      {[0, 1].map((team) => (
        <View key={team} style={styles.spotRow}>
          {Array.from({ length: side }, (_, index) => {
            const player = filled[team * side + index];
            return (
              <View key={index} style={[styles.spot, player && styles.spotTaken]} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: Radius.panel, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  title: { flexShrink: 1, fontFamily: Typography.headingBold, fontSize: 26, lineHeight: 28, letterSpacing: -0.4, textTransform: "uppercase", color: Colors.text },
  meta: { flexShrink: 0, fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textSecondary },
  tileRow: { marginTop: 14, flexGrow: 0 },
  tiles: { flexDirection: "row", alignItems: "center", gap: 8 },
  more: { width: TILE, height: TILE, borderRadius: Math.round(TILE * 0.18), borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed, alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: Typography.headingSemiBold, fontSize: 13, color: Colors.textSecondary },
  add: { width: TILE, height: TILE, borderRadius: Math.round(TILE * 0.18), borderWidth: 1, borderColor: Colors.hairlineChrome, alignItems: "center", justifyContent: "center" },
  addOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  emptyTile: { width: TILE, height: TILE, borderRadius: Math.round(TILE * 0.18), borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed },
  pressed: { opacity: 0.72 },
  game: { marginTop: 16, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderTopColor: Colors.hairline },
  gameBody: { flex: 1, minWidth: 0 },
  gameTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gameDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.text },
  gameDotOpen: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: Colors.inkSoft },
  gameTitle: { flexShrink: 1, fontFamily: Typography.headingBold, fontSize: 20, lineHeight: 22, letterSpacing: -0.2, textTransform: "uppercase", color: Colors.text },
  gameSub: { marginTop: 4, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  join: { width: 76, height: 44, borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.text, alignItems: "center", justifyContent: "center" },
  joinOn: { backgroundColor: Colors.text },
  joinText: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: Colors.text },
  joinTextOn: { color: Colors.background },
  spots: { marginTop: 10, gap: 4 },
  spotRow: { flexDirection: "row", gap: 4 },
  spot: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed },
  // A taken spot is solid; the people themselves are the tiles above.
  spotTaken: { borderStyle: "solid", borderColor: Colors.accent, backgroundColor: Colors.accent },
  pbSpot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed },
  pbCourt: { marginTop: 10, width: 88, height: 44, flexDirection: "row", borderRadius: 4, borderWidth: 1, borderColor: Colors.pickleballTrace },
  pbHalf: { flex: 1 },
  pbHalfRight: { borderLeftWidth: 2, borderLeftColor: Colors.pickleballMeta },
  pbQuarter: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 0 },
  pbQuarterBottom: { borderTopWidth: 1, borderTopColor: Colors.pickleballTrace },
  notice: { marginTop: 8, fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.loss },
});
