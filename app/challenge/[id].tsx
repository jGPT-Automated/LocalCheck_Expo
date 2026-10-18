import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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

import { GameStateBanner } from "@/components/match/GameStateBanner";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import {
  type Challenge,
  challengeAction,
  challengeBanner,
  challengeTitle,
  challengeTime,
  dayLabel,
  otherPlayer,
} from "@/lib/challengeModel";
import {
  cancelChallenge,
  finishCasualChallenge,
  fetchChallenge,
  respondToChallenge,
} from "@/services/challengeService";

/**
 * One challenge, from either player's side. Pending: the opponent accepts or
 * declines. Accepted, before the game time: call it off. After it: log the
 * score (a normal 1v1 the other confirms) or say you missed it. Completed:
 * links to the game.
 */
export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { currentUser } = useApp();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
  const banner = challengeBanner(challenge, viewerId);
  const caption = [
    [dayLabel(challenge.playOn), challengeTime(challenge.playAt)].filter(Boolean).join(" ").toUpperCase(),
    challenge.ranked ? null : "CASUAL",
  ]
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
  // After the game time: it never happened.
  const missed = () =>
    Alert.alert("Mark as didn't happen?", "They'll be told.", [
      { text: "Keep it", style: "cancel" },
      { text: "Didn't happen", style: "destructive", onPress: () => void run(() => cancelChallenge(challenge.id)) },
    ]);

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
      case "scheduled":
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
              label: "LOG SCORE",
              disabled: busy,
              onPress: () => router.push(`/(tabs)/compete?tab=log&challengeId=${challenge.id}`),
            }}
            secondary={{ label: "I MISSED IT", disabled: busy, onPress: missed }}
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
            secondary={{ label: "I MISSED IT", disabled: busy, onPress: missed }}
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
  error: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.textSecondary },
});
