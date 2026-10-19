import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import {
  formatForMaxPlayers,
  generatedScheduledGameTitle,
  maxPlayersForFormat,
  scheduledFormatsForSport,
  scheduledResultAction,
  validateTeamAssignments,
  type ScheduledGameFormat,
  type TeamAssignment,
} from "@/components/schedule/scheduledGameModel";
import { Colors, Radius } from "@/constants/colors";
import { formatClockTime } from "@/components/home/homePresentation";
import type { CourtSport, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { inviteFriendToRun } from "@/services/notificationService";
import { logScheduledGameResult } from "@/services/gameService";
import { updateScheduledGame } from "@/services/scheduledGameService";

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { runs, joinRun, leaveRun, cancelRun, currentUser, refreshRuns, getFriendsList } =
    useApp();
  const realtimeHub = useRealtimeHub();
  const { top, bottom } = useSafeAreaInsets();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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

  const total = run.participants.length;
  const max = run.maxPlayers;
  const spotsLeft = Math.max(0, max - total);
  const isJoined = run.participants.some((p) => p.id === currentUser.id);
  const isFull = spotsLeft === 0;
  const isHost = run.hostId === currentUser.id;
  const format = formatForMaxPlayers(run.maxPlayers) ?? "5V5";
  // Before the start time the run can be edited; after it, it's a played game to log.
  const hasStarted = new Date(run.startTimeIso).getTime() <= Date.now();
  const resultAction = scheduledResultAction({
    hasStarted,
    isHost,
    status: run.status,
    resultMatchId: run.resultMatchId,
  });
  const participantIds = new Set(run.participants.map((player) => player.id));
  const inviteableFriends = getFriendsList()
    .filter((friend) => !participantIds.has(friend.id))
    .slice(0, 8);

  const mySide = run.participantSides[currentUser.id];

  const handleJoin = async (teamSide?: "a" | "b") => {
    if (isJoined || isFull || joining) return;
    setJoining(true);
    setJoinError(false);
    const ok = await joinRun(run.id, teamSide);
    setJoining(false);
    if (!ok) setJoinError(true);
  };

  // A joined player moving A -> B (or back). join_scheduled_game upserts the
  // team_side, so this is just another join call with the other side.
  const handleSwitchSide = async () => {
    if (!isJoined || joining || !mySide) return;
    setJoining(true);
    setJoinError(false);
    const ok = await joinRun(run.id, mySide === "a" ? "b" : "a");
    setJoining(false);
    if (!ok) setJoinError(true);
  };

  const handleLeave = async () => {
    if (!isJoined || isHost || leaving) return;
    setLeaving(true);
    setJoinError(false);
    const ok = await leaveRun(run.id);
    setLeaving(false);
    if (!ok) setJoinError(true);
  };

  const handleCancelGame = async () => {
    if (!isHost || cancelling) return;
    if (!cancelArmed) {
      setCancelArmed(true);
      return;
    }
    setCancelling(true);
    const ok = await cancelRun(run.id);
    setCancelling(false);
    if (ok) router.back();
    else {
      setJoinError(true);
      setCancelArmed(false);
    }
  };

  const teamSize = max / 2;
  const assignedCount = Object.keys(run.participantSides).length;
  const teamsAreAssigned = isFull && assignedCount === total;
  const showTeamColumns = run.teamAssignmentMode === "choose_teams" || teamsAreAssigned;
  const sidePlayers = (side: "a" | "b") =>
    run.participants.filter((player) => run.participantSides[player.id] === side);
  const initialAssignments: TeamAssignment[] = Object.entries(run.participantSides).map(
    ([playerId, side]) => ({ playerId, side }),
  );

  const handleInvite = async (friendId: string) => {
    if (invitingId || invitedIds.includes(friendId)) return;
    setInvitingId(friendId);
    const ok = await inviteFriendToRun(run.id, friendId);
    setInvitingId(null);
    if (ok) setInvitedIds((ids) => [...ids, friendId]);
  };

  const avgElo = total > 0
    ? Math.round(run.participants.reduce((sum, player) => sum + player.elo, 0) / total)
    : null;
  const segments = Math.min(max, 12);
  const filledSegments = Math.round((total / Math.max(max, 1)) * segments);
  const whenLabel = `${
    run.date === "TODAY"
      ? "Today"
      : run.date === "TOMORROW"
        ? "Tomorrow"
        : new Date(run.startTimeIso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  } · ${formatClockTime(run.time)}`;
  const details: Array<[string, string]> = [
    ["Teams", run.teamAssignmentMode === "elo_balance"
      ? teamsAreAssigned ? "ELO balance · locked" : "ELO balance · set when full"
      : "Choose teams · pick a side"],
    ["Level", run.skillLevel.charAt(0) + run.skillLevel.slice(1).toLowerCase()],
  ];
  const renderPlayer = (player: Player, compact = false) => (
    <Pressable
      accessibilityRole="button"
      key={player.id}
      onPress={() => router.push(`/player/${player.id}`)}
      style={({ pressed }) => [styles.personRow, pressed && styles.rowPressed]}
    >
      <PlayerAvatar initials={player.avatar} name={player.name} playerId={player.id} size={34} />
      <View style={styles.personBody}>
        <View style={styles.personNameRow}>
          <Text numberOfLines={1} style={styles.personName}>
            {compact ? player.name.split(" ")[0] : player.name}
          </Text>
          {!compact && player.id === run.hostId ? (
            <View style={styles.hostTag}><Text style={styles.hostTagText}>Host</Text></View>
          ) : null}
        </View>
        {/* Half-width team columns have no room beside the name, so the
            Host tag takes the second line there. */}
        {compact ? (
          player.id === run.hostId ? (
            <View style={[styles.hostTag, styles.hostTagBelow]}><Text style={styles.hostTagText}>Host</Text></View>
          ) : null
        ) : <Text style={styles.personSub}>{player.wins}–{player.losses}</Text>}
      </View>
      <Text style={styles.personElo}>{player.elo}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.nav, { paddingTop: Platform.OS === "web" ? 44 : top }]}>
        <View style={styles.navRow}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={styles.back}
          >
            <Feather color={Colors.text} name="arrow-left" size={22} />
          </Pressable>
          <Text numberOfLines={1} style={styles.navTitle}>{run.courtShortName}</Text>
          <View style={styles.back} />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: (Platform.OS === "web" ? 110 : bottom + 100) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        <View style={styles.titleBlock}>
          <SportLabel sport={run.sport} />
          <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={2} style={styles.title}>
            {run.title}
          </Text>
          <Text style={styles.when}>{whenLabel}</Text>
        </View>

        <MetricStrip
          cells={[
            { label: "Going", value: `${total}/${max}` },
            { label: "Avg ELO", value: avgElo ?? "—" },
            { label: "Format", value: format.toLowerCase() },
          ]}
        />

        <View style={styles.spots}>
          <View style={styles.spotBar}>
            {Array.from({ length: segments }).map((_, index) => (
              <View key={index} style={[styles.spot, index < filledSegments && styles.spotFilled]} />
            ))}
          </View>
          <Text style={styles.spotLabel}>
            {isFull ? "Full" : `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>Who's going</Text>
          {showTeamColumns ? (
            <View style={styles.teamColumns}>
              {(["a", "b"] as const).map((side) => {
                const players = sidePlayers(side);
                const open = Math.max(0, teamSize - players.length);
                return (
                  <View key={side} style={styles.teamColumn}>
                    <View style={styles.sideHeading}>
                      <Text style={styles.sideHeadingText}>Side {side.toUpperCase()}</Text>
                      <Text style={styles.sideCount}>{players.length}/{teamSize}</Text>
                    </View>
                    {players.map((player) => renderPlayer(player, true))}
                    {Array.from({ length: open }).map((_, index) => (
                      <View key={`${side}-open-${index}`} style={styles.personRow}>
                        <View style={styles.openAvatar}><Feather color={Colors.mutedDark} name="plus" size={14} /></View>
                        <Text style={styles.openText}>Open spot</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ) : total > 0 ? (
            run.participants.map((player) => renderPlayer(player))
          ) : (
            <Text style={styles.emptyLine}>Nobody yet. Join and you're first.</Text>
          )}
        </View>

        <View style={styles.detailsCard}>
          {details.map(([key, value], index) => (
            <View key={key} style={[styles.detailRow, index > 0 && styles.detailDivider]}>
              <Text style={styles.detailKey}>{key}</Text>
              <Text numberOfLines={2} style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {isHost && !hasStarted && inviteableFriends.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>Invite friends</Text>
            {inviteableFriends.slice(0, 2).map((friend) => {
              const invited = invitedIds.includes(friend.id);
              return (
                <View key={friend.id} style={styles.personRow}>
                  <PlayerAvatar initials={friend.avatar} name={friend.name} playerId={friend.id} size={34} />
                  <Text style={[styles.personName, styles.personBody]} numberOfLines={1}>{friend.name}</Text>
                  <BrutalistButton
                    disabled={invited || invitingId === friend.id}
                    label={invited ? "Invited" : invitingId === friend.id ? "Sending…" : "Invite"}
                    onPress={() => void handleInvite(friend.id)}
                    size="xs"
                    variant={invited ? "dark" : "outline"}
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        {/* The scheduled game owns its result; its action lives in the
            pinned footer so a long roster never hides it. */}
        {resultAction.kind === "none" && isHost ? (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>Manage this game</Text>
            <View style={styles.resultButtons}>
              <BrutalistButton
                label="Edit game"
                onPress={() => setShowEdit(true)}
                variant="dark"
                style={styles.resultBtn}
                testID="edit-run-btn"
              />
              <BrutalistButton
                label={cancelling ? "Cancelling…" : cancelArmed ? "Tap to confirm" : "Cancel game"}
                onPress={() => void handleCancelGame()}
                variant="outline"
                disabled={cancelling}
                style={styles.resultBtn}
                testID="cancel-run-btn"
              />
            </View>
            {cancelArmed && !cancelling ? (
              <Text style={styles.cancelHint}>
                This calls off the game for everyone who joined.
              </Text>
            ) : null}
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
        visible={showResult && resultAction.kind === "submit"}
        onClose={() => setShowResult(false)}
        runId={run.id}
        format={format}
        players={run.participants}
        initialAssignments={initialAssignments}
      />

      <View style={[styles.footer, { paddingBottom: (Platform.OS === "web" ? 34 : bottom) + 12 }]}>
        {joinError && <Text style={styles.joinError}>Something went wrong. Try again.</Text>}
        {resultAction.kind === "submit" ? (
          <BrutalistButton
            label="Submit result"
            onPress={() => setShowResult(true)}
            variant="accent"
            size="lg"
            style={{ flex: 1 }}
            testID="log-game-btn"
          />
        ) : resultAction.kind === "review" ? (
          <BrutalistButton
            label="View result"
            onPress={() => router.push(`/match/${resultAction.matchId}`)}
            variant="primary"
            size="lg"
            style={{ flex: 1 }}
            testID="view-result-btn"
          />
        ) : resultAction.kind !== "none" ? (
          <View style={styles.awaitingResult}>
            <Text style={styles.awaitingResultTitle}>
              {resultAction.kind === "submitted" ? "Result submitted" : "Waiting on the creator"}
            </Text>
            <Text style={styles.awaitingResultCopy}>
              {resultAction.kind === "submitted"
                ? "The score is ready for participant review."
                : "You’ll be notified when the score is ready to review."}
            </Text>
          </View>
        ) : run.teamAssignmentMode === "choose_teams" && !isJoined && !isFull ? (
          <View style={styles.joinSideRow}>
            {(["a", "b"] as const).map((side) => {
              const sideIsFull = sidePlayers(side).length >= teamSize;
              return (
                <BrutalistButton
                  key={side}
                  label={`Join side ${side.toUpperCase()}`}
                  onPress={() => void handleJoin(side)}
                  variant={side === "a" ? "primary" : "dark"}
                  disabled={sideIsFull || joining}
                  loading={joining}
                  size="lg"
                  style={styles.joinSideButton}
                  testID={`join-run-${side}`}
                />
              );
            })}
          </View>
        ) : isJoined && !isHost && !hasStarted ? (
          // Joined players can back out (or move teams) right up to start.
          <View style={styles.joinSideRow}>
            {run.teamAssignmentMode === "choose_teams" && mySide ? (
              <BrutalistButton
                label={`Move to side ${mySide === "a" ? "B" : "A"}`}
                onPress={() => void handleSwitchSide()}
                variant="dark"
                disabled={joining || leaving}
                loading={joining}
                size="lg"
                style={styles.joinSideButton}
                testID="switch-run-side"
              />
            ) : null}
            <BrutalistButton
              label={leaving ? "Leaving…" : "You're in · Leave"}
              onPress={() => void handleLeave()}
              variant="outline"
              disabled={joining || leaving}
              loading={leaving}
              size="lg"
              style={
                run.teamAssignmentMode === "choose_teams" && mySide
                  ? styles.joinSideButton
                  : { flex: 1 }
              }
              testID="leave-run-btn"
            />
          </View>
        ) : (
          <BrutalistButton
            label={isJoined ? "You're going" : isFull ? "Game full" : joining ? "Joining…" : "Join game"}
            onPress={() => void handleJoin()}
            variant={isJoined ? "outline" : "primary"}
            disabled={isFull && !isJoined}
            loading={joining}
            size="lg"
            style={{ flex: 1 }}
            testID="join-run-btn"
          />
        )}
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
  initialAssignments,
}: {
  visible: boolean;
  onClose: () => void;
  runId: string;
  format: ScheduledGameFormat;
  players: Player[];
  initialAssignments: TeamAssignment[];
}) {
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teamSize = Number(format[0]);

  useEffect(() => {
    if (!visible) return;
    setAssignments(initialAssignments);
    setScoreA("");
    setScoreB("");
    setError(null);
  }, [visible]);

  const teamA = assignments.filter((entry) => entry.side === "a");
  const teamB = assignments.filter((entry) => entry.side === "b");
  const teamsLocked =
    initialAssignments.length === players.length && players.length === teamSize * 2;

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
    <RunFlowSheet visible={visible} onClose={onClose} eyebrow={`${format} · OFFICIAL RESULT`} title={teamsLocked ? "Enter final score" : "Set teams & score"}>
      <Text style={styles.resultHelp}>
        {teamsLocked
          ? "The scheduled teams are locked. Enter the final score for participant review."
          : "Put every rostered player on one team. Everyone gets three days to dispute the submitted score."}
      </Text>
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
                <Pressable key={option} disabled={teamsLocked} onPress={() => assign(player.id, option)} style={[styles.sideButton, side === option && styles.sideButtonActive, teamsLocked && styles.sideButtonLocked]}>
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
  contentContainer: { paddingTop: 8, gap: 18 },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 40, backgroundColor: Colors.background },
  notFoundText: { fontFamily: Typography.heading, fontSize: 24, color: Colors.text, letterSpacing: 2 },
  nav: { backgroundColor: Colors.background },
  navRow: { height: 44, paddingLeft: 12, paddingRight: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, textAlign: "center", fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.muted },
  titleBlock: { paddingHorizontal: 20, gap: 8 },
  title: { fontFamily: Typography.headingBold, fontSize: 40, lineHeight: 40, letterSpacing: -1.4, textTransform: "uppercase", color: Colors.text },
  when: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.inkSoft },
  spots: { paddingHorizontal: 20, gap: 6 },
  spotBar: { flexDirection: "row", gap: 3 },
  spot: { flex: 1, height: 6, borderRadius: 2, backgroundColor: "rgba(242,242,246,0.1)" },
  spotFilled: { backgroundColor: Colors.inkSoft },
  spotLabel: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  section: { paddingHorizontal: 20 },
  eyebrow: { paddingBottom: 4, fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  personRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(242,242,246,0.06)" },
  rowPressed: { backgroundColor: Colors.surface },
  personBody: { flex: 1, minWidth: 0, gap: 2 },
  personNameRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  personName: { flexShrink: 1, fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.text },
  personSub: { fontFamily: Typography.bodyMedium, fontSize: 10, color: Colors.muted },
  personElo: { flexShrink: 0, fontFamily: Typography.headingSemiBold, fontSize: 17, letterSpacing: -0.5, color: Colors.text, fontVariant: ["tabular-nums"] },
  hostTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, borderWidth: 1, borderColor: Colors.hairlineChrome },
  hostTagBelow: { alignSelf: "flex-start", marginTop: 3 },
  hostTagText: { fontFamily: Typography.bodyBold, fontSize: 7, letterSpacing: 0.9, textTransform: "uppercase", color: Colors.inkSoft },
  teamColumns: { flexDirection: "row", gap: 14 },
  teamColumn: { flex: 1, flexBasis: 0, minWidth: 0 },
  sideHeading: { height: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: Colors.hairline },
  sideHeadingText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.text },
  sideCount: { fontFamily: Typography.bodySemiBold, fontSize: 10, color: Colors.muted },
  openAvatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed, borderRadius: 10 },
  openText: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.muted },
  emptyLine: { paddingVertical: 12, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  detailsCard: { marginHorizontal: 20, overflow: "hidden", borderRadius: Radius.panel, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel },
  detailRow: { minHeight: 50, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  detailDivider: { borderTopWidth: 1, borderTopColor: Colors.hairline },
  detailKey: { flexShrink: 0, fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.muted },
  detailValue: { flexShrink: 1, textAlign: "right", fontFamily: Typography.bodyMedium, fontSize: 12.5, color: Colors.text },
  cancelHint: { marginTop: 8, fontFamily: Typography.body, fontSize: 11, lineHeight: 15, color: Colors.muted },
  resultButtons: { flexDirection: "row", gap: 10, paddingTop: 8 },
  resultBtn: { flex: 1 },
  awaitingResult: { flex: 1, padding: 16, borderRadius: Radius.row, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel, alignItems: "center" },
  awaitingResultTitle: { fontFamily: Typography.headingSemiBold, fontSize: 15, color: Colors.text, letterSpacing: 0.5, textTransform: "uppercase" },
  awaitingResultCopy: { marginTop: 4, fontFamily: Typography.body, fontSize: 12, lineHeight: 17, color: Colors.muted, textAlign: "center" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.background, borderTopWidth: 1, borderColor: Colors.hairline },
  joinSideRow: { flexDirection: "row", gap: 10 },
  joinSideButton: { flex: 1 },
  joinError: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.loss, textAlign: "center", marginBottom: 8 },

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
  sideButtonLocked: { opacity: 0.72 },
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
