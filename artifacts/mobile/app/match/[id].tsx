import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { DetailHeader } from "@/components/DetailHeader";
import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { confirmMatch, fetchMatchReview, MatchReview, rejectMatch } from "@/services/gameService";

export default function MatchReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { refreshMatches, refreshFeed } = useApp();
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

  const resolve = async (action: "confirm" | "reject") => {
    if (!match || working) return;
    setWorking(true);
    const ok = action === "confirm" ? await confirmMatch(match.id) : await rejectMatch(match.id);
    setWorking(false);
    if (!ok) {
      Alert.alert("Could not update score", "The score may have already changed. Refresh and try again.");
      await load();
      return;
    }
    await Promise.all([load(), refreshProfile(), refreshMatches(), refreshFeed()]);
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <DetailHeader title="FINAL SCORE" onBack={() => router.back()} />
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      </View>
    );
  }
  if (!match) {
    return (
      <View style={styles.screen}>
        <DetailHeader title="FINAL SCORE" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>SCORE NOT FOUND</Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryText}>GO BACK</Text></Pressable>
        </View>
      </View>
    );
  }

  const canConfirm = match.status === "pending" && match.opponentId === user?.id;
  const canObject = match.status === "pending" && (match.opponentId === user?.id || match.createdBy === user?.id);
  const mineIsA = match.createdBy === user?.id;
  const myName = mineIsA ? match.creatorName : match.opponentName;
  const otherName = mineIsA ? match.opponentName : match.creatorName;
  const myScore = mineIsA ? match.scoreA : match.scoreB;
  const otherScore = mineIsA ? match.scoreB : match.scoreA;

  return (
    <View style={styles.screen}>
      <DetailHeader title="FINAL SCORE" onBack={() => router.back()} />

      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={styles.sport}>{match.sport}</Text>
          <Text style={styles.status}>{match.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.court}>{match.courtName.toUpperCase()}</Text>
        <Text style={styles.date}>{new Date(match.playedAt).toLocaleDateString()}</Text>

        <View style={styles.scoreCard}>
          <View style={styles.scoreSide}>
            <Text style={styles.playerLabel}>YOU · {myName.toUpperCase()}</Text>
            <Text style={styles.score}>{myScore}</Text>
          </View>
          <Text style={styles.dash}>–</Text>
          <View style={styles.scoreSide}>
            <Text style={styles.playerLabel}>{otherName.toUpperCase()}</Text>
            <Text style={styles.score}>{otherScore}</Text>
          </View>
        </View>

        {match.status === "pending" ? (
          <Text style={styles.explanation}>
            {canConfirm
              ? "Confirm the final score, or object if it is wrong. Your rating changes only after confirmation."
              : "Waiting for your opponent. If they do not respond, this score confirms after seven days."}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, backgroundColor: Colors.background, padding: 24 },
  content: { padding: 20 },
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
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accent, borderRadius: Radius.sm, shadowColor: Colors.accent, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  primaryText: { fontFamily: Typography.bodyBold, fontSize: 10, color: "#090909", letterSpacing: 1.2 },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.surface },
  secondaryText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.1 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 19, color: Colors.text },
});
