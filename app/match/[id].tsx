import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchReviewCard } from "@/components/match/MatchReviewCard";
import { HideScoreToggle } from "@/components/match/HideScoreToggle";
import { MatchRevisionForm } from "@/components/match/MatchRevisionForm";
import { GameActivityList } from "@/components/match/GameActivityList";
import { shortFirstName } from "@/components/match/gameCardModel";
import { ReviewCountdown } from "@/components/match/ReviewCountdown";
import { ReviewRulesModal } from "@/components/match/ReviewRulesModal";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { buildGameActivity } from "@/lib/gameActivity";
import { hidersNeeded } from "@/lib/scoreVisibility";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import {
  fetchMatchReview,
  type MatchReview,
  respondToMatch,
  setScoreHidden,
  updateHeldMatch,
} from "@/services/gameService";

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/** The auto "score changed from X to Y" line plus any note the player typed,
 *  kept under the RPC's 280-char cap (the canned line always survives). */
const DISPUTE_NOTE_MAX = 280;
function buildDisputeExplanation(
  autoLine: string | null,
  typed: string,
): string | undefined {
  const note = typed.trim();
  if (!autoLine) return note || undefined;
  if (!note) return autoLine;
  const room = DISPUTE_NOTE_MAX - autoLine.length - 1;
  return room > 0 ? `${autoLine} ${note.slice(0, room)}` : autoLine;
}

export default function MatchReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const { courts, refreshMatches, refreshFeed } = useApp();
  const realtimeHub = useRealtimeHub();
  const [match, setMatch] = React.useState<MatchReview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [revisionMode, setRevisionMode] = React.useState<"update" | "dispute">(
    "update",
  );
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [hiddenOverride, setHiddenOverride] = React.useState<boolean | null>(null);

  // Only the first fetch shows the spinner: a realtime refresh must not
  // unmount an open dispute or update form.
  const load = React.useCallback(async () => {
    if (!id) return;
    const next = await fetchMatchReview(id);
    setMatch(next);
    setLoading(false);
  }, [id]);

  React.useEffect(() => void load(), [load]);

  React.useEffect(() => {
    if (!user?.id) return;
    return realtimeHub.subscribe(
      `user:${user.id}` as RealtimeTopic,
      (batch) => {
        if (batchHasResource(batch, ["matches", "match_participant_reviews"]))
          void load();
      },
    );
  }, [load, realtimeHub, user?.id]);

  const refreshAll = async () => {
    await Promise.all([
      load(),
      refreshProfile(),
      refreshMatches(),
      refreshFeed(),
    ]);
  };

  const respond = async (decision: "approve" | "dispute") => {
    if (!match || working) return;
    setWorking(true);
    const result = await respondToMatch(match.id, decision);
    const ok = Boolean(result);
    setWorking(false);
    if (!ok) {
      Alert.alert("Score changed", "Refresh the result and try again.");
      await load();
      return;
    }
    await refreshAll();
    // Approving a 1v1 confirms it and moves ELO. The card's rating tiles count
    // in place (status flips to "confirmed" on the refresh above); hold a beat
    // so that count is seen, then hand off to the profile, where the same delta
    // shows on the big number for the next few hours.
    if (decision === "approve") {
      const fresh = await fetchMatchReview(match.id);
      if (fresh?.status === "confirmed") {
        setTimeout(() => router.replace("/(tabs)/elo"), 1900);
      }
    }
  };

  const submitRevision = async (change: {
    courtId: string;
    scoreA: number;
    scoreB: number;
    playedOn: string;
    note: string;
  }) => {
    if (!match || working) return;
    setWorking(true);
    const scoreChanged =
      change.scoreA !== match.scoreA || change.scoreB !== match.scoreB;
    const changed =
      scoreChanged ||
      change.courtId !== match.courtId ||
      change.playedOn !== localDateValue(new Date(match.playedAt));
    // Auto-prepend a plain-language record of the score edit to the dispute
    // note, so the other player sees exactly what changed and doesn't have to
    // remember what they submitted. The DB overwrites the score in place and
    // keeps no history — this note is the history.
    const explanation =
      revisionMode === "dispute"
        ? buildDisputeExplanation(
            scoreChanged
              ? `Score changed from ${match.scoreA}–${match.scoreB} to ${change.scoreA}–${change.scoreB}.`
              : null,
            change.note,
          )
        : undefined;
    const result =
      revisionMode === "dispute"
        ? await respondToMatch(match.id, "dispute", {
            explanation,
            ...(changed
              ? {
                  courtId: change.courtId,
                  scoreA: change.scoreA,
                  scoreB: change.scoreB,
                  playedOn: change.playedOn,
                }
              : {}),
          })
        : changed
          ? await updateHeldMatch({ matchId: match.id, ...change })
          : false;
    const ok = Boolean(result);
    setWorking(false);
    if (!ok) {
      Alert.alert(
        "Could not update game",
        "Nothing was changed. Refresh and try again.",
      );
      await load();
      return;
    }
    setEditing(false);
    await refreshAll();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }
  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>SCORE NOT FOUND</Text>
        <Pressable onPress={() => router.back()} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  if (editing) {
    return (
      <View style={styles.screen}>
        <DetailHeader
          onBack={() => setEditing(false)}
          title={revisionMode === "dispute" ? "DISPUTE SCORE" : "UPDATE GAME"}
        />
        <MatchRevisionForm
          courts={courts}
          match={match}
          mode={revisionMode}
          onCancel={() => setEditing(false)}
          onSubmit={(change) => void submitRevision(change)}
          viewerId={user?.id}
          working={working}
        />
      </View>
    );
  }

  const viewer = match.participants.find(
    (participant) => participant.id === user?.id,
  );
  const submitter = match.participants.find(
    (participant) => participant.id === match.lastSubmittedBy,
  );
  const canReview =
    match.status === "pending" &&
    Boolean(viewer) &&
    user?.id !== match.lastSubmittedBy;
  const canApprove = canReview && viewer?.side !== submitter?.side;
  const canDispute = canReview;
  const canUpdate = match.status === "held" && Boolean(viewer);
  const showActions = canApprove || canDispute || canUpdate;

  // Only the players in the game can hide its score (D47).
  const hideToggle =
    viewer && match.status !== "voided" ? (
      <HideScoreToggle
        onChange={(next) => {
          setHiddenOverride(next);
          void setScoreHidden(match.id, next).then((ok) => {
            if (!ok) setHiddenOverride(!next);
          });
        }}
        detail={
          match.participants.length > 2
            ? `Hidden once ${hidersNeeded(match.participants.length)} of ${match.participants.length} players turn it on`
            : undefined
        }
        value={hiddenOverride ?? Boolean(viewer.hideScore)}
      />
    ) : null;

  const deadline =
    match.status === "pending"
      ? match.reviewDueAt
      : match.status === "held"
        ? match.resolutionDueAt
        : undefined;
  const activity = buildGameActivity(match, user?.id, shortFirstName);

  const openDispute = () => {
    setRevisionMode("dispute");
    setEditing(true);
  };

  return (
    <View style={styles.screen}>
      <DetailHeader
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityLabel="How score review works"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setRulesOpen(true)}
            style={styles.infoButton}
          >
            <Feather color={Colors.textSecondary} name="info" size={18} />
          </Pressable>
        }
        title="GAME SCORE"
      />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.content,
          showActions && { paddingBottom: 180 + bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {deadline ? (
          <ReviewCountdown
            deadline={deadline}
            label={match.status === "pending" ? "Auto-approves in" : "Resolve within"}
            windowMs={(match.status === "pending" ? 3 : 7) * 86_400_000}
          />
        ) : null}
        <MatchReviewCard match={match} viewerHideScore={hiddenOverride ?? undefined} viewerId={user?.id} />
        <GameActivityList events={activity} />
      </ScrollView>

      {/* With nothing to approve, Hide score sits at the bottom like the
          other screens' actions, not in the middle of the page. */}
      {!showActions && hideToggle ? (
        <View style={[styles.footer, { paddingBottom: Math.max(bottom, Space.sm) }]}>{hideToggle}</View>
      ) : null}

      {canUpdate ? (
        <StickyActionBar
          bottomInset={bottom}
          primary={{
            icon: "edit-3",
            label: "UPDATE GAME",
            onPress: () => {
              setRevisionMode("update");
              setEditing(true);
            },
            disabled: working,
          }}
          top={hideToggle}
        />
      ) : canApprove ? (
        <StickyActionBar
          bottomInset={bottom}
          primary={{
            icon: "check",
            label: working ? "SAVING…" : "APPROVE SCORE",
            onPress: () => void respond("approve"),
            disabled: working,
          }}
          secondary={
            canDispute
              ? { icon: "flag", label: "DISPUTE", onPress: openDispute, disabled: working }
              : undefined
          }
          top={hideToggle}
        />
      ) : canDispute ? (
        <StickyActionBar
          bottomInset={bottom}
          primary={{ icon: "flag", label: "DISPUTE SCORE", onPress: openDispute, disabled: working }}
          top={hideToggle}
        />
      ) : null}

      <ReviewRulesModal onClose={() => setRulesOpen(false)} visible={rulesOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  footer: {
    paddingTop: Space.sm,
    paddingHorizontal: Layout.screenGutter,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.lg,
    padding: Space.xl,
    backgroundColor: Colors.background,
  },
  content: {
    width: "100%",
    maxWidth: Layout.maxContentWidth + Layout.screenGutter * 2,
    alignSelf: "center",
    padding: Layout.screenGutter,
    paddingBottom: Space.xl,
    gap: Space.lg,
  },
  emptyTitle: { ...TextStyles.title, color: Colors.text },
  emptyButton: {
    minWidth: 132,
    minHeight: Layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  infoButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  emptyButtonText: {
    ...TextStyles.label,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
});
