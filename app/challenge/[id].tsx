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
import { GameStateBanner } from "@/components/match/GameStateBanner";
import { HideScoreToggle } from "@/components/match/HideScoreToggle";
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
  challengeBanner,
  challengeTitle,
  dayLabel,
  firstName,
  localDateValue,
  otherPlayer,
  scoreError,
} from "@/lib/challengeModel";
import {
  cancelChallenge,
  finishCasualChallenge,
  fetchChallenge,
  logChallengeResult,
  respondToChallenge,
} from "@/services/challengeService";
import { setScoreHidden } from "@/services/gameService";

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
  const [hideScore, setHideScore] = useState(false);
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
  const banner = challengeBanner(challenge, viewerId);
  const caption = [dayLabel(challenge.playOn).toUpperCase(), challenge.ranked ? null : "CASUAL"]
    .filter(Boolean)
    .join(" · ");

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
    Alert.alert("Call off this challenge?", "They'll be told.", [
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
    if (hideScore) await setScoreHidden(result.value, true);
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
      case "casual_on":
        return (
          <StickyActionBar
            bottomInset={bottom}
            primary={{
              label: "WE PLAYED",
              disabled: busy,
              onPress: () => void run(() => finishCasualChallenge(challenge.id)),
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
            primary={{ label: "CHALLENGE AGAIN", tone: "light", onPress: () => router.replace(`/player/${other.id}`) }}
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
          <GameStateBanner kind={banner.kind} label={banner.label} />
          <View style={styles.cardBody}>
            <View style={styles.titleBlock}>
              <Text numberOfLines={1} style={styles.caption}>
                {caption}
              </Text>
              <Text numberOfLines={1} style={styles.title}>
                {challengeTitle(challenge).toUpperCase()}
              </Text>
            </View>
            <View style={styles.faceoff}>
              <Side id={viewerId} initials={currentUser.avatar} label="You" name={currentUser.name} />
              <Text style={styles.vs}>VS</Text>
              <Side
                id={other.id}
                initials={other.initials}
                label={other.name}
                name={other.name}
                onPress={() => router.push(`/player/${other.id}`)}
              />
            </View>
          </View>
        </View>

        {action === "log_score" ? (
          <View style={styles.scoreBlock}>
            <Text style={styles.label}>FINAL SCORE</Text>
            <View style={styles.scoreRow}>
              <ScoreField label="YOU" onChange={setMyScore} value={myScore} />
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
            <View style={styles.hideRow}>
              <HideScoreToggle disabled={busy} onChange={setHideScore} value={hideScore} />
            </View>
            <Text style={styles.hint}>
              They confirm or dispute it within 3 days. ELO moves once it's confirmed.
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
      <Text numberOfLines={1} style={styles.sideLabel}>
        {label}
      </Text>
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
  // Same family as the game card: banner on top, caption + title, then the two sides.
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  cardBody: { padding: Space.lg, gap: Space.lg },
  titleBlock: { alignItems: "center", gap: Space.xs },
  caption: { ...TextStyles.labelSmall, color: Colors.muted, letterSpacing: 1.2, textAlign: "center" },
  title: {
    ...TextStyles.title,
    alignSelf: "stretch",
    color: Colors.text,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  // Two equal columns around a fixed "VS", so a 24-character name on either
  // side can only truncate its own line, never push into the other player.
  faceoff: { flexDirection: "row", alignItems: "flex-start" },
  side: { flex: 1, minWidth: 0, alignItems: "center", gap: Space.sm },
  sideLabel: { ...TextStyles.label, alignSelf: "stretch", textAlign: "center", color: Colors.text },
  // Centred on the 64pt tiles, not on the tile + name stack.
  vs: {
    ...TextStyles.labelSmall,
    width: 36,
    marginTop: (64 - TextStyles.labelSmall.lineHeight) / 2,
    textAlign: "center",
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  scoreBlock: { marginTop: Space.lg },
  label: {
    ...TextStyles.labelSmall,
    marginTop: Space.xl,
    marginBottom: Space.sm,
    letterSpacing: 1.4,
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
  scoreLabel: { ...TextStyles.labelSmall, alignSelf: "stretch", textAlign: "center", letterSpacing: 1.2, color: Colors.textSecondary },
  hint: { ...TextStyles.metadata, marginTop: Space.md, color: Colors.textSecondary },
  hideRow: { marginTop: Space.xl },
  error: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.loss },
});
