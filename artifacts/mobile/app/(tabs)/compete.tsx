import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { Colors, Radius } from "@/constants/colors";
import { CourtSport, getSportColor, getTierColor, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { fetchLeaderboard } from "@/services/profileService";
import { logGame } from "@/services/gameService";
import { searchPlayers } from "@/services/profileService";

// BACKEND NOTE:
// Leaderboard → GET /api/v1/leaderboard?sport=&scope=global|local|regional
// Log game → POST /api/v1/matches { courtId, opponentId, score, sport }

type Tab = "LEADERBOARD" | "LOG GAME";
type Scope = "GLOBAL" | "REGIONAL" | "LOCAL";
const SPORT_TABS: (CourtSport | "ALL")[] = ["ALL", "BASKETBALL", "PICKLEBALL"];

export default function CompeteScreen() {
  const {
    localCourtId,
    localCourt,
    currentUser,
    isLocalPlus,
    visibility,
    preferredSport,
    preferredCourtId,
  } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  // Deep-link support: /(tabs)/compete?tab=log&courtId=... opens Log Game
  // pre-scoped to a court (used by the run screen's LOG A GAME button).
  // ?opponentId=... additionally preselects the opponent (used by the
  // player profile's LOG GAME button).
  const params = useLocalSearchParams<{ tab?: string; courtId?: string; opponentId?: string }>();

  const [tab, setTab] = useState<Tab>(params.tab === "log" ? "LOG GAME" : "LEADERBOARD");
  const [scope, setScope] = useState<Scope>("LOCAL");
  const [sportFilter, setSportFilter] = useState<CourtSport | "ALL">(
    preferredSport ?? "ALL"
  );
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  // Bumped after a confirmed logged game so standings reflect the Elo change.
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);

  useEffect(() => {
    if (params.tab === "log") setTab("LOG GAME");
  }, [params.tab]);

  // Fetch real leaderboard from Supabase whenever scope/sport/local court changes
  useEffect(() => {
    let mounted = true;
    setLeaderboardLoading(true);
    fetchLeaderboard(scope, scope === "LOCAL" ? localCourtId : null, sportFilter === "ALL" ? null : sportFilter)
      .then((players) => {
        if (!mounted) return;
        // Public leaderboard visibility: only show players with public-ish visibility.
        // The profiles table has no visibility column, so we show everyone.
        // LocalPlus paywall is preserved conceptually but not enforced by data.
        const visible = players;
        setLeaderboardPlayers(visible);
        setAllPlayers(players);
      })
      .finally(() => { if (mounted) setLeaderboardLoading(false); });
    return () => { mounted = false; };
  }, [scope, sportFilter, localCourtId, leaderboardRefreshKey]);

  // Opponent preselect (deep link): resolve only if the player exists in the
  // loaded player list; otherwise the picker stays empty as usual.
  const preselectedOpponent =
    typeof params.opponentId === "string"
      ? allPlayers.find((p) => p.id === params.opponentId) ?? null
      : null;

  const myRank = allPlayers.findIndex((p) => p.id === currentUser.id) + 1;
  const amIVisible = visibility === "public" && isLocalPlus;
  const showMyRank = myRank > 0 && amIVisible;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={styles.headerEyebrow}>LOCALCHECK</Text>
          <Text style={styles.headerTitle}>COMPETE</Text>
          <Text style={styles.headerSub}>
            {scope === "LOCAL" && localCourt
              ? localCourt.name.toUpperCase()
              : scope === "LOCAL"
              ? "LOCAL RANKINGS"
              : scope === "REGIONAL"
              ? "REGIONAL RANKINGS"
              : "GLOBAL RANKINGS"}
          </Text>
        </View>
        {myRank > 0 && (
          <View style={styles.myRankBadge}>
            <Text style={[styles.myRankNum, !showMyRank && styles.myRankNumDim]}>#{myRank}</Text>
            <Text style={styles.myRankLabel}>
              {showMyRank ? "YOUR RANK" : "HIDDEN — LOCALPLUS"}
            </Text>
          </View>
        )}
      </View>

      {/* ── Tab Row ── */}
      <View style={styles.tabRow}>
        {(["LEADERBOARD", "LOG GAME"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "LEADERBOARD" ? (
        <LeaderboardView
          players={leaderboardPlayers}
          allPlayers={allPlayers}
          myRank={myRank}
          showMyRank={showMyRank}
          scope={scope}
          setScope={setScope}
          sportFilter={sportFilter}
          setSportFilter={setSportFilter}
          localCourt={localCourt}
          bottom={bottom}
          loading={leaderboardLoading}
        />
      ) : (
        <LogGameView
          currentUser={currentUser}
          courts={localCourt ? [localCourt] : []}
          bottom={bottom}
          preferredSport={preferredSport}
          preferredCourtId={(typeof params.courtId === "string" ? params.courtId : null) ?? preferredCourtId}
          preselectedOpponent={preselectedOpponent}
          localCourtId={localCourtId}
          onLogged={() => setLeaderboardRefreshKey((k) => k + 1)}
        />
      )}
    </View>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function LeaderboardView({
  players,
  allPlayers,
  myRank,
  showMyRank,
  scope,
  setScope,
  sportFilter,
  setSportFilter,
  localCourt,
  bottom,
  loading,
}: {
  players: Player[];
  allPlayers: Player[];
  myRank: number;
  showMyRank: boolean;
  scope: Scope;
  setScope: (s: Scope) => void;
  sportFilter: CourtSport | "ALL";
  setSportFilter: (f: CourtSport | "ALL") => void;
  localCourt: { id: string; name: string; sport: CourtSport } | null;
  bottom: number;
  loading?: boolean;
}) {
  const router = useRouter();
  const { isFriend } = useApp();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 84 : bottom + 100,
      }}
    >
      {/* Scope + sport filters */}
      <View style={styles.filtersRow}>
        <View style={styles.scopeToggle}>
          {(["LOCAL", "REGIONAL", "GLOBAL"] as Scope[]).map((s) => (
            <Pressable
              key={s}
              style={[styles.scopeBtn, scope === s && styles.scopeBtnActive]}
              onPress={() => setScope(s)}
            >
              <Text style={[styles.scopeBtnText, scope === s && styles.scopeBtnTextActive]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sportPills}
        >
          {SPORT_TABS.map((sp) => (
            <Pressable
              key={sp}
              style={[styles.sportPill, sportFilter === sp && styles.sportPillActive]}
              onPress={() => setSportFilter(sp)}
            >
              <Text
                style={[
                  styles.sportPillText,
                  sportFilter === sp && styles.sportPillTextActive,
                ]}
              >
                {sp === "ALL" ? "All" : sp === "BASKETBALL" ? "BB" : "PB"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Scope label */}
      {scope === "LOCAL" && localCourt && (
        <View style={styles.scopeLabel}>
          <View
            style={[
              styles.scopeDot,
              { backgroundColor: getSportColor(localCourt.sport) },
            ]}
          />
          <Text style={styles.scopeLabelText}>{localCourt.name.toUpperCase()}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : players.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>NO PLAYERS FOR THIS FILTER</Text>
        </View>
      ) : (
        <>
          {players.map((player, index) => {
            const tierColor = getTierColor(player.tier);
            const isTop3 = index < 3;
            const sportColor = player.sport ? getSportColor(player.sport) : Colors.muted;
            return (
              <Pressable
                key={player.id}
                style={[styles.leaderRow, index === 0 && styles.leaderRowFirst]}
                onPress={() => router.push(`/player/${player.id}`)}
              >
                <Text style={[styles.rank, isTop3 && styles.rankTop]}>
                  {index + 1}
                </Text>
                <PlayerAvatar initials={player.avatar} size={36} accent={index === 0} />
                <View style={styles.playerInfo}>
                  <View style={styles.playerNameRow}>
                    <Text style={styles.playerName} numberOfLines={1}>{player.name.toUpperCase()}</Text>
                    {isFriend(player.id) && (
                      <View style={styles.leaderFriendBadge}>
                        <Text style={styles.leaderFriendBadgeText}>FRIEND</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.playerBadges}>
                    {player.sport && (
                      <Text style={[styles.sportText, { color: sportColor }]}>
                        {player.sport === "BASKETBALL" ? "BB" : "PB"}
                      </Text>
                    )}
                    <Text style={[styles.tierText, { color: tierColor }]}>
                      {player.tier}
                    </Text>
                    <Text style={styles.wlText}>
                      {player.wins}W · {player.losses}L
                    </Text>
                  </View>
                </View>
                <View style={styles.eloBlock}>
                  <Text style={styles.eloVal}>{player.elo}</Text>
                  <Text style={styles.eloLbl}>ELO</Text>
                </View>
              </Pressable>
            );
          })}
          {/* Show "Your Position" indicator if user is ranked but not visible in leaderboard */}
          {!showMyRank && myRank > 0 && (
            <View style={styles.yourPositionRow}>
              <Text style={styles.yourPositionRank}>#{myRank}</Text>
              <Ionicons name="person" size={16} color={Colors.muted} />
              <Text style={styles.yourPositionText}>YOU — HIDDEN</Text>
              <Text style={styles.yourPositionSub}>
                Go public + LocalPlus to appear
              </Text>
            </View>
          )}
        </>
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
  onLogged,
}: {
  currentUser: ReturnType<typeof useApp>["currentUser"];
  courts: ReturnType<typeof useApp>["courts"] | { id: string; name: string }[];
  bottom: number;
  preferredSport: CourtSport | null;
  preferredCourtId: string | null;
  preselectedOpponent: Player | null;
  localCourtId: string | null;
  onLogged: () => void;
}) {
  const { isFriend, getFriendsList, refreshMatches, refreshFeed } = useApp();
  const { refreshProfile } = useAuth();

  // Default court: preferredCourtId > localCourtId > empty
  const defaultCourtId = preferredCourtId ?? localCourtId ?? "";
  const defaultSport = preferredSport ?? "";

  const [form, setForm] = useState<GameLog>({
    sport: defaultSport,
    myScore: "",
    theirScore: "",
    opponentName: "",
    opponentId: "",
    courtId: defaultCourtId,
    note: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [opponentQuery, setOpponentQuery] = useState("");
  const [opponentSuggestions, setOpponentSuggestions] = useState<Player[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
        : { ...f, opponentName: preselectedOpponent.name, opponentId: preselectedOpponent.id }
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

  const handleSubmit = async () => {
    if (!canSubmit || !form.opponentId || !form.courtId) return;
    setSubmitting(true);
    setSubmitError(null);
    let ok = false;
    try {
      ok = await logGame({
        courtId: form.courtId,
        createdBy: currentUser.id,
        myScore: myScoreNum,
        theirScore: theirScoreNum,
        opponentId: form.opponentId,
        sport: form.sport as CourtSport,
        note: form.note,
      });
    } catch (e) {
      console.warn("logGame failed", e);
      ok = false;
    }
    setSubmitting(false);
    if (!ok) {
      // Keep the form intact so the user can retry.
      setSubmitError("COULD NOT LOG GAME — NOTHING WAS SAVED. TRY AGAIN.");
      return;
    }
    // Confirmed write: the RPC has already updated both players' Elo and
    // win/loss counts. Pull the fresh state everywhere it's displayed.
    refreshProfile();
    refreshMatches();
    refreshFeed();
    onLogged();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
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
    return () => { mounted = false; };
  }, [query, friends, currentUser.id]);

  const handleSelectOpponent = (player: Player) => {
    setForm((f) => ({ ...f, opponentName: player.name, opponentId: player.id }));
    setOpponentQuery("");
    setShowOpponentPicker(false);
  };

  const handleClearOpponent = () => {
    setForm((f) => ({ ...f, opponentName: "", opponentId: "" }));
    setOpponentQuery("");
  };

  if (submitted) {
    return (
      <View style={styles.successState}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>GAME LOGGED</Text>
        <Text style={styles.successSub}>ELO and records updated for both players.</Text>
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
        paddingBottom: 20 + (Platform.OS === "web" ? 84 : bottom + 80),
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Court */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>COURT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courtPills}>
          {courts.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.courtPill, form.courtId === c.id && styles.courtPillActive]}
              onPress={() => setForm((f) => ({ ...f, courtId: c.id }))}
            >
              <Text style={[styles.courtPillText, form.courtId === c.id && styles.courtPillTextActive]}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Sport */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>SPORT</Text>
        <View style={styles.sportGrid}>
          {(["BASKETBALL", "PICKLEBALL"] as CourtSport[]).map((s) => (
            <Pressable
              key={s}
              style={[styles.sportOption, form.sport === s && styles.sportOptionActive]}
              onPress={() => setForm((f) => ({ ...f, sport: s }))}
            >
              <View
                style={[
                  styles.sportOptionDot,
                  { backgroundColor: getSportColor(s) },
                ]}
              />
              <Text
                style={[
                  styles.sportOptionText,
                  form.sport === s && styles.sportOptionTextActive,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Opponent */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>OPPONENT</Text>
        <Pressable
          style={styles.opponentTrigger}
          onPress={() => setShowOpponentPicker((s) => !s)}
        >
          {form.opponentName ? (
            <View style={styles.opponentSelected}>
              <Text style={styles.opponentSelectedText}>{form.opponentName.toUpperCase()}</Text>
              <Pressable onPress={handleClearOpponent} hitSlop={8}>
                <Ionicons name="close" size={16} color={Colors.muted} />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.opponentPlaceholder}>Select or type opponent name</Text>
          )}
          <Ionicons
            name={showOpponentPicker ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.muted}
          />
        </Pressable>

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
                <PlayerAvatar initials={p.avatar} size={28} />
                <View style={styles.opponentOptionInfo}>
                  <Text style={styles.opponentOptionName}>{p.name.toUpperCase()}</Text>
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
            <Text style={styles.scorePlayerLabel}>{currentUser.name.split(" ")[0].toUpperCase()}</Text>
            <TextInput
              style={[
                styles.scoreInput,
                isWin && styles.scoreInputWin,
                isLoss && styles.scoreInputLoss,
              ]}
              value={form.myScore}
              onChangeText={(v) => setForm((f) => ({ ...f, myScore: v.replace(/\D/g, "") }))}
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
              onChangeText={(v) => setForm((f) => ({ ...f, theirScore: v.replace(/\D/g, "") }))}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="—"
              placeholderTextColor={Colors.mutedDark}
            />
          </View>
        </View>
        {(isWin || isLoss) && (
          <Text style={[styles.resultHint, { color: isWin ? Colors.win : Colors.loss }]}>
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
        style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        <Text style={[styles.submitBtnText, (!canSubmit || submitting) && styles.submitBtnTextDisabled]}>
          {submitting ? "LOGGING..." : "LOG GAME"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

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

  // ── Hidden position indicator ──
  yourPositionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
  },
  yourPositionRank: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.muted,
    width: 28,
    textAlign: "center" as const,
  },
  yourPositionText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 0.5,
    flex: 1,
  },
  yourPositionSub: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.mutedDark,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
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
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  scopeToggle: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignSelf: "flex-start",
    borderRadius: Radius.xs,
    overflow: "hidden",
  },
  scopeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  scopeBtnActive: { backgroundColor: Colors.surfaceHigh },
  scopeBtnText: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  scopeBtnTextActive: { color: Colors.text },
  sportPills: { gap: 6, alignItems: "center" },
  sportPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
  },
  sportPillActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  sportPillText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
  },
  sportPillTextActive: { color: Colors.accent },
  scopeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  leaderRowFirst: { backgroundColor: `${Colors.accent}08` },
  rank: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.muted,
    width: 28,
    textAlign: "center" as const,
  },
  rankTop: { color: Colors.text, fontSize: 22 },
  playerInfo: { flex: 1 },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  playerName: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.3,
    flex: 1,
  },
  playerBadges: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  tierText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  sportText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  wlText: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
  },
  eloBlock: { alignItems: "flex-end" },
  eloVal: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    lineHeight: 22,
  },
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
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
  },
  sportGrid: { flexDirection: "row", gap: 10 },
  sportOption: {
    flex: 1,
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
    backgroundColor: Colors.accent,
    padding: 16,
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
    justifyContent: "center",
    gap: 12,
  },
  successIcon: {
    fontFamily: Typography.heading,
    fontSize: 48,
    color: Colors.win,
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
    minHeight: 44,
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
