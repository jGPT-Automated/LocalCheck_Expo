import { router, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CompactSelect } from "@/components/ui/CompactSelect";
import { EloStat } from "@/components/ui/EloStat";
import { ModeTabs } from "@/components/ui/ModeTabs";
import { Colors, Radius } from "@/constants/colors";
import {
  Court,
  CourtSport,
  getSportColor,
  getTierColor,
  Player,
  playerRankLabel,
} from "@/constants/data";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { fetchLeaderboard, fetchProfile } from "@/services/profileService";
import { fetchCourtById, fetchNearbyCourts } from "@/services/courtService";
import { fetchChallenge } from "@/services/challengeService";
import { type Challenge, otherPlayer } from "@/lib/challengeModel";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import { LogGameView } from "@/components/game/LogGameForm";
// BACKEND NOTE:

type Scope = "FRIENDS" | "REGIONAL" | "LOCAL";
type CompeteMode = "RANKINGS" | "LOG_GAME";

export default function CompeteScreen() {
  const {
    localCourtId,
    localCourt,
    courts,
    currentUser,
    getFriendsList,
    visibility,
    preferredSport,
    preferredCourtId,
  } = useApp();
  // Single source for the viewer's entitlement — matches the rest of the app
  // (Settings, /localplus, the history gate). `useApp().isLocalPlus` is the raw
  // is_pro flag, which lags the founding grant.
  const isLocalPlus = useLocalPlus();
  const { bottom } = useSafeAreaInsets();

  // Deep-link support: /(tabs)/compete?tab=log&courtId=... opens Log Game
  // pre-scoped to a court (used by the run screen's LOG A GAME button).
  // ?opponentId=... additionally preselects the opponent (used by the
  // player profile's LOG GAME button).
  const params = useLocalSearchParams<{
    tab?: string;
    courtId?: string;
    opponentId?: string;
    /** An accepted ranked challenge: Log Game opens filled in from it. */
    challengeId?: string;
  }>();
  const [linkedChallenge, setLinkedChallenge] = useState<Challenge | null>(null);
  const [challengeCourt, setChallengeCourt] = useState<Court | null>(null);
  const challengeId =
    typeof params.challengeId === "string" ? params.challengeId : null;
  useEffect(() => {
    let mounted = true;
    setLinkedChallenge(null);
    setChallengeCourt(null);
    if (!challengeId) return;
    void fetchChallenge(challengeId).then(async (row) => {
      if (!mounted || !row || row.status !== "accepted" || !row.ranked) return;
      setLinkedChallenge(row);
      const court = row.courtId ? await fetchCourtById(row.courtId) : null;
      if (mounted) setChallengeCourt(court);
    });
    return () => {
      mounted = false;
    };
  }, [challengeId]);

  const [mode, setMode] = useState<CompeteMode>(
    params.tab === "log" ? "LOG_GAME" : "RANKINGS",
  );
  const [scope, setScope] = useState<Scope>("LOCAL");
  const [rankingSport, setRankingSport] = useState<CourtSport>(
    preferredSport ?? localCourt?.sport ?? "BASKETBALL",
  );
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [deepLinkedOpponent, setDeepLinkedOpponent] = useState<Player | null>(
    null,
  );
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  // Only set when REGIONAL resolves its anchor from a live GPS fix rather
  // than the saved local court — the label below needs to know which one,
  // since "no local court" doesn't mean "no real region" here.
  const [gpsAnchorCourt, setGpsAnchorCourt] = useState<Court | null>(null);
  const { coord: deviceCoord } = useDeviceLocation();

  useEffect(() => {
    if (params.tab === "log") setMode("LOG_GAME");
  }, [params.tab]);

  useEffect(() => {
    if (preferredSport) setRankingSport(preferredSport);
    else if (
      localCourt?.sport === "BASKETBALL" ||
      localCourt?.sport === "PICKLEBALL"
    ) {
      setRankingSport(localCourt.sport);
    }
  }, [localCourt?.sport, preferredSport]);

  const friendIdsKey = getFriendsList()
    .map((f) => f.id)
    .sort()
    .join(",");
  useEffect(() => {
    let mounted = true;
    setLeaderboardLoading(true);
    // REGIONAL needs an anchor court to resolve its market — normally the
    // local court, but a viewer without one set yet still has a resolved GPS
    // fix (DeviceLocationContext), so fall back to whatever court is nearest
    // to them rather than returning an empty board.
    setGpsAnchorCourt(null);
    const resolveAnchor = async (): Promise<string | null> => {
      if (scope === "FRIENDS") return null;
      if (localCourtId) return localCourtId;
      if (scope !== "REGIONAL" || !deviceCoord) return null;
      const nearby = await fetchNearbyCourts(
        deviceCoord.lat,
        deviceCoord.lng,
        rankingSport,
        1,
      );
      if (mounted) setGpsAnchorCourt(nearby[0] ?? null);
      return nearby[0]?.id ?? null;
    };
    void resolveAnchor().then((anchorCourtId) =>
      fetchLeaderboard(scope, anchorCourtId, rankingSport, {
        viewerId: currentUser.id,
        friendIds: friendIdsKey ? friendIdsKey.split(",") : [],
      }),
    )
      .then((players) => {
        if (!mounted) return;
        setAllPlayers(players);
      })
      .finally(() => {
        if (mounted) setLeaderboardLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [scope, localCourtId, rankingSport, currentUser.elo, currentUser.id, friendIdsKey, deviceCoord]);

  // Profile/QR deep links are identity lookups, not leaderboard lookups. A
  // valid opponent can be outside the current local/regional/ranked scope.
  useEffect(() => {
    let mounted = true;
    const opponentId =
      typeof params.opponentId === "string"
        ? params.opponentId
        : linkedChallenge
          ? otherPlayer(linkedChallenge, currentUser.id).id
          : null;
    if (!opponentId || opponentId === currentUser.id) {
      setDeepLinkedOpponent(null);
      return () => {
        mounted = false;
      };
    }
    void fetchProfile(opponentId).then((opponent) => {
      if (mounted) setDeepLinkedOpponent(opponent);
    });
    return () => {
      mounted = false;
    };
  }, [currentUser.id, params.opponentId, linkedChallenge]);

  const myRank = allPlayers.findIndex((p) => p.id === currentUser.id) + 1;
  const rankedCurrentUser =
    allPlayers.find((p) => p.id === currentUser.id) ?? currentUser;
  // "Would anyone else see my rank on this board?" — LocalPlus gates every
  // scope; a friends-only profile is visible only on the FRIENDS board.
  const amIVisible =
    isLocalPlus &&
    (visibility === "public" ||
      (visibility === "friends" && scope === "FRIENDS"));
  const showMyRank = myRank > 0 && amIVisible;
  const rankContext = !isLocalPlus
    ? "HIDDEN — LOCALPLUS"
    : visibility === "private"
      ? "HIDDEN — PRIVATE"
      : visibility === "friends"
        ? "FRIENDS ONLY"
        : "LOCALPLUS";
  const leaderboardPlayers = useMemo(
    () =>
      showMyRank
        ? allPlayers
        : allPlayers.filter((player) => player.id !== currentUser.id),
    [allPlayers, currentUser.id, showMyRank],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="COMPETE"
        right={
          <View style={styles.headerTools}>
            {myRank > 0 ? (
              <View style={styles.myRankBadge}>
                <Text
                  style={[styles.myRankNum, !showMyRank && styles.myRankNumDim]}
                >
                  #{myRank}
                  <Text style={styles.myRankTotal}>/{allPlayers.length}</Text>
                </Text>
                <Text numberOfLines={1} style={styles.myRankLabel}>
                  {rankContext}
                </Text>
              </View>
            ) : null}
          </View>
        }
      />

      <ModeTabs
        prominent
        items={[
          { label: "LEADERBOARD", value: "RANKINGS" },
          {
            label: "LOG GAME",
            value: "LOG_GAME",
            accessibilityLabel: "Log a game",
          },
        ]}
        onChange={setMode}
        value={mode}
      />

      {mode === "RANKINGS" ? (
        <LeaderboardView
          players={leaderboardPlayers}
          myRank={myRank}
          showMyRank={showMyRank}
          rankContext={rankContext}
          currentUserId={currentUser.id}
          currentUser={rankedCurrentUser}
          scope={scope}
          setScope={setScope}
          sport={rankingSport}
          setSport={setRankingSport}
          localCourt={localCourt}
          gpsAnchorCourt={gpsAnchorCourt}
          bottom={bottom}
          loading={leaderboardLoading}
        />
      ) : (
        <LogGameView
          currentUser={currentUser}
          courts={courts}
          bottom={0}
          preferredSport={localCourt?.sport ?? preferredSport}
          preferredCourtId={
            (typeof params.courtId === "string" ? params.courtId : null) ??
            preferredCourtId
          }
          preselectedOpponent={deepLinkedOpponent}
          challenge={
            linkedChallenge
              ? {
                  id: linkedChallenge.id,
                  opponentId: otherPlayer(linkedChallenge, currentUser.id).id,
                  court: challengeCourt,
                  playOn: linkedChallenge.playOn,
                }
              : null
          }
          localCourtId={localCourtId}
          hasLocalPlus={isLocalPlus}
          onLogged={() => {
            setLinkedChallenge(null);
            setChallengeCourt(null);
            setMode("RANKINGS");
          }}
        />
      )}
    </View>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function LeaderboardView({
  players,
  myRank,
  showMyRank,
  rankContext,
  currentUserId,
  currentUser,
  scope,
  setScope,
  sport,
  setSport,
  localCourt,
  gpsAnchorCourt,
  bottom,
  loading,
}: {
  players: Player[];
  myRank: number;
  showMyRank: boolean;
  rankContext: string;
  currentUserId: string;
  currentUser: Player;
  scope: Scope;
  setScope: (s: Scope) => void;
  sport: CourtSport;
  setSport: (sport: CourtSport) => void;
  localCourt: {
    id: string;
    name: string;
    shortName?: string;
    sport: CourtSport;
    city: string;
  } | null;
  // Only set once REGIONAL resolves its anchor from a live GPS fix rather
  // than the saved local court — "no local court" doesn't mean "no real
  // region" when a device fix found the nearest one.
  gpsAnchorCourt: { city: string } | null;
  bottom: number;
  loading?: boolean;
}) {
  const router = useRouter();
  const { isFriend } = useApp();
  const rankedRows = useMemo(() => {
    const rows: Array<
      | { kind: "player"; player: Player; rank: number }
      | { kind: "hidden"; rank: number }
    > = players.map((player, index) => ({
      kind: "player",
      player,
      rank: index + 1,
    }));

    // The owner sees a private placeholder at their would-be position, while
    // the public players keep their own 1..N rank sequence. The placeholder
    // therefore does not push anyone else down the public leaderboard.
    if (!showMyRank && myRank > 0 && currentUserId) {
      rows.splice(Math.min(myRank - 1, rows.length), 0, {
        kind: "hidden",
        rank: myRank,
      });
    }
    return rows;
  }, [currentUserId, myRank, players, showMyRank]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 84 : bottom + 100,
      }}
    >
      {/* Sport and scope are one filter decision, presented on one row. */}
      <View style={styles.filterRow}>
        <View style={styles.sportFilter}>
          <CompactSelect
            accessibilityLabel="Switch leaderboard sport"
            align="start"
            dense
            onChange={setSport}
            options={[
              { label: "BB", value: "BASKETBALL" },
              { label: "PB", value: "PICKLEBALL" },
            ]}
            value={sport}
            variant="plain"
          />
        </View>
        <View accessibilityRole="tablist" style={styles.scopeRow}>
          {(["FRIENDS", "LOCAL", "REGIONAL"] as Scope[]).map((s) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === s }}
              hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
              key={s}
              onPress={() => setScope(s)}
              style={[styles.scopeSeg, scope === s && styles.scopeSegActive]}
            >
              <Text
                style={[
                  styles.scopeSegText,
                  scope === s && styles.scopeSegTextActive,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* The current place anchors the ranking list below the filters. */}
      <View style={styles.scopeLabel}>
        {scope === "LOCAL" && localCourt ? (
          <>
            <View
              style={[
                styles.scopeDot,
                { backgroundColor: getSportColor(localCourt.sport) },
              ]}
            />
            <Text style={styles.scopeLabelText} numberOfLines={1}>
              {(localCourt.shortName || localCourt.name).toUpperCase()}
            </Text>
          </>
        ) : scope === "LOCAL" ? (
          <Text style={styles.scopeLabelText}>NO LOCAL COURT SET</Text>
        ) : scope === "REGIONAL" && (localCourt ?? gpsAnchorCourt) ? (
          <Text style={styles.scopeLabelText} numberOfLines={1}>
            {((localCourt ?? gpsAnchorCourt)!.city || "REGIONAL").toUpperCase()}
          </Text>
        ) : scope === "FRIENDS" ? (
          <Text style={styles.scopeLabelText}>YOU + YOUR FRIENDS</Text>
        ) : (
          // REGIONAL with no local court AND no GPS-resolved anchor falls
          // back to the same unscoped board GLOBAL would show — label it
          // the same.
          <Text style={styles.scopeLabelText}>UNITED STATES</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : rankedRows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>NO PLAYERS IN THIS SCOPE</Text>
        </View>
      ) : (
        rankedRows.map((row) => {
          if (row.kind === "hidden") {
            return (
              <Pressable
                key="current-user-hidden"
                onPress={() => router.push(`/localplus`)}
                style={[styles.leaderRow, styles.hiddenLeaderRow]}
              >
                <View style={styles.hiddenDot} />
                <Text style={styles.rank}>{row.rank}</Text>
                <PlayerAvatar
                  initials={currentUser.avatar}
                  name={currentUser.name}
                  playerId={currentUser.id}
                  size={40}
                />
                <View style={styles.playerInfo}>
                  <View style={styles.playerNameRow}>
                    <Text numberOfLines={1} style={styles.hiddenPlayerName}>
                      {currentUser.name}
                    </Text>
                    <View style={styles.youChip}>
                      <Text style={styles.youChipText}>YOU</Text>
                    </View>
                  </View>
                  <View style={styles.playerBadges}>
                    <Text style={[styles.tierText, { color: Colors.accent }]}>
                      {rankContext}
                    </Text>
                    <Text style={styles.wlText}>
                      {currentUser.wins}W · {currentUser.losses}L
                    </Text>
                  </View>
                </View>
                <EloStat leaderboard value={currentUser.elo} />
              </Pressable>
            );
          }

          const { player, rank } = row;
          return (
            <Pressable
              key={player.id}
              style={[styles.leaderRow, rank === 1 && styles.leaderRowFirst]}
              onPress={() => router.push(`/player/${player.id}`)}
            >
              <Text style={styles.rank}>{rank}</Text>
              <PlayerAvatar
                initials={player.avatar}
                name={player.name}
                playerId={player.id}
                size={40}
                tag={player.tag}
                foregroundColor={rank === 1 ? Colors.black : undefined}
                friend={isFriend(player.id)}
                style={rank === 1 ? styles.leaderAvatarFirst : undefined}
              />
              <View style={styles.playerInfo}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.name}
                  </Text>
                </View>
                <View style={styles.playerBadges}>
                  <Text
                    style={[
                      styles.tierText,
                      {
                        color: player.tag
                          ? Colors.accent
                          : getTierColor(player.tier),
                      },
                    ]}
                  >
                    {playerRankLabel(player)}
                  </Text>
                  <Text style={styles.wlText}>
                    {player.wins}W · {player.losses}L
                  </Text>
                </View>
              </View>
              <EloStat leaderboard value={player.elo} />
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerTools: { flexDirection: "row", alignItems: "center", gap: 8 },
  myRankBadge: {
    alignItems: "flex-end",
  },
  myRankNum: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.accent,
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  myRankNumDim: {
    color: Colors.muted,
  },
  myRankTotal: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 0.3,
  },
  myRankLabel: {
    maxWidth: 150,
    marginTop: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.2,
    textAlign: "right",
    textTransform: "uppercase" as const,
  },

  // ── Inline private position indicator ──
  // Findable, not faded: an accent spine + "YOU" chip keep the row easy to
  // spot, while the name itself is dimmed to say "not on the public board".
  hiddenLeaderRow: {
    position: "relative",
    backgroundColor: `${Colors.accent}0D`,
    borderColor: Colors.accentBorder,
  },
  hiddenDot: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  hiddenPlayerName: {
    flexShrink: 1,
    fontFamily: Typography.heading,
    fontSize: 15,
    letterSpacing: 0.4,
    color: Colors.muted,
    textTransform: "uppercase" as const,
  },
  youChip: {
    marginLeft: 7,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.xs,
    backgroundColor: Colors.accent,
  },
  youChipText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: Colors.black,
  },
  // ── Filters ──
  filterRow: {
    // 14px above the controls, then 7px below + 7px inside the court row:
    // the visible gap to the court name is the same 14px on both sides.
    minHeight: 61,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 7,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  sportFilter: {
    width: 72,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: 10,
    backgroundColor: Colors.accentGhost,
  },
  scopeRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    minHeight: 40,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  scopeSeg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeSegActive: {
    backgroundColor: Colors.surfaceHigh,
  },
  scopeSegText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  scopeSegTextActive: { color: Colors.text },
  scopeLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  scopeDot: { width: 6, height: 6, borderRadius: 3 },
  scopeLabelText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },

  // ── Leaderboard Row ──
  leaderRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  leaderRowFirst: { backgroundColor: `${Colors.accent}08` },
  leaderAvatarFirst: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  rank: {
    fontFamily: Typography.headingRegular,
    fontSize: 14,
    color: Colors.mutedDark,
    width: 14,
    textAlign: "left" as const,
  },
  playerInfo: { flex: 1, minWidth: 0, justifyContent: "center" },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 1,
  },
  playerName: {
    fontFamily: Typography.headingRegular,
    fontSize: 15,
    lineHeight: 19,
    color: Colors.text,
    letterSpacing: 0,
    textTransform: "uppercase",
    flex: 1,
  },
  playerBadges: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  tierText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
  wlText: {
    ...TextStyles.caption,
    fontSize: 9,
    lineHeight: 11,
    color: Colors.muted,
    letterSpacing: 0,
  },
  emptyState: {
    paddingVertical: 64,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },

});
