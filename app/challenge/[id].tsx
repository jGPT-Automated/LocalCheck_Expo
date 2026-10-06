import * as Crypto from "expo-crypto";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceChips } from "@/components/challenge/ChoiceChips";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import {
  type Challenge,
  challengeAction,
  challengePlaceLine,
  challengeStatusLine,
  firstName,
  localDateValue,
  otherPlayer,
  scoreError,
} from "@/lib/challengeModel";
import {
  cancelChallenge,
  fetchChallenge,
  logChallengeResult,
  respondToChallenge,
} from "@/services/challengeService";

const STATUS_LABEL: Record<Challenge["status"], string> = {
  pending: "PENDING",
  accepted: "ON",
  completed: "SCORE LOGGED",
  declined: "DECLINED",
  cancelled: "CALLED OFF",
};

/**
 * One challenge, from either player's side. Pending: the opponent accepts or
 * declines. Accepted: either player enters the score, which logs a normal 1v1
 * that the other confirms. Completed: links to the game.
 */
export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { currentUser, localCourt } = useApp();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [myScore, setMyScore] = useState("");
  const [theirScore, setTheirScore] = useState("");
  const [courtChoice, setCourtChoice] = useState<string | null>(null);
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const [requestId] = useState(() => Crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let mounted = true;
    void fetchChallenge(id).then((row) => {
      if (!mounted) return;
      setChallenge(row);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [id]);
  useFocusEffect(load);

  const courtChoices = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    if (challenge?.courtId) list.push({ value: challenge.courtId, label: challenge.courtName ?? "Court" });
    if (localCourt && localCourt.id !== challenge?.courtId) {
      list.push({ value: localCourt.id, label: localCourt.shortName || localCourt.name });
    }
    return list;
  }, [challenge, localCourt]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <DetailHeader onBack={() => router.back()} title="CHALLENGE" />
        <ActivityIndicator color={Colors.accent} style={styles.loading} />
      </View>
    );
  }
  if (!challenge) {
    return (
      <View style={styles.screen}>
        <DetailHeader onBack={() => router.back()} title="CHALLENGE" />
        <Text style={styles.missing}>This challenge isn't available.</Text>
      </View>
    );
  }

  const viewerId = currentUser.id;
  const other = otherPlayer(challenge, viewerId);
  const action = challengeAction(challenge, viewerId);
  const courtId = courtChoice ?? courtChoices[0]?.value ?? null;

  const run = async (task: () => Promise<{ ok: boolean; message?: string }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await task();
    setBusy(false);
    if (!result.ok) setError(result.message ?? "Something went wrong. Try again.");
    else load();
  };

  const callOff = () =>
    Alert.alert("Call off this challenge?", `${firstName(other.name)} will be told.`, [
      { text: "Keep it", style: "cancel" },
      { text: "Call it off", style: "destructive", onPress: () => void run(() => cancelChallenge(challenge.id)) },
    ]);

  const submitScore = async () => {
    const problem = scoreError(myScore, theirScore);
    if (problem) {
      setError(problem);
      return;
    }
    if (!courtId) {
      setError("Set a local court first, or pick where you played.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    const played = new Date();
    if (day === "yesterday") played.setDate(played.getDate() - 1);
    const result = await logChallengeResult({
      challengeId: challenge.id,
      myScore: Number(myScore),
      theirScore: Number(theirScore),
      courtId,
      playedOn: localDateValue(played),
      clientRequestId: requestId,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(`/match/${result.value}`);
  };

  const footer = (() => {
    switch (action) {
      case "accept_decline":
        return (
          <StickyActionBar
            bottomInset={bottom}
            primary={{
              label: "ACCEPT",
              disabled: busy,
              onPress: () => void run(() => respondToChallenge(challenge.id, true)),
            }}
            secondary={{
              label: "DECLINE",
              disabled: busy,
              onPress: () => void run(() => respondToChallenge(challenge.id, false)),
            }}
          />
        );
      case "waiting":
        return (
          <StickyActionBar
            bottomInset={bottom}
            primary={{ label: "CALL IT OFF", tone: "light", disabled: busy, onPress: callOff }}
          />
        );
      case "log_score":
        return (
          <StickyActionBar
            bottomInset={bottom}
            primary={{
              label: busy ? "SUBMITTING…" : "SUBMIT SCORE",
              disabled: busy,
              onPress: () => void submitScore(),
            }}
            secondary={{ label: "CALL IT OFF", disabled: busy, onPress: callOff }}
          />
        );
      case "view_game":
        return (
          <StickyActionBar
            bottomInset={bottom}
            primary={{ label: "VIEW GAME", onPress: () => router.push(`/match/${challenge.matchId}`) }}
          />
        );
      default:
        return (
          <StickyActionBar
            bottomInset={bottom}
            primary={{ label: `CHALLENGE ${firstName(other.name).toUpperCase()} AGAIN`, tone: "light", onPress: () => router.replace(`/player/${other.id}`) }}
          />
        );
    }
  })();

  return (
    <View style={styles.screen}>
      <DetailHeader
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        title="CHALLENGE"
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.format}>1V1 · {challenge.ranked ? "RANKED" : "CASUAL"}</Text>
            <View style={[styles.status, challenge.status === "accepted" && styles.statusLive]}>
              <Text style={[styles.statusText, challenge.status === "accepted" && styles.statusTextLive]}>
                {STATUS_LABEL[challenge.status]}
              </Text>
            </View>
          </View>
          <View style={styles.faceoff}>
            <Side id={viewerId} initials={currentUser.avatar} label="YOU" name={currentUser.name} />
            <Text style={styles.vs}>VS</Text>
            <Side
              id={other.id}
              initials={other.initials}
              label={firstName(other.name).toUpperCase()}
              name={other.name}
              onPress={() => router.push(`/player/${other.id}`)}
            />
          </View>
          <Text style={styles.place}>{challengePlaceLine(challenge)}</Text>
          <Text style={styles.statusLine}>{challengeStatusLine(challenge, viewerId)}</Text>
        </View>

        {action === "log_score" ? (
          <View style={styles.scoreBlock}>
            <Text style={styles.label}>FINAL SCORE</Text>
            <View style={styles.scoreRow}>
              <ScoreField label="YOU" onChange={setMyScore} value={myScore} />
              <Text style={styles.dash}>–</Text>
              <ScoreField label={firstName(other.name).toUpperCase()} onChange={setTheirScore} value={theirScore} />
            </View>
            {courtChoices.length > 1 || (!challenge.courtId && courtChoices.length > 0) ? (
              <>
                <Text style={styles.label}>PLAYED AT</Text>
                <ChoiceChips choices={courtChoices} onChange={setCourtChoice} scroll value={courtId ?? ""} />
              </>
            ) : null}
            <Text style={styles.label}>PLAYED</Text>
            <ChoiceChips
              choices={[
                { value: "today", label: "Today" },
                { value: "yesterday", label: "Yesterday" },
              ]}
              onChange={setDay}
              value={day}
            />
            <Text style={styles.hint}>
              {firstName(other.name)} confirms or disputes it within 3 days.
              {challenge.ranked ? " ELO moves once it's confirmed." : " Casual: no ELO change."}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      {footer}
    </View>
  );
}

function Side({
  id,
  name,
  initials,
  label,
  onPress,
}: {
  id: string;
  name: string;
  initials?: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.side}>
      <Pressable accessibilityLabel={`Open ${name}'s profile`} disabled={!onPress} onPress={onPress}>
        <PlayerAvatar initials={initials} name={name} playerId={id} size={64} />
      </Pressable>
      <Text numberOfLines={1} style={styles.sideLabel}>{label}</Text>
    </View>
  );
}

function ScoreField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.scoreField}>
      <TextInput
        accessibilityLabel={`${label} score`}
        keyboardType="number-pad"
        maxLength={3}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
        placeholder="0"
        placeholderTextColor={Colors.mutedDark}
        style={styles.scoreInput}
        value={value}
      />
      <Text numberOfLines={1} style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  loading: { marginTop: Space.xxxl },
  missing: { ...TextStyles.bodySmall, padding: Layout.screenGutter, color: Colors.textSecondary },
  content: { padding: Layout.screenGutter, paddingBottom: Space.xxxl },
  card: {
    padding: Space.xl,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  format: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.8, color: Colors.textSecondary },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statusLive: { borderColor: Colors.accentBorderStrong, backgroundColor: Colors.accentDim },
  statusText: { fontFamily: Typography.bodyBold, fontSize: 10, letterSpacing: 1.4, color: Colors.textSecondary },
  statusTextLive: { color: Colors.accent },
  faceoff: {
    marginTop: Space.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  side: { alignItems: "center", gap: Space.sm, maxWidth: 120 },
  sideLabel: { fontFamily: Typography.heading, fontSize: 16, letterSpacing: 0.6, color: Colors.text },
  vs: { fontFamily: Typography.heading, fontSize: 16, color: Colors.muted },
  place: { ...TextStyles.label, marginTop: Space.xl, textAlign: "center", color: Colors.text },
  statusLine: { ...TextStyles.metadata, marginTop: 4, textAlign: "center", color: Colors.textSecondary },
  scoreBlock: { marginTop: Space.lg },
  label: {
    marginTop: Space.xl,
    marginBottom: Space.sm,
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  scoreField: { flex: 1, alignItems: "center", gap: 6 },
  scoreInput: {
    alignSelf: "stretch",
    minHeight: 76,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontFamily: Typography.headingBold,
    fontSize: 44,
    color: Colors.text,
    textAlign: "center",
  },
  scoreLabel: { fontFamily: Typography.bodyBold, fontSize: 10, letterSpacing: 1.4, color: Colors.textSecondary },
  dash: { fontFamily: Typography.heading, fontSize: 28, color: Colors.muted, marginBottom: 20 },
  hint: { ...TextStyles.metadata, marginTop: Space.md, color: Colors.textSecondary },
  error: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.loss },
});
