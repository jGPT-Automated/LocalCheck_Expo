import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DetailHeader } from "@/components/ui/DetailHeader";
import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { confirmMatch, fetchMatchReview, MatchReview, rejectMatch, reviewScheduledMatch } from "@/services/gameService";

export default function MatchReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { refreshMatches, refreshFeed } = useApp();
  const realtimeHub = useRealtimeHub();
  const [match, setMatch] = useState<MatchReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setMatch(await fetchMatchReview(id));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    return realtimeHub.subscribe(`user:${user.id}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, ["matches", "match_participant_reviews"])) void load();
    });
  }, [id, user?.id, realtimeHub]);

  const resolve = async (action: "confirm" | "reject" | "approve" | "dispute" | "withdraw") => {
    if (!match || working) return;
    setWorking(true);
    const ok = action === "confirm"
      ? await confirmMatch(match.id)
      : action === "reject"
        ? await rejectMatch(match.id)
        : await reviewScheduledMatch(
            match.id,
            action === "approve" ? "approved" : action === "dispute" ? "disputed" : "pending",
          );
    setWorking(false);
    if (!ok) {
      Alert.alert("Could not update score", "The score may have already changed. Refresh and try again.");
      await load();
      return;
    }
    await Promise.all([load(), refreshProfile(), refreshMatches(), refreshFeed()]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }
  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>SCORE NOT FOUND</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryText}>GO BACK</Text></Pressable>
      </View>
    );
  }

  const isScheduled = !!match.runId;
  const viewerReview = match.participants.find((participant) => participant.id === user?.id);
  const canConfirm = !isScheduled && match.status === "pending" && match.opponentId === user?.id;
  const canObject = !isScheduled && match.status === "pending" && (match.opponentId === user?.id || match.createdBy === user?.id);
  const mineIsA = match.createdBy === user?.id;
  const myName = mineIsA ? match.creatorName : match.opponentName;
  const otherName = mineIsA ? match.opponentName : match.creatorName;
  const myScore = mineIsA ? match.scoreA : match.scoreB;
  const otherScore = mineIsA ? match.scoreB : match.scoreA;
  const teamA = match.participants.filter((participant) => participant.side === "a");
  const teamB = match.participants.filter((participant) => participant.side === "b");
  const teamLabel = (team: typeof teamA) => team.map((participant) => participant.id === user?.id ? "YOU" : participant.name.split(" ")[0].toUpperCase()).join(" · ");

  return (
    <View style={styles.screen}>
      <DetailHeader onBack={() => router.back()} title="FINAL SCORE" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <Text style={styles.sport}>{match.sport}</Text>
          <Text style={styles.status}>{match.status === "pending" ? "REVIEW OPEN" : match.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.court}>{match.courtName.toUpperCase()}</Text>
        <Text style={styles.date}>{new Date(match.playedAt).toLocaleDateString()}</Text>

        <View style={styles.scoreCard}>
          <View style={styles.scoreSide}>
            <Text style={styles.playerLabel}>{isScheduled ? `TEAM A · ${teamLabel(teamA)}` : `YOU · ${myName.toUpperCase()}`}</Text>
            <Text style={styles.score}>{isScheduled ? match.scoreA : myScore}</Text>
          </View>
          <Text style={styles.dash}>–</Text>
          <View style={styles.scoreSide}>
            <Text style={styles.playerLabel}>{isScheduled ? `TEAM B · ${teamLabel(teamB)}` : otherName.toUpperCase()}</Text>
            <Text style={styles.score}>{isScheduled ? match.scoreB : otherScore}</Text>
          </View>
        </View>

        {isScheduled ? (
          <View style={styles.reviewGrid}>
            {match.participants.map((participant) => (
              <View key={participant.id} style={styles.reviewRow}>
                <Text style={styles.reviewName}>{participant.id === user?.id ? "YOU" : participant.name.toUpperCase()}</Text>
                <Text style={[styles.reviewDecision, participant.decision === "disputed" && styles.reviewDisputed]}>{participant.decision.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {match.status === "pending" ? (
          <Text style={styles.explanation}>
            {isScheduled
              ? "If nobody disputes, this result confirms after three days. If everyone approves, it confirms earlier. An active dispute at the deadline drops the result."
              : canConfirm
              ? "Confirm the final score, or object if it is wrong. Your rating changes only after confirmation."
              : "Waiting for your opponent. If they do not respond, this score confirms after three days."}
          </Text>
        ) : (
          <Text style={styles.explanation}>
            {match.status === "confirmed"
              ? "This score is final and the sport rating is updated."
              : "This score is on hold. It did not change either rating."}
          </Text>
        )}

        {canConfirm ? (
          <Pressable style={styles.primaryButton} onPress={() => void resolve("confirm")} disabled={working}>
            <Text style={styles.primaryText}>{working ? "SAVING…" : "CONFIRM SCORE"}</Text>
          </Pressable>
        ) : null}
        {canObject ? (
          <Pressable style={styles.secondaryButton} onPress={() => void resolve("reject")} disabled={working}>
            <Text style={styles.secondaryText}>OBJECT TO SCORE</Text>
          </Pressable>
        ) : null}
        {isScheduled && match.status === "pending" && viewerReview?.decision === "pending" ? (
          <Pressable style={styles.primaryButton} onPress={() => void resolve("approve")} disabled={working}>
            <Text style={styles.primaryText}>{working ? "SAVING…" : "APPROVE SCORE"}</Text>
          </Pressable>
        ) : null}
        {isScheduled && match.status === "pending" && viewerReview?.decision !== "disputed" ? (
          <Pressable style={styles.secondaryButton} onPress={() => void resolve("dispute")} disabled={working}>
            <Text style={styles.secondaryText}>DISPUTE SCORE</Text>
          </Pressable>
        ) : null}
        {isScheduled && match.status === "pending" && viewerReview?.decision === "disputed" ? (
          <Pressable style={styles.primaryButton} onPress={() => void resolve("withdraw")} disabled={working}>
            <Text style={styles.primaryText}>{working ? "SAVING…" : "REMOVE DISPUTE"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, backgroundColor: Colors.background, padding: 24 },
  content: { padding: 20, paddingBottom: 44 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sport: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.accent, letterSpacing: 1.5 },
  status: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.textSecondary, letterSpacing: 1.3 },
  court: { fontFamily: Typography.heading, fontSize: 27, lineHeight: 31, color: Colors.text, marginTop: 12 },
  date: { fontFamily: Typography.body, fontSize: 10, color: Colors.muted, marginTop: 5 },
  scoreCard: { marginTop: 26, minHeight: 150, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg },
  scoreSide: { flex: 1, alignItems: "center" },
  playerLabel: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.textSecondary, letterSpacing: 0.8, textAlign: "center" },
  score: { fontFamily: Typography.heading, fontSize: 48, color: Colors.text, marginTop: 10 },
  dash: { fontFamily: Typography.heading, fontSize: 26, color: Colors.muted },
  explanation: { fontFamily: Typography.body, fontSize: 12, lineHeight: 18, color: Colors.textSecondary, marginVertical: 24 },
  reviewGrid: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  reviewRow: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  reviewName: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textSecondary },
  reviewDecision: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.6 },
  reviewDisputed: { color: Colors.loss },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accent, borderRadius: Radius.sm, shadowColor: Colors.accent, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  primaryText: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.black, letterSpacing: 1.2 },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.surface },
  secondaryText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.1 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 19, color: Colors.text },
});
