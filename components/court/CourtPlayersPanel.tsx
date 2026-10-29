import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { EloStat } from "@/components/ui/EloStat";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Colors } from "@/constants/colors";
import { Layout } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import {
  type CourtPlayer,
  formatCheckIns,
  formatRecord,
  isRanked,
  type PlayersSort,
  pointsToNextRank,
  rankByElo,
  sortCourtPlayers,
} from "@/lib/courtPlayersModel";

const SORTS = [
  { value: "ranking", label: "Ranking" },
  { value: "active", label: "Active" },
  { value: "newest", label: "Newest" },
] as const;


/**
 * The court page's Players tab: this court's locals only (who is on court
 * now lives on Live), sorted by ranking, recent activity or when they joined.
 * Your own row stays pinned under the list.
 */
export function CourtPlayersPanel({
  players,
  meId,
  isFriend,
  hiddenLocals,
  onPlayer,
  bottomInset,
}: {
  players: CourtPlayer[];
  meId: string;
  isFriend: (id: string) => boolean;
  /** Locals who keep their profile private: counted, not listed. */
  hiddenLocals: number;
  onPlayer: (id: string) => void;
  bottomInset: number;
}) {
  const [sort, setSort] = React.useState<PlayersSort>("ranking");
  const ranks = React.useMemo(() => rankByElo(players), [players]);
  // Ranking lists only players with a game at this court; Active and Newest
  // list every local.
  const sorted = React.useMemo(
    () => sortCourtPlayers(sort === "ranking" ? players.filter(isRanked) : players, sort),
    [players, sort],
  );
  const rankedCount = players.filter(isRanked).length;
  const me = players.find((player) => player.id === meId);
  const toNext = me ? pointsToNextRank(players, meId) : null;
  const total = players.length + hiddenLocals;

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <SegmentedControl accessibilityLabel="Sort players" compact items={SORTS} onChange={setSort} value={sort} />
        <Text style={styles.note}>
          {sort === "ranking"
            ? `${rankedCount} of ${total} locals have a ranked game`
            : sort === "newest"
              ? `All ${total} locals · newest first`
              : `All ${total} locals · latest check-in first`}
        </Text>
      </View>
      <ScrollView
        key={sort}
        bounces={false}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: me ? 12 : bottomInset }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length > 0 ? (
          sorted.map((player) => (
            <PlayerRankRow
              friend={isFriend(player.id)}
              key={player.id}
              onPress={() => onPlayer(player.id)}
              detail={sort === "active" ? formatCheckIns(player.checkIns) : undefined}
              player={player}
              rank={ranks.get(player.id)}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{sort === "ranking" ? "No ranked games yet" : "No visible local profiles"}</Text>
          </View>
        )}
        {hiddenLocals > 0 ? (
          <Text style={styles.privateNote}>+{hiddenLocals} private {hiddenLocals === 1 ? "local" : "locals"}</Text>
        ) : null}
      </ScrollView>
      {me ? (
        <View style={[styles.meBar, { paddingBottom: bottomInset }]}>
          <PlayerRankRow
            detail={
              isRanked(me)
                ? [`${me.wins}–${me.losses}`, toNext ? `${toNext.points} pts to #${toNext.rank}` : null]
                    .filter(Boolean)
                    .join(" · ")
                : "No ranked games yet"
            }
            me
            onPress={() => onPlayer(me.id)}
            player={me}
            rank={ranks.get(me.id)}
          />
        </View>
      ) : null}
    </View>
  );
}

function PlayerRankRow({
  player,
  rank,
  friend = false,
  me = false,
  detail,
  onPress,
}: {
  player: CourtPlayer;
  rank?: number;
  friend?: boolean;
  me?: boolean;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Opens this player's profile"
      accessibilityLabel={`${me ? "You" : player.name}, rank ${rank}, ${player.elo} ELO`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, me && styles.rowMe, pressed && styles.pressed]}
    >
      <Text style={[styles.rank, (!rank || rank > 3) && styles.rankQuiet]}>{rank ?? "–"}</Text>
      <View>
        <PlayerAvatar friend={friend} initials={player.avatar} name={player.name} playerId={player.id} size={42} />
        {player.activeNow ? <View style={styles.activeDot} /> : null}
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>{me ? "You" : player.name}</Text>
        <Text numberOfLines={1} style={styles.detail}>{detail ?? formatRecord(player.wins, player.losses)}</Text>
      </View>
      <EloStat alignEnd leaderboard value={player.elo} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
  list: { flex: 1, minHeight: 0 },
  controls: { paddingHorizontal: Layout.screenGutter, paddingTop: 14, paddingBottom: 12, gap: 10 },
  note: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.muted },
  row: {
    minHeight: 64,
    paddingHorizontal: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  rowMe: { borderBottomWidth: 0, borderLeftWidth: 3, borderLeftColor: Colors.accent, paddingLeft: Layout.screenGutter - 3, backgroundColor: Colors.panel },
  pressed: { opacity: 0.72 },
  rank: { width: 18, textAlign: "center", fontFamily: Typography.headingSemiBold, fontSize: 15, color: Colors.text, fontVariant: ["tabular-nums"] },
  rankQuiet: { color: Colors.muted },
  activeDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: Typography.bodySemiBold, fontSize: 15, lineHeight: 20, color: Colors.text },
  detail: { fontFamily: Typography.bodyMedium, fontSize: 11, lineHeight: 15, color: Colors.muted },
  meBar: { borderTopWidth: 1, borderTopColor: Colors.hairlineChrome, backgroundColor: Colors.panel },
  privateNote: { paddingHorizontal: Layout.screenGutter, paddingVertical: 12, fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.muted },
  empty: { minHeight: 72, paddingHorizontal: Layout.screenGutter, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.text, textAlign: "center" },
  emptyBody: { maxWidth: 300, marginTop: 8, fontFamily: Typography.body, fontSize: 11, lineHeight: 17, color: Colors.muted, textAlign: "center" },
});
