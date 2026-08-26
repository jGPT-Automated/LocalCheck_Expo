import { Feather, Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  CourtSport,
  getSportColor,
  getTierColor,
  Player,
} from "@/constants/data";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchLeaderboard, fetchProfile } from "@/services/profileService";
import { logGame } from "@/services/gameService";
import { searchPlayers } from "@/services/profileService";

// BACKEND NOTE:

type Scope = "GLOBAL" | "REGIONAL" | "LOCAL";
type CompeteMode = "RANKINGS" | "LOG_GAME";

export default function CompeteScreen() {
  const {
    localCourtId,
    localCourt,
    courts,
    currentUser,
    isLocalPlus,
    visibility,
    preferredSport,
    preferredCourtId,
  } = useApp();
  const { bottom } = useSafeAreaInsets();

  // Deep-link support: /(tabs)/compete?tab=log&courtId=... opens Log Game
  // pre-scoped to a court (used by the run screen's LOG A GAME button).
  // ?opponentId=... additionally preselects the opponent (used by the
  // player profile's LOG GAME button).
  const params = useLocalSearchParams<{
    tab?: string;
    courtId?: string;
    opponentId?: string;
  }>();

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

  useEffect(() => {
    let mounted = true;
    setLeaderboardLoading(true);
    fetchLeaderboard(
      scope,
      scope === "GLOBAL" ? null : localCourtId,
      rankingSport,
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
  }, [scope, localCourtId, rankingSport, currentUser.elo]);

  // Profile/QR deep links are identity lookups, not leaderboard lookups. A
  // valid opponent can be outside the current local/regional/ranked scope.
  useEffect(() => {
    let mounted = true;
    const opponentId =
      typeof params.opponentId === "string" ? params.opponentId : null;
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
  }, [currentUser.id, params.opponentId]);

  const myRank = allPlayers.findIndex((p) => p.id === currentUser.id) + 1;
  const rankedCurrentUser =
    allPlayers.find((p) => p.id === currentUser.id) ?? currentUser;
  const amIVisible = visibility === "public" && isLocalPlus;
  const showMyRank = myRank > 0 && amIVisible;
  const rankContext = showMyRank
    ? "LOCALPLUS"
    : visibility === "public"
      ? "HIDDEN — LOCALPLUS"
      : "HIDDEN — PRIVATE";
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
        prominent
        title="COMPETE"
        right={
          <View style={styles.headerTools}>
            {myRank > 0 ? (
              <View style={styles.myRankBadge}>
                <Text
                  style={[styles.myRankNum, !showMyRank && styles.myRankNumDim]}
                >
                  #{myRank}
                </Text>
                <Text style={styles.myRankLabel}>
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
          currentUserId={currentUser.id}
          currentUser={rankedCurrentUser}
          scope={scope}
          setScope={setScope}
          sport={rankingSport}
          setSport={setRankingSport}
          localCourt={localCourt}
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
          localCourtId={localCourtId}
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
  currentUserId,
  currentUser,
  scope,
  setScope,
  sport,
  setSport,
  localCourt,
  bottom,
  loading,
}: {
  players: Player[];
  myRank: number;
  showMyRank: boolean;
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
  } | null;
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
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
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
          {(["LOCAL", "REGIONAL", "GLOBAL"] as Scope[]).map((s) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === s }}
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
        ) : (
          <Text style={styles.scopeLabelText}>ELO RANKINGS</Text>
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
              <View
                key="current-user-hidden"
                style={[styles.leaderRow, styles.hiddenLeaderRow]}
              >
                <Text style={styles.rank}>{row.rank}</Text>
                <PlayerAvatar
                  initials={currentUser.avatar}
                  name={currentUser.name}
                  playerId={currentUser.id}
                  size={40}
                />
                <View style={styles.playerInfo}>
                  <Text numberOfLines={1} style={styles.playerName}>
                    {currentUser.name}
                  </Text>
                  <View style={styles.playerBadges}>
                    <Text style={styles.wlText}>
                      {currentUser.wins}W · {currentUser.losses}L
                    </Text>
                  </View>
                </View>
                <EloStat leaderboard value={currentUser.elo} />
              </View>
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
                      { color: getTierColor(player.tier) },
                    ]}
                  >
                    {player.tier}
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

// ─── Log Game ────────────────────────────────────────────────────────────────

type GameLog = {
  sport: CourtSport | "";
  myScore: string;
  theirScore: string;
  opponentName: string;
  opponentId: string;
  courtId: string;
  note: string;
};

function LogGameView({
  currentUser,
  courts,
  bottom,
  preferredSport,
  preferredCourtId,
  preselectedOpponent,
  localCourtId,
  inSheet = false,
}: {
  currentUser: ReturnType<typeof useApp>["currentUser"];
  courts: ReturnType<typeof useApp>["courts"];
  bottom: number;
  preferredSport: CourtSport | null;
  preferredCourtId: string | null;
  preselectedOpponent: Player | null;
  localCourtId: string | null;
  inSheet?: boolean;
}) {
  const { isFriend, getFriendsList } = useApp();

  // Default court: preferredCourtId > localCourtId > empty
  const supportedCourts = useMemo(
    () =>
      courts.filter(
        (court) => court.sport === "BASKETBALL" || court.sport === "PICKLEBALL",
      ),
    [courts],
  );
  const defaultCourtId =
    preferredCourtId ?? localCourtId ?? supportedCourts[0]?.id ?? "";
  const defaultCourt = supportedCourts.find(
    (court) => court.id === defaultCourtId,
  );
  const defaultSport = defaultCourt?.sport ?? preferredSport ?? "";

  const [form, setForm] = useState<GameLog>({
    sport: defaultSport,
    myScore: "",
    theirScore: "",
    opponentName: "",
    opponentId: "",
    courtId: defaultCourtId,
    note: "",
  });
  const [submittedGame, setSubmittedGame] = useState<GameLog | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [opponentQuery, setOpponentQuery] = useState("");
  const [opponentSuggestions, setOpponentSuggestions] = useState<Player[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [clientRequestId, setClientRequestId] = useState(() =>
    Crypto.randomUUID(),
  );

  // A court owns its sport. This keeps the label and the rating update in
  // agreement, including when the court arrives after the screen first opens.
  useEffect(() => {
    const nextCourtId = form.courtId || defaultCourtId;
    const selectedCourt = supportedCourts.find(
      (court) => court.id === nextCourtId,
    );
    if (!selectedCourt) return;
    setForm((current) =>
      current.courtId === nextCourtId && current.sport === selectedCourt.sport
        ? current
        : { ...current, courtId: nextCourtId, sport: selectedCourt.sport },
    );
  }, [defaultCourtId, form.courtId, supportedCourts]);

  // Apply the deep-linked opponent once it resolves from the loaded player
  // list. Never clobbers a manually chosen (or cleared) opponent.
  const appliedOpponentIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!preselectedOpponent) return;
    if (appliedOpponentIdRef.current === preselectedOpponent.id) return;
    appliedOpponentIdRef.current = preselectedOpponent.id;
    setForm((f) =>
      f.opponentId
        ? f
        : {
            ...f,
            opponentName: preselectedOpponent.name,
            opponentId: preselectedOpponent.id,
          },
    );
  }, [preselectedOpponent]);

  const myScoreNum = Number(form.myScore);
  const theirScoreNum = Number(form.theirScore);
  const scoresEntered = form.myScore !== "" && form.theirScore !== "";
  const scoresValid =
    scoresEntered &&
    Number.isInteger(myScoreNum) &&
    Number.isInteger(theirScoreNum) &&
    myScoreNum >= 0 &&
    theirScoreNum >= 0;
  const isTie = scoresValid && myScoreNum === theirScoreNum;
  const isWin = scoresValid && myScoreNum > theirScoreNum;
  const isLoss = scoresValid && myScoreNum < theirScoreNum;

  const canSubmit =
    form.sport !== "" &&
    scoresValid &&
    !isTie &&
    form.opponentId !== "" &&
    form.courtId !== "" &&
    !submitting;
  const selectedCourt = supportedCourts.find(
    (court) => court.id === form.courtId,
  );

  const handleSubmit = async () => {
    if (!canSubmit || !form.opponentId || !form.courtId) return;
    setSubmitting(true);
    setSubmitError(null);
    let result: { ok: boolean; matchId?: string } = { ok: false };
    try {
      result = await logGame({
        courtId: form.courtId,
        createdBy: currentUser.id,
        myScore: myScoreNum,
        theirScore: theirScoreNum,
        opponentId: form.opponentId,
        sport: form.sport as CourtSport,
        note: form.note,
        clientRequestId,
      });
    } catch (e) {
      console.warn("logGame failed", e);
      result = { ok: false };
    }
    setSubmitting(false);
    if (!result.ok) {
      // Keep the form intact so the user can retry.
      setSubmitError("COULD NOT LOG GAME — NOTHING WAS SAVED. TRY AGAIN.");
      return;
    }
    // The score is pending. The opponent receives a review action; ratings and
    // public history remain unchanged until confirmation.
    setSubmittedGame({ ...form });
    setClientRequestId(Crypto.randomUUID());
    setTimeout(() => setSubmittedGame(null), 5000);
    setForm({
      sport: defaultSport,
      myScore: "",
      theirScore: "",
      opponentName: "",
      opponentId: "",
      courtId: defaultCourtId,
      note: "",
    });
  };

  // Opponent typeahead: search real players via Supabase
  const friends = getFriendsList();
  const query = opponentQuery.toLowerCase().trim();
  useEffect(() => {
    let mounted = true;
    if (query.length === 0) {
      setOpponentSuggestions(friends.slice(0, 10));
      return;
    }
    searchPlayers(query).then((results) => {
      if (!mounted) return;
      const deduped = results.filter((p) => p.id !== currentUser.id);
      // Friends first, then others
      const friendIds = new Set(friends.map((f) => f.id));
      const sorted = [
        ...deduped.filter((p) => friendIds.has(p.id)),
        ...deduped.filter((p) => !friendIds.has(p.id)),
      ].slice(0, 10);
      setOpponentSuggestions(sorted);
    });
    return () => {
      mounted = false;
    };
  }, [query, friends, currentUser.id]);

  const handleSelectOpponent = (player: Player) => {
    setForm((f) => ({
      ...f,
      opponentName: player.name,
      opponentId: player.id,
    }));
    setOpponentQuery("");
    setShowOpponentPicker(false);
  };

  const handleClearOpponent = () => {
    setForm((f) => ({ ...f, opponentName: "", opponentId: "" }));
    setOpponentQuery("");
  };

  if (submittedGame) {
    const submittedCourt = supportedCourts.find(
      (court) => court.id === submittedGame.courtId,
    );
    return (
      <View style={styles.successState}>
        <View style={styles.successIcon}>
          <Feather color={Colors.black} name="check" size={28} />
        </View>
        <Text style={styles.successTitle}>SCORE SENT FOR REVIEW</Text>
        <Text style={styles.successSub}>
          Your opponent can confirm or object. No rating changes yet.
        </Text>
        <View style={styles.successCard}>
          <View style={styles.successCardHeader}>
            <Text numberOfLines={1} style={styles.successCourt}>
              {submittedCourt?.shortName || submittedCourt?.name || "GAME"}
              {` · ${submittedGame.sport === "BASKETBALL" ? "BB" : "PB"}`}
            </Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>PENDING</Text>
            </View>
          </View>
          <View style={styles.successScoreRow}>
            <View style={styles.successPlayer}>
              <Text numberOfLines={1} style={styles.successPlayerName}>
                {currentUser.name}
              </Text>
              <Text style={styles.successScore}>{submittedGame.myScore}</Text>
            </View>
            <Text style={styles.successDash}>–</Text>
            <View style={[styles.successPlayer, styles.successPlayerRight]}>
              <Text numberOfLines={1} style={styles.successPlayerName}>
                {submittedGame.opponentName}
              </Text>
              <Text style={styles.successScore}>{submittedGame.theirScore}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: 20,
        gap: 20,
        // Must come AFTER `padding` (shorthand would reset it to 20) so the
        // submit button clears the bottom tab bar: 84px fixed bar on web
        // (50 + 34), safe-area inset + bar height on native. +20 breathing room.
        paddingBottom: inSheet
          ? 32
          : 20 + (Platform.OS === "web" ? 84 : bottom + 80),
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Court */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>COURT</Text>
        <Pressable
          accessibilityLabel="Select court"
          accessibilityRole="button"
          accessibilityState={{ expanded: showCourtPicker }}
          onPress={() => setShowCourtPicker((shown) => !shown)}
          style={styles.opponentTrigger}
        >
          <Text
            numberOfLines={1}
            style={
              selectedCourt
                ? styles.opponentSelectedText
                : styles.opponentPlaceholder
            }
          >
            {selectedCourt?.name ?? "Select a court"}
          </Text>
          <Ionicons
            name={showCourtPicker ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.muted}
          />
        </Pressable>
        {showCourtPicker ? (
          <View style={styles.opponentDropdown}>
            {supportedCourts.map((c) => (
              <Pressable
                key={c.id}
                style={styles.opponentOption}
                onPress={() => {
                  setForm((f) => ({ ...f, courtId: c.id, sport: c.sport }));
                  setShowCourtPicker(false);
                }}
              >
                <Text numberOfLines={1} style={styles.opponentOptionName}>
                  {c.name}
                </Text>
                {form.courtId === c.id ? (
                  <Ionicons name="checkmark" size={16} color={Colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* The selected court controls the sport used for ranking. */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>RANKED SPORT</Text>
        <View style={styles.sportGrid}>
          {form.sport ? (
            <View style={[styles.sportOption, styles.sportOptionActive]}>
              <View
                style={[
                  styles.sportOptionDot,
                  { backgroundColor: getSportColor(form.sport) },
                ]}
              />
              <Text
                style={[styles.sportOptionText, styles.sportOptionTextActive]}
              >
                {form.sport}
              </Text>
            </View>
          ) : (
            <Text style={styles.opponentPlaceholder}>CHOOSE A COURT FIRST</Text>
          )}
        </View>
      </View>

      {/* Opponent */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>OPPONENT</Text>
        <View style={styles.opponentTriggerShell}>
          <Pressable
            accessibilityLabel={
              form.opponentName
                ? `Change opponent, currently ${form.opponentName}`
                : "Select opponent"
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: showOpponentPicker }}
            style={styles.opponentTriggerMain}
            onPress={() => setShowOpponentPicker((s) => !s)}
          >
            {form.opponentName ? (
              <Text numberOfLines={1} style={styles.opponentSelectedText}>
                {form.opponentName.toUpperCase()}
              </Text>
            ) : (
              <Text numberOfLines={1} style={styles.opponentPlaceholder}>
                Select or type opponent name
              </Text>
            )}
            <Ionicons
              name={showOpponentPicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={Colors.muted}
            />
          </Pressable>
          {form.opponentName ? (
            <Pressable
              accessibilityLabel="Clear selected opponent"
              accessibilityRole="button"
              onPress={handleClearOpponent}
              style={styles.clearOpponent}
            >
              <Ionicons name="close" size={17} color={Colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {showOpponentPicker && (
          <View style={styles.opponentDropdown}>
            <View style={styles.opponentSearch}>
              <Ionicons name="search" size={14} color={Colors.muted} />
              <TextInput
                style={styles.opponentSearchInput}
                value={opponentQuery}
                onChangeText={setOpponentQuery}
                placeholder="Type to search..."
                placeholderTextColor={Colors.mutedDark}
                autoFocus
                autoCapitalize="none"
              />
            </View>

            {friends.length > 0 && !query && (
              <Text style={styles.opponentSection}>YOUR FRIENDS</Text>
            )}
            {opponentSuggestions.map((p) => (
              <Pressable
                key={p.id}
                style={styles.opponentOption}
                onPress={() => handleSelectOpponent(p)}
              >
                <PlayerAvatar
                  initials={p.avatar}
                  name={p.name}
                  playerId={p.id}
                  size={28}
                />
                <View style={styles.opponentOptionInfo}>
                  <Text style={styles.opponentOptionName}>
                    {p.name.toUpperCase()}
                  </Text>
                  <Text style={styles.opponentOptionMeta}>
                    {p.tier} · {p.elo} ELO
                  </Text>
                </View>
                {isFriend(p.id) && (
                  <View style={styles.opponentFriendBadge}>
                    <Text style={styles.opponentFriendBadgeText}>FRIEND</Text>
                  </View>
                )}
              </Pressable>
            ))}

            {opponentSuggestions.length === 0 && query.length > 0 && (
              <Text style={styles.opponentEmpty}>No players found</Text>
            )}
          </View>
        )}
      </View>

      {/* Score */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>FINAL SCORE</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBlock}>
            <Text style={styles.scorePlayerLabel}>
              {currentUser.name.split(" ")[0].toUpperCase()}
            </Text>
            <TextInput
              style={[
                styles.scoreInput,
                isWin && styles.scoreInputWin,
                isLoss && styles.scoreInputLoss,
              ]}
              value={form.myScore}
              accessibilityLabel={`${currentUser.name} final score`}
              onChangeText={(v) =>
                setForm((f) => ({ ...f, myScore: v.replace(/\D/g, "") }))
              }
              keyboardType="number-pad"
              maxLength={3}
              placeholder="—"
              placeholderTextColor={Colors.mutedDark}
            />
          </View>
          <Text style={styles.scoreDash}>:</Text>
          <View style={styles.scoreBlock}>
            <Text style={styles.scorePlayerLabel}>OPPONENT</Text>
            <TextInput
              style={[
                styles.scoreInput,
                isLoss && styles.scoreInputWin,
                isWin && styles.scoreInputLoss,
              ]}
              value={form.theirScore}
              accessibilityLabel="Opponent final score"
              onChangeText={(v) =>
                setForm((f) => ({ ...f, theirScore: v.replace(/\D/g, "") }))
              }
              keyboardType="number-pad"
              maxLength={3}
              placeholder="—"
              placeholderTextColor={Colors.mutedDark}
            />
          </View>
        </View>
        {(isWin || isLoss) && (
          <Text
            style={[
              styles.resultHint,
              { color: isWin ? Colors.win : Colors.loss },
            ]}
          >
            {isWin ? "WIN — POSITIVE ELO CHANGE" : "LOSS — NEGATIVE ELO CHANGE"}
          </Text>
        )}
        {isTie && (
          <Text style={[styles.resultHint, { color: Colors.loss }]}>
            TIES CAN'T BE LOGGED — ENTER A WINNING SCORE
          </Text>
        )}
      </View>

      {/* Note */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>NOTES (optional)</Text>
        <TextInput
          style={[styles.textField, styles.textArea]}
          value={form.note}
          accessibilityLabel="Optional game notes"
          onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
          placeholder="How was the run?"
          placeholderTextColor={Colors.mutedDark}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit */}
      {submitError && <Text style={styles.submitError}>{submitError}</Text>}
      <Pressable
        accessibilityLabel="Log game for opponent review"
        accessibilityRole="button"
        accessibilityState={{
          busy: submitting,
          disabled: !canSubmit || submitting,
        }}
        style={[
          styles.submitBtn,
          (!canSubmit || submitting) && styles.submitBtnDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        <Text
          style={[
            styles.submitBtnText,
            (!canSubmit || submitting) && styles.submitBtnTextDisabled,
          ]}
        >
          {submitting ? "LOGGING..." : "LOG GAME"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerTools: { flexDirection: "row", alignItems: "center", gap: 8 },
  logGameAction: {
    minHeight: 30,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: Radius.xs,
    backgroundColor: Colors.accent,
  },
  logGameActionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.black,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.72 },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerEyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  headerSub: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },
  myRankBadge: {
    alignItems: "center",
    paddingBottom: 2,
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
  myRankLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },

  // ── Inline private position indicator ──
  hiddenLeaderRow: {
    backgroundColor: Colors.surfaceHigh,
    opacity: 0.48,
  },
  yourPositionRank: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.muted,
    width: 28,
    textAlign: "center" as const,
  },
  hiddenAvatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yourPositionText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  yourPositionSub: {
    ...TextStyles.caption,
    color: Colors.mutedDark,
    letterSpacing: 0,
    textTransform: "uppercase" as const,
    marginTop: 3,
  },
  hiddenBadge: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.mutedDark,
    letterSpacing: 1.2,
  },

  // ── Tabs ──
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: Colors.accent },
  tabBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 2,
  },
  tabBtnTextActive: { color: Colors.text },

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
  rankedText: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 0.6,
  },
  sportText: {
    ...TextStyles.labelSmall,
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
  eloBlock: { alignItems: "flex-end" },
  eloVal: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    lineHeight: 22,
  },
  eloValHidden: { color: Colors.textSecondary },
  eloLbl: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  leaderFriendBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.win,
    borderRadius: 2,
  },
  leaderFriendBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.win,
    letterSpacing: 0.5,
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

  // ── Log Game ──
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
  },
  sportGrid: { flexDirection: "row", gap: 10 },
  sportOption: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 14,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  sportOptionActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  sportOptionDot: { width: 8, height: 8, borderRadius: 4 },
  sportOptionText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 1,
  },
  sportOptionTextActive: { color: Colors.text },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreBlock: { flex: 1, alignItems: "center", gap: 6 },
  scorePlayerLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  scoreInput: {
    fontFamily: Typography.heading,
    fontSize: 48,
    color: Colors.text,
    textAlign: "center" as const,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    width: "100%",
    paddingVertical: 4,
    lineHeight: 56,
  },
  scoreInputWin: { borderBottomColor: Colors.win, color: Colors.win },
  scoreInputLoss: { borderBottomColor: Colors.loss, color: Colors.loss },
  scoreDash: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.mutedDark,
  },
  resultHint: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    textAlign: "center" as const,
    marginTop: 4,
  },

  textField: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  textArea: { height: 80, textAlignVertical: "top" as const },

  courtPills: { gap: 8, paddingVertical: 4 },
  courtPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  courtPillActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceHigh,
  },
  courtPillText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
  },
  courtPillTextActive: { color: Colors.text },

  submitBtn: {
    minHeight: 52,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    alignItems: "center",
    borderRadius: Radius.xs,
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
  },
  submitBtnText: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.black,
    letterSpacing: 2,
  },
  submitBtnTextDisabled: { color: Colors.muted },
  submitError: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.loss,
    letterSpacing: 1.5,
    textAlign: "center" as const,
    marginBottom: 10,
  },

  successState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  successIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: Colors.accent,
  },
  successTitle: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: 3,
  },
  successSub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center" as const,
  },
  successCard: {
    width: "100%",
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  successCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  successCourt: {
    flex: 1,
    minWidth: 0,
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  pendingBadge: {
    minHeight: 24,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    backgroundColor: Colors.accentDim,
  },
  pendingText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1,
  },
  successScoreRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  successPlayer: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  successPlayerRight: { alignItems: "flex-end" },
  successPlayerName: {
    maxWidth: "100%",
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
  },
  successScore: {
    marginTop: 4,
    fontFamily: Typography.headingBold,
    fontSize: 38,
    lineHeight: 42,
    color: Colors.text,
  },
  successDash: {
    paddingBottom: 5,
    fontFamily: Typography.headingRegular,
    fontSize: 28,
    color: Colors.mutedDark,
  },

  // Opponent selector
  opponentTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  opponentTriggerShell: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
  },
  opponentTriggerMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  clearOpponent: {
    width: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
  },
  opponentSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  opponentSelectedText: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  opponentPlaceholder: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.mutedDark,
  },
  opponentDropdown: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginTop: 6,
    maxHeight: 280,
    overflow: "hidden",
  },
  opponentSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  opponentSearchInput: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 2,
  },
  opponentSection: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  opponentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  opponentOptionInfo: { flex: 1 },
  opponentOptionName: {
    fontFamily: Typography.bodyBold,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  opponentOptionMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 1,
  },
  opponentFriendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.win,
  },
  opponentFriendBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.win,
    letterSpacing: 1,
  },
  opponentEmpty: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    textAlign: "center",
    paddingVertical: 20,
  },
});
