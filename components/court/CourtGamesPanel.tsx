// Court page › Games (Claude Design handoff): upcoming scheduled games at
// this court, grouped by day. Each card: time, title, format, then who's
// going (faces), "x of y going" with a fill bar, and Join / Going / Full.
// Tapping the card opens the game page (app/run/[id].tsx).
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatForMaxPlayers } from "@/components/schedule/scheduledGameModel";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import type { GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";

export function dayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function CourtGamesPanel({
  games,
  onOpen,
  onCreate,
}: {
  games: GameRun[];
  onOpen: (game: GameRun) => void;
  /** Adds a quiet "Create a game" row under the list, so a short list ends
   * on the next thing to do instead of empty space. */
  onCreate?: () => void;
}) {
  const { joinRun } = useApp();
  const [joiningId, setJoiningId] = React.useState<string | null>(null);

  if (games.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>Upcoming</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>Nothing scheduled. Post a game and locals see it.</Text>
        </View>
        {onCreate ? <CreateGameRow onPress={onCreate} /> : null}
      </View>
    );
  }
  const groups: Array<{ label: string; today: boolean; games: GameRun[] }> = [];
  for (const game of games) {
    const label = dayLabel(new Date(game.startTimeIso));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.games.push(game);
    else groups.push({ label, today: label === "Today", games: [game] });
  }

  const join = async (game: GameRun) => {
    if (joiningId) return;
    setJoiningId(game.id);
    await joinRun(game.id);
    setJoiningId(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Upcoming · {games.length}</Text>
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={[styles.day, group.today && styles.dayToday]}>{group.label}</Text>
          {group.games.map((game) => (
            <ScheduledGameCard game={game} joining={joiningId === game.id} key={game.id} onJoin={join} onOpen={onOpen} />
          ))}
        </View>
      ))}
      {onCreate ? <CreateGameRow onPress={onCreate} /> : null}
    </View>
  );
}

/** The Games tab's day heading ("Today", "Tomorrow", "Monday, Nov 2"). */
export function GameDayLabel({ iso }: { iso: string }) {
  const label = dayLabel(new Date(iso));
  return <Text style={[styles.day, label === "Today" && styles.dayToday]}>{label}</Text>;
}

function CreateGameRow({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.createRow}>
      <Feather color={Colors.inkSoft} name="plus" size={14} />
      <Text style={styles.createText}>Create a game</Text>
    </PressableScale>
  );
}

/**
 * One upcoming game: time, title, format and host, then faces, "x of y
 * going" with a fill bar, and Join / Going / Full. Shared by the court page's
 * Games tab and the Schedule tab's swipeable row (`style` sets its width).
 */
export function ScheduledGameCard({
  game,
  joining,
  onJoin,
  onOpen,
  style,
  compact = false,
  showTime = false,
  disabled = false,
  openOnly = false,
  onPlayer,
}: {
  game: GameRun;
  joining: boolean;
  onJoin: (game: GameRun) => void;
  onOpen: (game: GameRun) => void;
  style?: StyleProp<ViewStyle>;
  /** Inline hourly game summary, using the same RSVP rules. */
  compact?: boolean;
  /** Up next needs the time; an hourly slot already supplies it. */
  showTime?: boolean;
  disabled?: boolean;
  /** A view-only slot can inspect the game but cannot RSVP here. */
  openOnly?: boolean;
  onPlayer?: (playerId: string) => void;
}) {
  const { currentUser } = useApp();
  const [expanded, setExpanded] = React.useState(false);
      const start = new Date(game.startTimeIso);
      const hours = start.getHours();
      const going = game.participants.length;
      const max = Math.max(game.maxPlayers, 1);
      const joined = game.participants.some((player) => player.id === currentUser.id);
      const full = going >= game.maxPlayers;
      // Choose-teams games pick a side on the game page.
      const canQuickJoin = !joined && !full && game.teamAssignmentMode !== "choose_teams";
      const format = formatForMaxPlayers(game.maxPlayers);
      if (compact) {
        const joinable =
          !openOnly && game.status === "scheduled" && start.getTime() > Date.now();
        const doAction = () => joinable && canQuickJoin ? onJoin(game) : onOpen(game);
        const actionDisabled = disabled || joining || (joinable && full && !joined);
        const actionLabel = joined || !joinable ? `Open ${game.title}` : full ? "Game full" : `Join ${game.title}`;
        return (
          <View>
            <View style={styles.timelineCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${game.title}`}
                accessibilityState={{ expanded }}
                onPress={() => setExpanded((value) => !value)}
                style={styles.timelineSummary}
              >
                <View style={styles.summaryText}>
                  <Text numberOfLines={2} style={styles.timelineTitle}>
                    {showTime ? <Text style={styles.timelineMeta}>{`${hours % 12 || 12}${start.getMinutes() ? `:${String(start.getMinutes()).padStart(2, "0")}` : ""} ${hours >= 12 ? "PM" : "AM"} · `}</Text> : null}
                    {game.title}
                  </Text>
                  <Text style={[styles.timelineMeta, game.sport === "PICKLEBALL" && styles.pickleballMeta]}>{[format?.toLowerCase(), `${going}/${game.maxPlayers}`].filter(Boolean).join(" · ")}</Text>
                </View>
                <Feather name={expanded ? "chevron-up" : "chevron-down"} color={Colors.textSecondary} size={18} />
              </Pressable>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                accessibilityState={{ busy: joining, disabled: actionDisabled }}
                disabled={actionDisabled}
                onPress={doAction}
                containerStyle={styles.timelineJoinTarget}
                style={styles.timelineJoin}
              >
                {joining ? <ActivityIndicator color={Colors.text} size="small" /> : (
                  <Text style={styles.timelineJoinText}>{joined || !joinable ? "Open" : full ? "Full" : "Join"}</Text>
                )}
              </PressableScale>
            </View>
            {expanded ? (
              <GameRoster game={game} onPlayer={onPlayer} onSpot={doAction} spotLabel={actionLabel} disabled={actionDisabled} joining={joining} />
            ) : null}
          </View>
        );
      }

      return (
        <PressableScale
          accessibilityLabel={`${game.title}, ${going} of ${game.maxPlayers} going`}
          accessibilityRole="button"
                    onPress={() => onOpen(game)}
          style={[styles.card, style]}
        >
          <View style={styles.top}>
            <View style={styles.timeCol}>
              <Text style={styles.time}>
                {hours % 12 === 0 ? 12 : hours % 12}
                {start.getMinutes() ? `:${String(start.getMinutes()).padStart(2, "0")}` : ""}
              </Text>
              <Text style={styles.ampm}>{hours >= 12 ? "PM" : "AM"}</Text>
            </View>
            <View style={styles.body}>
              <Text numberOfLines={1} style={styles.title}>{game.title}</Text>
              <Text numberOfLines={1} style={styles.sub}>
                {[format?.toLowerCase(), game.skillLevel === "ALL LEVELS" ? "All levels" : game.skillLevel.charAt(0) + game.skillLevel.slice(1).toLowerCase(), game.hostName ? `Host ${game.hostName.split(" ")[0]}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Feather color={Colors.muted} name="chevron-right" size={16} />
          </View>
          <View style={styles.bottom}>
            <View style={styles.faces}>
              {game.participants.slice(0, 4).map((player, index) => (
                <View key={player.id} style={[styles.face, index > 0 && styles.faceOverlap]}>
                  <PlayerAvatar initials={player.avatar} name={player.name} playerId={player.id} size={24} />
                </View>
              ))}
            </View>
            <View style={styles.going}>
              <Text numberOfLines={1} style={styles.goingText}>{going} of {game.maxPlayers} going</Text>
              <View style={styles.bar}>
                <View style={[styles.fill, { width: `${Math.min(100, (going / max) * 100)}%` }]} />
              </View>
            </View>
            <Pressable
              accessibilityLabel={joined ? "You're going" : full ? "Game full" : `Join ${game.title}`}
              accessibilityRole="button"
              disabled={joined || full}
              hitSlop={6}
              onPress={() => (canQuickJoin ? onJoin(game) : onOpen(game))}
              style={({ pressed }) => [styles.cta, joined && styles.ctaJoined, pressed && styles.pressed]}
            >
              {joining ? (
                <ActivityIndicator color={Colors.text} size="small" />
              ) : (
                <Text style={[styles.ctaText, full && !joined && styles.ctaTextMuted]}>
                  {joined ? "Going" : full ? "Full" : "Join"}
                </Text>
              )}
            </Pressable>
          </View>
        </PressableScale>
      );
}

/** Shows only recorded team assignments; other RSVPs remain unassigned. */
function GameRoster({ game, onPlayer, onSpot, spotLabel, disabled, joining }: {
  game: GameRun;
  onPlayer?: (id: string) => void;
  onSpot: () => void;
  spotLabel: string;
  disabled: boolean;
  joining: boolean;
}) {
  const sides = ["a", "b"] as const;
  const assigned = game.participants.filter((p) => game.participantSides[p.id]);
  const unassigned = game.participants.filter((p) => !game.participantSides[p.id]);
  const vacancies = Math.max(0, game.maxPlayers - game.participants.length);
  const width = Math.max(1, Math.ceil(game.maxPlayers / 2));
  const player = (p: GameRun["participants"][number]) => (
    <RosterPlayer key={p.id} player={p} onPlayer={onPlayer} />
  );
  const spot = (i: number) => (
    <RosterOpen key={`open-${i}`} sport={game.sport} onPress={onSpot} label={spotLabel} disabled={disabled} joining={joining} />
  );
  const row = (key: string, contents: React.ReactNode[], columns = width) => (
    <View key={key} style={styles.rosterGridRow}>
      {contents}
      {Array.from({ length: Math.max(0, columns - contents.length) }, (_, i) => <View key={`space-${i}`} style={styles.rosterCell} />)}
    </View>
  );
  const rows = (key: string, contents: React.ReactNode[], columns = width) => {
    const result = [];
    for (let i = 0; i < contents.length; i += columns) result.push(row(`${key}-${i}`, contents.slice(i, i + columns), columns));
    return result;
  };
  const allAssigned = unassigned.length === 0;
  let remainingVacancies = vacancies;
  return (
    <View testID={`game-roster-${game.id}`} style={styles.roster}>
      {assigned.length > 0 ? <View style={game.maxPlayers <= 4 ? styles.smallTeams : undefined}>{sides.map((side) => {
        const players = assigned.filter((p) => game.participantSides[p.id] === side);
        const openCount = allAssigned ? Math.min(remainingVacancies, Math.max(0, width - players.length)) : 0;
        remainingVacancies -= openCount;
        if (!players.length && !openCount) return null;
        return <View key={side} style={game.maxPlayers <= 4 ? styles.smallTeam : undefined}><Text style={styles.rosterLabel}>Team {side.toUpperCase()}</Text>{rows(side, [...players.map(player), ...Array.from({ length: openCount }, (_, i) => spot(i))])}</View>;
      })}</View> : null}
      {unassigned.length || !assigned.length ? (
        <View>
          {assigned.length ? <Text style={styles.rosterLabel}>Unassigned</Text> : null}
          {rows("unassigned", [...unassigned.map(player), ...Array.from({ length: vacancies }, (_, i) => spot(i))], game.maxPlayers <= 4 ? game.maxPlayers : width)}
        </View>
      ) : null}
    </View>
  );
}
function RosterPlayer({ player, onPlayer }: { player: GameRun["participants"][number]; onPlayer?: (id: string) => void }) {
  return <View style={styles.rosterCell}><Pressable accessibilityRole="button" accessibilityLabel={player.name} disabled={!onPlayer} onPress={() => onPlayer?.(player.id)} style={styles.rosterTouch}><PlayerAvatar initials={player.avatar} name={player.name} playerId={player.id} size={34} /></Pressable><Text style={styles.rosterName}>{player.name}</Text></View>;
}
function RosterOpen({ sport, onPress, label, disabled, joining }: { sport: GameRun["sport"]; onPress: () => void; label: string; disabled: boolean; joining: boolean }) {
  const pickleball = sport === "PICKLEBALL";
  return <View style={styles.rosterCell}><PressableScale testID="game-open-spot" accessibilityRole="button" accessibilityLabel={`${label}, open spot`} accessibilityState={{ disabled, busy: joining }} disabled={disabled} onPress={onPress} containerStyle={styles.rosterTouch} style={[styles.openAvatar, pickleball && styles.pickleballOpen]}><Feather name="plus" size={18} color={pickleball ? Colors.pickleballCourt : Colors.textSecondary} /></PressableScale><Text style={styles.rosterName}>Open</Text></View>;
}

const styles = StyleSheet.create({
  timelineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  timelineSummary: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    gap: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryText: { flex: 1, minWidth: 0, gap: 3 },
  timelineTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text,
  },
  timelineMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  pickleballMeta: { color: Colors.pickleballCourt },
  timelineJoinTarget: { minWidth: 64, height: 44, alignItems: "center", justifyContent: "center" },
  timelineJoin: { minWidth: 64, height: 34, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.hairlineChrome, borderRadius: Radius.button },
  timelineJoinText: { fontFamily: Typography.bodyBold, fontSize: 11, textTransform: "uppercase", color: Colors.text },
  roster: { paddingVertical: 8, gap: 8 },
  smallTeams: { flexDirection: "row", gap: 12 },
  smallTeam: { flex: 1, flexBasis: 0, minWidth: 0 },
  rosterGridRow: { flexDirection: "row", alignItems: "flex-start" },
  rosterCell: { flex: 1, flexBasis: 0, minWidth: 0, alignItems: "center" },
  rosterTouch: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  rosterLabel: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.textSecondary },
  rosterName: { alignSelf: "stretch", textAlign: "center", fontFamily: Typography.bodyMedium, fontSize: 11, lineHeight: 14, color: Colors.text },
  openAvatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed },
  pickleballOpen: { borderColor: Colors.pickleballCourt, backgroundColor: Colors.pickleballWash },
  // Schedule owns the common gutter for the heatmap, slot and game cards.
  wrap: { paddingTop: 16, gap: 14 },
  eyebrow: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  emptyBox: { minHeight: 64, paddingHorizontal: 14, justifyContent: "center", borderRadius: Radius.row, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed },
  empty: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  group: { gap: 7 },
  day: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  dayToday: { color: Colors.text },
  card: { overflow: "hidden", borderRadius: Radius.panel, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingRight: 12 },
  timeCol: { width: 56, alignItems: "center", borderRightWidth: 1, borderRightColor: Colors.hairline },
  time: { fontFamily: Typography.headingSemiBold, fontSize: 18, lineHeight: 20, color: Colors.text },
  ampm: { fontFamily: Typography.bodyBold, fontSize: 7.5, letterSpacing: 0.8, color: Colors.muted },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: Typography.bodyBold, fontSize: 13, color: Colors.text },
  sub: { fontFamily: Typography.bodyMedium, fontSize: 10.5, color: Colors.textSecondary },
  bottom: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(242,242,246,0.06)" },
  faces: { flexDirection: "row", paddingLeft: 2 },
  face: { borderRadius: 9, borderWidth: 2, borderColor: Colors.panel },
  faceOverlap: { marginLeft: -8 },
  going: { flex: 1, minWidth: 0, gap: 4 },
  goingText: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.inkSoft },
  bar: { height: 3, borderRadius: 2, backgroundColor: "rgba(242,242,246,0.08)", overflow: "hidden" },
  fill: { height: 3, backgroundColor: Colors.inkSoft },
  cta: { height: 32, minWidth: 64, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.hairlineChrome },
  ctaJoined: { backgroundColor: Colors.tile, borderColor: "rgba(242,242,246,0.3)" },
  ctaText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.text },
  ctaTextMuted: { color: Colors.muted },
  pressed: { opacity: 0.7 },
  createRow: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.panel, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed },
  createText: { fontFamily: Typography.bodyBold, fontSize: 10, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.inkSoft },
});
