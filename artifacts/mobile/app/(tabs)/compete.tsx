import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
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
import {
  CourtSport,
  getSportColor,
  getTierColor,
  SAMPLE_PLAYERS,
} from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";

// BACKEND NOTE:
// Leaderboard → GET /api/v1/leaderboard?sport=&scope=global|local
// Log game → POST /api/v1/matches { courtId, opponentId, score, sport }

type Tab = "LEADERBOARD" | "LOG GAME";
type Scope = "GLOBAL" | "MY LOCAL";
const SPORT_TABS: (CourtSport | "ALL")[] = ["ALL", "BASKETBALL", "PICKLEBALL"];

export default function CompeteScreen() {
  const { courts, localCourtId, currentUser, isLocalPlus, visibility } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [tab, setTab] = useState<Tab>("LEADERBOARD");
  const [scope, setScope] = useState<Scope>("GLOBAL");
  const [sportFilter, setSportFilter] = useState<CourtSport | "ALL">("ALL");

  const localCourt = localCourtId ? courts.find((c) => c.id === localCourtId) ?? null : null;

  // Only LocalPlus users with public visibility show on public leaderboard
  // Free users can see where they'd fall, but aren't listed publicly
  const leaderboardPlayers = SAMPLE_PLAYERS.filter((p) => {
    const sportMatch = sportFilter === "ALL" || p.sport === sportFilter;
    const scopeMatch =
      scope === "GLOBAL" ? true : localCourtId ? p.courtId === localCourtId : true;
    // Only public + LocalPlus users appear on public leaderboard
    // Private users never appear, friends-only users appear only in local scope
    const isVisible = p.visibility === "public" && p.isLocalPlus;
    return sportMatch && scopeMatch && isVisible;
  }).sort((a, b) => b.elo - a.elo);

  // Compute my rank among all players (including hidden) to show where I'd fall
  const allPlayersFiltered = SAMPLE_PLAYERS.filter((p) => {
    const sportMatch = sportFilter === "ALL" || p.sport === sportFilter;
    const scopeMatch =
      scope === "GLOBAL" ? true : localCourtId ? p.courtId === localCourtId : true;
    return sportMatch && scopeMatch;
  }).sort((a, b) => b.elo - a.elo);

  const myRank = allPlayersFiltered.findIndex((p) => p.name === currentUser.name) + 1;
  const amIVisible = visibility === "public" && isLocalPlus;
  const showMyRank = myRank > 0 && amIVisible;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>COMPETE</Text>
          <Text style={styles.headerSub}>
            {scope === "MY LOCAL" && localCourt
              ? localCourt.name.toUpperCase()
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
          allPlayers={allPlayersFiltered}
          myRank={myRank}
          showMyRank={showMyRank}
          scope={scope}
          setScope={setScope}
          sportFilter={sportFilter}
          setSportFilter={setSportFilter}
          localCourt={localCourt}
          bottom={bottom}
        />
      ) : (
        <LogGameView currentUser={currentUser} courts={courts} bottom={bottom} />
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
}: {
  players: ReturnType<typeof SAMPLE_PLAYERS.filter>;
  allPlayers: ReturnType<typeof SAMPLE_PLAYERS.filter>;
  myRank: number;
  showMyRank: boolean;
  scope: Scope;
  setScope: (s: Scope) => void;
  sportFilter: CourtSport | "ALL";
  setSportFilter: (f: CourtSport | "ALL") => void;
  localCourt: ReturnType<typeof Array.prototype.find> | null;
  bottom: number;
}) {
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
          {(["GLOBAL", "MY LOCAL"] as Scope[]).map((s) => (
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
                {sp === "ALL" ? "All" : sp === "BASKETBALL" ? "Ball" : "PB"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Scope label */}
      {scope === "MY LOCAL" && localCourt && (
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

      {players.length === 0 ? (
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
              <View
                key={player.id}
                style={[styles.leaderRow, index === 0 && styles.leaderRowFirst]}
              >
                <Text style={[styles.rank, isTop3 && styles.rankTop]}>
                  {index + 1}
                </Text>
                <PlayerAvatar initials={player.avatar} size={40} accent={index === 0} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name.toUpperCase()}</Text>
                  <View style={styles.playerBadges}>
                    <Text style={[styles.tierText, { color: tierColor }]}>
                      {player.tier}
                    </Text>
                    {player.sport && (
                      <Text style={[styles.sportText, { color: sportColor }]}>
                        {player.sport}
                      </Text>
                    )}
                    <Text style={styles.wlText}>
                      {player.wins}W · {player.losses}L
                    </Text>
                  </View>
                </View>
                <View style={styles.eloBlock}>
                  <Text style={styles.eloVal}>{player.elo}</Text>
                  <Text style={styles.eloLbl}>ELO</Text>
                </View>
              </View>
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
  courtId: string;
  note: string;
};

function LogGameView({
  currentUser,
  courts,
  bottom,
}: {
  currentUser: ReturnType<typeof useApp>["currentUser"];
  courts: ReturnType<typeof useApp>["courts"];
  bottom: number;
}) {
  const [form, setForm] = useState<GameLog>({
    sport: "",
    myScore: "",
    theirScore: "",
    opponentName: "",
    courtId: "",
    note: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const isWin =
    form.myScore !== "" &&
    form.theirScore !== "" &&
    Number(form.myScore) > Number(form.theirScore);
  const isLoss =
    form.myScore !== "" &&
    form.theirScore !== "" &&
    Number(form.myScore) < Number(form.theirScore);

  const canSubmit =
    form.sport !== "" && form.myScore !== "" && form.theirScore !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    // BACKEND NOTE: POST /api/v1/matches { sport, myScore, theirScore, opponentName, courtId }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setForm({ sport: "", myScore: "", theirScore: "", opponentName: "", courtId: "", note: "" });
  };

  if (submitted) {
    return (
      <View style={styles.successState}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>GAME LOGGED</Text>
        <Text style={styles.successSub}>ELO will update after verification.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 84 : bottom + 100,
        padding: 20,
        gap: 20,
      }}
      keyboardShouldPersistTaps="handled"
    >
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
      </View>

      {/* Opponent */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>OPPONENT NAME (optional)</Text>
        <TextInput
          style={styles.textField}
          value={form.opponentName}
          onChangeText={(v) => setForm((f) => ({ ...f, opponentName: v }))}
          placeholder="e.g. Marcus J."
          placeholderTextColor={Colors.mutedDark}
        />
      </View>

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
      <Pressable
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
          LOG GAME
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
  playerName: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.3,
    marginBottom: 3,
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
});
