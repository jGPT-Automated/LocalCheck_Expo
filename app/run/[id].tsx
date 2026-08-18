import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { LogoMark } from "@/components/brand/LogoMark";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import {
  formatForMaxPlayers,
  generatedScheduledGameTitle,
  maxPlayersForFormat,
  scheduledFormatsForSport,
  validateTeamAssignments,
  type ScheduledGameFormat,
  type TeamAssignment,
} from "@/components/schedule/scheduledGameModel";
import { Colors, Radius } from "@/constants/colors";
import { formatClockTime } from "@/components/home/homePresentation";
import { getSportColor, type CourtSport, type Player } from "@/constants/data";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { inviteFriendToRun } from "@/services/notificationService";
import { logScheduledGameResult } from "@/services/gameService";
import { updateScheduledGame } from "@/services/scheduledGameService";

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { runs, joinRun, currentUser, refreshRuns, getFriendsList } = useApp();
  const realtimeHub = useRealtimeHub();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    return realtimeHub.subscribe(`run:${id}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, ["runs", "run_participants"])) void refreshRuns();
    });
  }, [id, realtimeHub, refreshRuns]);

  const run = runs.find((r) => r.id === id);
  if (!run) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>GAME NOT FOUND</Text>
        <BrutalistButton label="GO BACK" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const sportColor = getSportColor(run.sport);
  const total = run.participants.length;
  const max = run.maxPlayers;
  const spotsLeft = Math.max(0, max - total);
  const isJoined = run.participants.some((p) => p.id === currentUser.id);
  const isFull = spotsLeft === 0;
  const isHost = run.hostId === currentUser.id;
  const format = formatForMaxPlayers(run.maxPlayers) ?? "5V5";
  // Before the start time the run can be edited; after it, it's a played game to log.
  const hasStarted = new Date(run.startTimeIso).getTime() <= Date.now();
  const participantIds = new Set(run.participants.map((player) => player.id));
  const inviteableFriends = getFriendsList()
    .filter((friend) => !participantIds.has(friend.id))
    .slice(0, 8);

  const handleJoin = async () => {
    if (isJoined || isFull || joining) return;
    setJoining(true);
    setJoinError(false);
    const ok = await joinRun(run.id);
    setJoining(false);
    if (!ok) setJoinError(true);
  };

  const handleInvite = async (friendId: string) => {
    if (invitingId || invitedIds.includes(friendId)) return;
    setInvitingId(friendId);
    const ok = await inviteFriendToRun(run.id, friendId);
    setInvitingId(null);
    if (ok) setInvitedIds((ids) => [...ids, friendId]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: (Platform.OS === "web" ? 110 : bottom + 100) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
            <LogoMark size={30} variant="back" />
          </Pressable>
          <View style={styles.headerMain}>
            <Text style={[styles.headerEyebrow, { color: sportColor }]}>{run.sport}</Text>
            <Text style={styles.runTitle}>{format} GAME</Text>
          </View>
        </View>

        <View style={styles.factsRow}>
          <View style={styles.factItem}>
            <Feather color={Colors.accent} name="clock" size={14} />
            <Text style={styles.factLabel}>WHEN</Text>
            <Text numberOfLines={2} style={styles.factValue}>{run.date}{"\n"}{formatClockTime(run.time)}</Text>
          </View>
          <View style={[styles.factItem, styles.factBorder]}>
            <Feather color={Colors.accent} name="map-pin" size={14} />
            <Text style={styles.factLabel}>LOCATION</Text>
            <Text numberOfLines={2} style={styles.factValue}>{run.courtName}</Text>
          </View>
          <View style={[styles.factItem, styles.factBorder]}>
            <Feather color={Colors.accent} name="user" size={14} />
            <Text style={styles.factLabel}>CREATED BY</Text>
            <Text numberOfLines={2} style={styles.factValue}>{run.hostName?.split(" ")[0] ?? "Local player"}</Text>
          </View>
        </View>

        {/* Team assignment is finalized by the creator when the official result
            is submitted. Upcoming rosters stay neutral so the UI never invents
            authoritative teams before that choice exists. */}
        <View style={styles.rosterArea}>
          <View style={[styles.teamHeader, { borderBottomColor: sportColor }]}>
            <Text style={styles.teamLabel}>GAME ROSTER</Text>
            <Text style={styles.goingCount}>GOING {total}/{max}</Text>
          </View>
          {run.participants.map((player) => (
            <View key={player.id} style={styles.playerSlot}>
              <PlayerAvatar initials={player.avatar} name={player.name} playerId={player.id} size={34} />
              <View>
                <Text style={styles.slotName}>
                  {player.name.split(" ")[0]}
                  {player.id === run.hostId ? "  · CREATOR" : ""}
                </Text>
                <Text style={styles.slotElo}>{player.elo} ELO</Text>
              </View>
            </View>
          ))}
          {Array.from({ length: spotsLeft }).map((_, index) => (
            <View key={`open-${index}`} style={[styles.playerSlot, styles.openSlot]}>
              <View style={styles.openAvatar}><Feather color={Colors.mutedDark} name="plus" size={16} /></View>
              <View>
                <Text style={styles.openSlotName}>OPEN SPOT</Text>
                <Text style={styles.slotElo}>JOIN TO CLAIM</Text>
              </View>
            </View>
          ))}
        </View>

        {isHost && !hasStarted && inviteableFriends.length > 0 ? (
          <View style={styles.inviteSection}>
            <Text style={styles.resultLabel}>INVITE FRIENDS</Text>
            {inviteableFriends.slice(0, 2).map((friend) => {
              const invited = invitedIds.includes(friend.id);
              return (
                <View key={friend.id} style={styles.inviteRow}>
                  <PlayerAvatar initials={friend.avatar} name={friend.name} playerId={friend.id} size={32} />
                  <Text style={styles.inviteName} numberOfLines={1}>{friend.name.toUpperCase()}</Text>
                  <Pressable
                    style={[styles.inviteButton, invited && styles.inviteButtonDone]}
                    onPress={() => void handleInvite(friend.id)}
                    disabled={invited || invitingId === friend.id}
                  >
                    <Text style={[styles.inviteButtonText, invited && styles.inviteButtonTextDone]}>
                      {invited ? "INVITED" : invitingId === friend.id ? "SENDING…" : "INVITE"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* The scheduled game owns its result. Only its creator enters teams and
            score; every participant then receives the shared review state. */}
        {hasStarted ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>{isHost ? "GAME DONE? SUBMIT THE RESULT" : "RESULT STATUS"}</Text>
            <View style={styles.resultButtons}>
              {isHost ? (
                <BrutalistButton
                  label="SUBMIT RESULT"
                  onPress={() => setShowResult(true)}
                  variant="accent"
                  style={styles.resultBtn}
                  testID="log-game-btn"
                />
              ) : (
                <View style={styles.awaitingResult}>
                  <Text style={styles.awaitingResultTitle}>WAITING ON THE CREATOR</Text>
                  <Text style={styles.awaitingResultCopy}>You’ll be notified when the score is ready to review.</Text>
                </View>
              )}
            </View>
          </View>
        ) : isHost ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>MANAGE THIS GAME</Text>
            <View style={styles.resultButtons}>
              <BrutalistButton
                label="EDIT GAME"
                onPress={() => setShowEdit(true)}
                variant="outline"
                style={styles.resultBtn}
                testID="edit-run-btn"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <EditRunModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        runId={run.id}
        creatorName={run.hostName}
        sport={run.sport}
        initialMax={run.maxPlayers}
        goingCount={total}
        onSaved={refreshRuns}
      />

      <SubmitRunResultSheet
        visible={showResult}
        onClose={() => setShowResult(false)}
        runId={run.id}
        format={format}
        players={run.participants}
      />

      <View style={[styles.footer, { paddingBottom: (Platform.OS === "web" ? 34 : bottom) + 12 }]}>
        {joinError && <Text style={styles.joinError}>COULD NOT JOIN — TRY AGAIN</Text>}
        <BrutalistButton
          label={isJoined ? "YOU'RE GOING" : isFull ? "GAME FULL" : joining ? "JOINING…" : "JOIN GAME"}
          onPress={handleJoin}
          variant={isJoined ? "outline" : "accent"}
          style={{ flex: 1, opacity: isFull && !isJoined ? 0.5 : 1 }}
          testID="join-run-btn"
        />
      </View>
    </View>
  );
}

function EditRunModal({
  visible,
  onClose,
  runId,
  creatorName,
  sport,
  initialMax,
  goingCount,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  runId: string;
  creatorName?: string;
  sport: CourtSport;
  initialMax: number;
  goingCount: number;
  onSaved: () => Promise<void> | void;
}) {
  const [format, setFormat] = useState<ScheduledGameFormat>(formatForMaxPlayers(initialMax) ?? "5V5");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setFormat(formatForMaxPlayers(initialMax) ?? "5V5");
      setFailed(false);
    }
  }, [visible, initialMax]);

  const formats = scheduledFormatsForSport(sport).filter(
    (option) => maxPlayersForFormat(option) >= goingCount,
  );
  const handleSave = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await updateScheduledGame(runId, {
      title: generatedScheduledGameTitle(creatorName, format),
      maxPlayers: maxPlayersForFormat(format),
    });
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    await onSaved();
    onClose();
  };

  return (
    <RunFlowSheet visible={visible} onClose={onClose} eyebrow="UPCOMING GAME" title="Edit format">
          <Text style={styles.editHelper}>The title stays generated from the creator and format.</Text>
          <Text style={styles.editLabel}>FORMAT</Text>
          <View style={styles.editSizeRow}>
            {formats.map((option) => (
              <Pressable
                key={option}
                style={[styles.editSizeCell, format === option && styles.editSizeCellActive]}
                onPress={() => setFormat(option)}
              >
                <Text style={[styles.editSizeText, format === option && styles.editSizeTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          {failed && <Text style={styles.editError}>COULD NOT SAVE — TRY AGAIN</Text>}

          <Pressable style={[styles.editSaveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.editSaveText}>{saving ? "SAVING…" : "SAVE CHANGES"}</Text>
          </Pressable>
    </RunFlowSheet>
  );
}

function SubmitRunResultSheet({
  visible,
  onClose,
  runId,
  format,
  players,
}: {
  visible: boolean;
  onClose: () => void;
  runId: string;
  format: ScheduledGameFormat;
  players: Player[];
}) {
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teamSize = Number(format[0]);

  useEffect(() => {
    if (!visible) return;
    setAssignments([]);
    setScoreA("");
    setScoreB("");
    setError(null);
  }, [visible]);

  const teamA = assignments.filter((entry) => entry.side === "a");
  const teamB = assignments.filter((entry) => entry.side === "b");

  const assign = (playerId: string, side: "a" | "b") => {
    setAssignments((current) => {
      const existing = current.find((entry) => entry.playerId === playerId);
      if (existing?.side === side) return current.filter((entry) => entry.playerId !== playerId);
      const sideCount = current.filter((entry) => entry.side === side && entry.playerId !== playerId).length;
      if (sideCount >= teamSize) return current;
      return [...current.filter((entry) => entry.playerId !== playerId), { playerId, side }];
    });
  };

  const validation = validateTeamAssignments(players.map((player) => player.id), assignments, format);
  const parsedA = Number(scoreA);
  const parsedB = Number(scoreB);
  const validScore = scoreA !== "" && scoreB !== "" && Number.isInteger(parsedA) && Number.isInteger(parsedB) && parsedA !== parsedB;
  const canSubmit = validation.valid && validScore && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await logScheduledGameResult({
      runId,
      teamAIds: teamA.map((entry) => entry.playerId),
      teamBIds: teamB.map((entry) => entry.playerId),
      scoreA: parsedA,
      scoreB: parsedB,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not submit this result.");
      return;
    }
    onClose();
    if (result.matchId) router.push(`/match/${result.matchId}`);
  };

  return (
    <RunFlowSheet visible={visible} onClose={onClose} eyebrow={`${format} · OFFICIAL RESULT`} title="Set teams & score">
      <Text style={styles.resultHelp}>Put every rostered player on one team. Everyone gets three days to dispute the submitted score.</Text>
      <View style={styles.teamCountRow}>
        <View style={styles.teamCount}><Text style={styles.teamCountLabel}>TEAM A</Text><Text style={styles.teamCountValue}>{teamA.length}/{teamSize}</Text></View>
        <View style={styles.teamCount}><Text style={styles.teamCountLabel}>TEAM B</Text><Text style={styles.teamCountValue}>{teamB.length}/{teamSize}</Text></View>
      </View>

      <Text style={styles.editLabel}>ROSTER</Text>
      {players.map((player) => {
        const side = assignments.find((entry) => entry.playerId === player.id)?.side;
        return (
          <View key={player.id} style={styles.assignmentRow}>
            <PlayerAvatar initials={player.avatar} name={player.name} playerId={player.id} size={34} />
            <View style={styles.assignmentIdentity}>
              <Text style={styles.assignmentName} numberOfLines={1}>{player.name}</Text>
              <Text style={styles.assignmentElo}>{player.elo} ELO</Text>
            </View>
            <View style={styles.sideControl}>
              {(["a", "b"] as const).map((option) => (
                <Pressable key={option} onPress={() => assign(player.id, option)} style={[styles.sideButton, side === option && styles.sideButtonActive]}>
                  <Text style={[styles.sideButtonText, side === option && styles.sideButtonTextActive]}>{option.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      <Text style={styles.editLabel}>FINAL SCORE</Text>
      <View style={styles.scoreRow}>
        <View style={styles.scoreField}><Text style={styles.scoreLabel}>TEAM A</Text><TextInput value={scoreA} onChangeText={setScoreA} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.mutedDark} style={styles.scoreInput} /></View>
        <Text style={styles.scoreDash}>–</Text>
        <View style={styles.scoreField}><Text style={styles.scoreLabel}>TEAM B</Text><TextInput value={scoreB} onChangeText={setScoreB} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.mutedDark} style={styles.scoreInput} /></View>
      </View>

      {!validation.valid ? <Text style={styles.resultValidation}>{validation.reason}</Text> : null}
      {error ? <Text style={styles.editError}>{error.toUpperCase()}</Text> : null}
      <Pressable disabled={!canSubmit} onPress={submit} style={[styles.editSaveBtn, !canSubmit && styles.submitDisabled]}>
        <Text style={styles.editSaveText}>{submitting ? "SUBMITTING…" : "SUBMIT FOR REVIEW"}</Text>
      </Pressable>
      <Text style={styles.reviewFootnote}>No dispute: confirms after 3 days · Everyone approves: confirms early · Active dispute at deadline: dropped</Text>
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, minHeight: 0 },
  contentContainer: { flexGrow: 1 },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 40 },
  notFoundText: { fontFamily: Typography.heading, fontSize: 24, color: Colors.text, letterSpacing: 2 },
  header: {
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.black,
    flexDirection: "row", gap: 12, alignItems: "center",
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerMain: { flex: 1 },
  headerEyebrow: { ...TextStyles.labelSmall, letterSpacing: 1.4 },
  runTitle: { ...TextStyles.display, color: Colors.white, letterSpacing: 0.5 },
  factsRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  factItem: { flex: 1, minHeight: 102, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 8, paddingVertical: 12, gap: 4 },
  factBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.border },
  factLabel: { ...TextStyles.labelSmall, color: Colors.muted, letterSpacing: 0.8 },
  factValue: { ...TextStyles.caption, color: Colors.text, textAlign: "center" },
  rosterArea: { flexDirection: "row", flexWrap: "wrap" },
  teamHeader: { width: "100%", minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 3, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.surface },
  teamLabel: { fontFamily: Typography.heading, fontSize: 13, color: Colors.text, letterSpacing: 3 },
  goingCount: { ...TextStyles.label, color: Colors.accent, letterSpacing: 0.6 },
  playerSlot: { width: "50%", minHeight: 62, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderRightWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  slotName: { ...TextStyles.listName, color: Colors.text },
  slotElo: { ...TextStyles.caption, color: Colors.muted, marginTop: 1 },
  openSlot: { borderStyle: "dashed", opacity: 0.72 },
  openAvatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border, borderRadius: Radius.sm },
  openSlotName: { ...TextStyles.labelSmall, color: Colors.textSecondary },
  resultSection: { paddingHorizontal: 20, paddingTop: 14 },
  resultLabel: { fontFamily: Typography.heading, fontSize: 13, color: Colors.text, letterSpacing: 3, borderBottomWidth: 1, borderColor: Colors.border, paddingBottom: 10, marginBottom: 12, textTransform: "uppercase" as const },
  resultButtons: { flexDirection: "row", gap: 10 },
  resultBtn: { flex: 1 },
  awaitingResult: { flex: 1, padding: 16, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: "center" },
  awaitingResultTitle: { fontFamily: Typography.heading, fontSize: 15, color: Colors.text, letterSpacing: 1 },
  awaitingResultCopy: { marginTop: 4, fontFamily: Typography.body, fontSize: 12, lineHeight: 17, color: Colors.muted, textAlign: "center" },
  inviteSection: { paddingHorizontal: 20, paddingTop: 12 },
  inviteRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  inviteName: { flex: 1, fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.text, letterSpacing: 0.4 },
  inviteButton: { minWidth: 70, minHeight: 30, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: Radius.xs, borderWidth: 1, borderColor: Colors.accent },
  inviteButtonDone: { borderColor: Colors.border, backgroundColor: Colors.surfaceHigh },
  inviteButtonText: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.accent, letterSpacing: 0.8 },
  inviteButtonTextDone: { color: Colors.muted },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border },
  joinError: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.loss, letterSpacing: 1.5, textAlign: "center", marginBottom: 8 },

  editHelper: { fontFamily: Typography.body, fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  editLabel: {
    fontFamily: Typography.bodyBold, fontSize: 11, color: Colors.muted, letterSpacing: 2,
    textTransform: "uppercase" as const, marginTop: 20, marginBottom: 8,
  },
  editSizeRow: { flexDirection: "row", gap: 8 },
  editSizeCell: {
    flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: Radius.xs,
  },
  editSizeCellActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  editSizeText: { fontFamily: Typography.heading, fontSize: 13, color: Colors.muted, letterSpacing: 1 },
  editSizeTextActive: { color: Colors.accent },
  editError: {
    fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.loss, letterSpacing: 1.5,
    marginTop: 14, textAlign: "center",
  },
  editSaveBtn: {
    minHeight: 48, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", paddingVertical: 14,
    borderRadius: Radius.xs, marginTop: 20,
  },
  editSaveText: { fontFamily: Typography.heading, fontSize: 12, color: Colors.black, letterSpacing: 2 },
  resultHelp: { fontFamily: Typography.body, fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  teamCountRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  teamCount: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  teamCountLabel: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textSecondary, letterSpacing: 1 },
  teamCountValue: { fontFamily: Typography.heading, fontSize: 20, color: Colors.text },
  assignmentRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  assignmentIdentity: { flex: 1, minWidth: 0 },
  assignmentName: { fontFamily: Typography.bodySemiBold, fontSize: 14, lineHeight: 18, color: Colors.text },
  assignmentElo: { marginTop: 2, fontFamily: Typography.body, fontSize: 11, lineHeight: 14, color: Colors.muted },
  sideControl: { flexDirection: "row", borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, overflow: "hidden" },
  sideButton: { width: 40, minHeight: 36, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  sideButtonActive: { backgroundColor: Colors.accent },
  sideButtonText: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textSecondary },
  sideButtonTextActive: { color: Colors.black },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scoreField: { flex: 1, alignItems: "center", gap: 6 },
  scoreLabel: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 1 },
  scoreInput: { width: "100%", minHeight: 64, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, color: Colors.text, fontFamily: Typography.heading, fontSize: 30, textAlign: "center" },
  scoreDash: { fontFamily: Typography.heading, fontSize: 24, color: Colors.muted },
  resultValidation: { marginTop: 12, fontFamily: Typography.body, fontSize: 12, lineHeight: 17, color: Colors.textSecondary, textAlign: "center" },
  submitDisabled: { opacity: 0.45 },
  reviewFootnote: { marginTop: 12, fontFamily: Typography.body, fontSize: 11, lineHeight: 16, color: Colors.muted, textAlign: "center" },
});
