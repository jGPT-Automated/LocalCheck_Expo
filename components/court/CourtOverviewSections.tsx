// The Explore drawer's expanded sections, shared with Home so both read the
// same: Here now (avatars + time on court) and Up next (the next game card).
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { GameDayLabel, ScheduledGameCard } from "@/components/court/CourtGamesPanel";
import { SectionHead } from "@/components/court/CourtParts";
import { Colors, Radius } from "@/constants/colors";
import type { GameRun, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { formatTimeOnCourt } from "@/lib/courtHours";

const HERE_MAX = 4;

export function HereNowSection({
  roster,
  isFriend,
  onPlayer,
  onMore,
  inset = 20,
}: {
  roster: Player[];
  isFriend: (id: string) => boolean;
  onPlayer: (id: string) => void;
  onMore: () => void;
  /** Left/right padding; the drawer and Home both use the 20pt gutter. */
  inset?: number;
}) {
  const live = roster.length > 0;
  return (
    <View style={[styles.section, { paddingHorizontal: inset }]}>
      <SectionHead meta={live ? `${roster.length} on court` : "Live check-ins"} title="Here now" />
      {live ? (
        <View style={styles.hereRow}>
          {roster.slice(0, HERE_MAX).map((player) => (
            <Pressable
              accessibilityLabel={player.name}
              accessibilityRole="button"
              key={player.id}
              onPress={() => onPlayer(player.id)}
              style={styles.hereItem}
            >
              <PlayerAvatar
                friend={isFriend(player.id)}
                initials={player.avatar}
                name={player.name}
                playerId={player.id}
                size={40}
                status="active"
              />
              <Text numberOfLines={1} style={styles.hereName}>{player.name.split(" ")[0]}</Text>
              <Text style={styles.hereSub}>{formatTimeOnCourt(player.checkedInAt) ?? player.elo}</Text>
            </Pressable>
          ))}
          {roster.length > HERE_MAX ? (
            <Pressable
              accessibilityLabel={`${roster.length - HERE_MAX} more on court`}
              accessibilityRole="button"
              onPress={onMore}
              style={styles.hereItem}
            >
              <View style={styles.moreTile}>
                <Text style={styles.moreTileText}>+{roster.length - HERE_MAX}</Text>
              </View>
              <Text style={styles.hereSub}>More</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text numberOfLines={2} style={styles.emptyText}>Nobody yet. Check in and you're first.</Text>
        </View>
      )}
    </View>
  );
}

export function UpNextSection({
  upcoming,
  onOpenRun,
  onSeeAll,
  inset = 20,
}: {
  /** The court's upcoming games, soonest first. */
  upcoming: GameRun[];
  onOpenRun: (id: string) => void;
  /** Makes "N this week" a link; Home leaves it as plain text. */
  onSeeAll?: () => void;
  inset?: number;
}) {
  const { joinRun } = useApp();
  const [joining, setJoining] = React.useState(false);
  const now = Date.now();
  const weekAhead = upcoming.filter((run) => Date.parse(run.startTimeIso) < now + 7 * 86_400_000);
  const next = upcoming[0];
  return (
    <View style={[styles.section, { paddingHorizontal: inset }]}>
      <SectionHead
        meta={weekAhead.length ? `${weekAhead.length} this week` : "None this week"}
        onMetaPress={weekAhead.length ? onSeeAll : undefined}
        title="Up next"
      />
      {next ? (
        // The same card as the court page's Games tab, under the same day label.
        <View style={styles.nextCard}>
          <GameDayLabel iso={next.startTimeIso} />
          <ScheduledGameCard
            game={next}
            joining={joining}
            onJoin={(game) => {
              if (joining) return;
              setJoining(true);
              void joinRun(game.id).finally(() => setJoining(false));
            }}
            onOpen={(game) => onOpenRun(game.id)}
          />
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text numberOfLines={2} style={styles.emptyText}>No games scheduled. Post one and locals see it.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingBottom: 14 },
  nextCard: { gap: 8 },
  hereRow: { height: 67, flexDirection: "row", gap: 8, overflow: "hidden" },
  hereItem: { width: 58, alignItems: "center", gap: 2 },
  hereName: { maxWidth: 58, fontFamily: Typography.bodySemiBold, fontSize: 11, lineHeight: 14, color: Colors.inkSoft },
  hereSub: { fontFamily: Typography.bodySemiBold, fontSize: 11, lineHeight: 11, color: Colors.muted },
  moreTile: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.dashed,
    alignItems: "center",
    justifyContent: "center",
  },
  moreTileText: { fontFamily: Typography.headingSemiBold, fontSize: 13, color: Colors.textSecondary },
  emptyBox: {
    height: 60,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: Radius.row,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.dashed,
  },
  emptyText: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  nextRow: {
    height: 60,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: Radius.row,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  nextWhen: { width: 52, paddingRight: 10, alignItems: "center", borderRightWidth: 1, borderRightColor: Colors.hairline },
  nextDay: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: Colors.textSecondary },
  nextTime: { fontFamily: Typography.headingSemiBold, fontSize: 17, lineHeight: 19, color: Colors.text },
  nextBody: { flex: 1, minWidth: 0 },
  nextTitle: { fontFamily: Typography.bodyBold, fontSize: 12.5, color: Colors.text },
  nextSub: { marginTop: 2, fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  faces: { flexDirection: "row", flexShrink: 0 },
  face: { borderRadius: 9, borderWidth: 2, borderColor: Colors.panel },
  faceOverlap: { marginLeft: -8 },
});
