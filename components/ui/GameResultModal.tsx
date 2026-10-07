import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreCard } from "@/components/match/ScoreCard";
import { Colors } from "@/constants/colors";
import type { CourtSport, FeedMatchSummary } from "@/constants/data";
import { Motion, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { firstName, summarizeHeadToHead } from "@/lib/headToHead";
import { fetchHeadToHead } from "@/services/gameService";

export function GameResultModal({
  match,
  sport: _sport,
  courtName,
  visible,
  onClose,
}: {
  match: FeedMatchSummary | null;
  sport?: CourtSport;
  courtName?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const progress = React.useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(visible);
  const { currentUser } = useApp();
  const [allTime, setAllTime] = React.useState<string | null>(null);

  // "You're 2–5 all-time vs Jesse" when you played in this 1v1.
  const opponent =
    match && match.sideA.length === 1 && match.sideB.length === 1
      ? [match.sideA[0], match.sideB[0]].find((p) => p.playerId !== currentUser.id) ?? null
      : null;
  const viewerPlayed =
    !!match && [...match.sideA, ...match.sideB].some((p) => p.playerId === currentUser.id);
  React.useEffect(() => {
    setAllTime(null);
    if (!visible || !viewerPlayed || !opponent || !currentUser.id) return;
    let cancelled = false;
    void fetchHeadToHead(currentUser.id, opponent.playerId).then((games) => {
      if (cancelled || games.length < 2) return;
      const s = summarizeHeadToHead(games);
      setAllTime(`You're ${s.myWins}–${s.theirWins} all-time vs ${firstName(opponent.name)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, viewerPlayed, opponent?.playerId, currentUser.id]);

  React.useEffect(() => {
    if (visible) setMounted(true);
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      Animated.timing(progress, {
        toValue: visible ? 1 : 0,
        duration: reduceMotion ? 0 : visible ? Motion.deliberate : Motion.fast,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !visible) setMounted(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [progress, visible]);

  if (!mounted || !match) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });
  const teamSize = Math.max(match.sideA.length, match.sideB.length);

  const viewGame = () => {
    onClose();
    router.push(`/match/${match.id}`);
  };
  const openPlayer = (id: string) => {
    onClose();
    router.push(`/player/${id}`);
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <View accessibilityViewIsModal style={styles.layer}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            accessibilityLabel="Close final game result"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              marginBottom: Math.max(bottom, 0) + Space.xl,
              opacity: progress,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          <ScoreCard
            courtName={courtName ?? "GAME"}
            format={`${teamSize}V${teamSize}`}
            leftLabel="TEAM A"
            leftPlayers={match.sideA.map((p) => ({ id: p.playerId, name: p.name, elo: p.elo ?? null }))}
            leftScore={match.scoreA}
            onPlayerPress={openPlayer}
            playedOn={match.playedAt}
            rightLabel="TEAM B"
            rightPlayers={match.sideB.map((p) => ({ id: p.playerId, name: p.name, elo: p.elo ?? null }))}
            rightScore={match.scoreB}
            status="confirmed"
            statusLabel="FINAL"
            footnote={allTime ?? undefined}
            scoresHidden={Boolean(match.scoresHidden)}
            variant="sheet"
          />
          <Pressable
            accessibilityRole="button"
            onPress={viewGame}
            style={({ pressed }) => [styles.viewGame, pressed && styles.pressed]}
          >
            <Text style={styles.viewGameText}>VIEW GAME</Text>
            <Feather color={Colors.accent} name="arrow-right" size={13} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  card: {
    marginHorizontal: Space.lg,
    paddingHorizontal: Space.md,
    // Top and bottom insets match: card top → FINAL bar (this padding + grabber
    // + its margin ≈ 24) ≈ "VIEW GAME" text → card bottom (its slack + this
    // padding ≈ 25).
    paddingTop: Space.sm,
    paddingBottom: Space.md,
    backgroundColor: Colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  handle: {
    width: 44,
    height: 4,
    marginBottom: Space.md,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: Colors.mutedDark,
  },
  viewGame: {
    minHeight: 40,
    marginTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  viewGameText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  pressed: { opacity: 0.72 },
});
