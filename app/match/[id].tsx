import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchReviewCard } from "@/components/match/MatchReviewCard";
import { MatchRevisionSheet } from "@/components/match/MatchRevisionSheet";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { fetchMatchReview, type MatchReview, respondToMatch, updateHeldMatch } from "@/services/gameService";

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

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setMatch(await fetchMatchReview(id));
    setLoading(false);
  }, [id]);

  React.useEffect(() => void load(), [load]);

  React.useEffect(() => {
    if (!user?.id) return;
    return realtimeHub.subscribe(`user:${user.id}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, ["matches", "match_participant_reviews"])) void load();
    });
  }, [load, realtimeHub, user?.id]);

  const refreshAll = async () => {
    await Promise.all([load(), refreshProfile(), refreshMatches(), refreshFeed()]);
  };

  const respond = async (decision: "approve" | "dispute") => {
    if (!match || working) return;
    setWorking(true);
    const ok = await respondToMatch(match.id, decision);
    setWorking(false);
    if (!ok) {
      Alert.alert("Score changed", "Refresh the result and try again.");
      await load();
      return;
    }
    await refreshAll();
  };

  const submitRevision = async (change: { courtId: string; scoreA: number; scoreB: number; playedOn: string }) => {
    if (!match || working) return;
    setWorking(true);
    const ok = await updateHeldMatch({ matchId: match.id, ...change });
    setWorking(false);
    if (!ok) {
      Alert.alert("Could not update game", "Nothing was changed. Refresh and try again.");
      await load();
      return;
    }
    setEditing(false);
    await refreshAll();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
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

  const viewer = match.participants.find((participant) => participant.id === user?.id);
  const submitter = match.participants.find((participant) => participant.id === match.lastSubmittedBy);
  const canReview = match.status === "pending" && Boolean(viewer) && user?.id !== match.lastSubmittedBy;
  const canApprove = canReview && viewer?.side !== submitter?.side;
  const canDispute = canReview;
  const canUpdate = match.status === "held" && Boolean(viewer);
  const showActions = canApprove || canDispute || canUpdate;

  return (
    <View style={styles.screen}>
      <DetailHeader onBack={() => router.back()} title="FINAL SCORE" />
      <ScrollView
        contentContainerStyle={[styles.content, showActions && { paddingBottom: 120 + bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <MatchReviewCard match={match} viewerId={user?.id} />

        <View style={styles.policy}>
          <View style={styles.policyHeader}>
            <Feather color={Colors.accent} name="info" size={17} />
            <Text style={styles.policyTitle}>HOW SCORE REVIEW WORKS</Text>
          </View>
          <PolicyRow index="1" text="Every submitted score has a 3-day review. Approve it sooner to update ELO immediately; otherwise it auto-approves." />
          <PolicyRow index="2" text="A dispute puts the game on hold for 7 days. During the hold, any player—or any player from either team—can correct the score, court, or date." />
          <PolicyRow index="3" text="A corrected game notifies every player and starts a new 3-day review. Players can approve it or dispute it again." />
          <PolicyRow index="4" text="A game can be disputed twice. A third dispute, or an unresolved 7-day hold, voids the game with no profile or ELO change." />
        </View>
      </ScrollView>

      {canUpdate ? (
        <StickyActionBar bottomInset={bottom} primary={{ icon: "edit-3", label: "UPDATE GAME", onPress: () => setEditing(true), disabled: working }} />
      ) : canApprove ? (
        <StickyActionBar
          bottomInset={bottom}
          primary={{ icon: "check", label: working ? "SAVING…" : "APPROVE SCORE", onPress: () => void respond("approve"), disabled: working }}
          secondary={canDispute ? { icon: "flag", label: "DISPUTE", onPress: () => void respond("dispute"), disabled: working } : undefined}
        />
      ) : canDispute ? (
        <View style={[styles.singleAction, { paddingBottom: Math.max(bottom, Space.md) }]}>
          <Pressable disabled={working} onPress={() => void respond("dispute")} style={styles.disputeButton}>
            <Feather color={Colors.loss} name="flag" size={16} />
            <Text style={styles.disputeText}>DISPUTE SCORE</Text>
          </Pressable>
        </View>
      ) : null}

      <MatchRevisionSheet
        courts={courts}
        match={match}
        onClose={() => setEditing(false)}
        onSubmit={(change) => void submitRevision(change)}
        visible={editing}
        working={working}
      />
    </View>
  );
}

function PolicyRow({ index, text }: { index: string; text: string }) {
  return (
    <View style={styles.policyRow}>
      <View style={styles.policyIndex}><Text style={styles.policyIndexText}>{index}</Text></View>
      <Text style={styles.policyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Space.lg, padding: Space.xl, backgroundColor: Colors.background },
  content: { width: "100%", maxWidth: Layout.maxContentWidth + Layout.screenGutter * 2, alignSelf: "center", padding: Layout.screenGutter, paddingBottom: Space.xxxl, gap: Space.xxl },
  emptyTitle: { ...TextStyles.title, color: Colors.text },
  emptyButton: { minWidth: 132, minHeight: Layout.minTouchTarget, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.surface },
  emptyButtonText: { ...TextStyles.label, color: Colors.textSecondary, letterSpacing: 1.2 },
  policy: { gap: Space.lg, padding: Space.xl, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.card, backgroundColor: Colors.surface },
  policyHeader: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  policyTitle: { ...TextStyles.label, color: Colors.text, letterSpacing: 1.2 },
  policyRow: { flexDirection: "row", alignItems: "flex-start", gap: Space.md },
  policyIndex: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: Colors.surfaceHigh },
  policyIndexText: { ...TextStyles.labelSmall, color: Colors.accent },
  policyText: { ...TextStyles.bodySmall, flex: 1, color: Colors.textSecondary },
  singleAction: { paddingTop: Space.md, paddingHorizontal: Layout.screenGutter, backgroundColor: Colors.surfaceDark, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  disputeButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Space.sm, borderWidth: 1, borderColor: Colors.loss, borderRadius: Radius.md, backgroundColor: Colors.lossDim },
  disputeText: { ...TextStyles.label, color: Colors.loss, letterSpacing: 1.2 },
});
