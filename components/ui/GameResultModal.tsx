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
            leftPlayers={match.sideA.map((p) => ({ id: p.playerId, name: p.name }))}
            leftScore={match.scoreA}
            onPlayerPress={openPlayer}
            playedOn={match.playedAt}
            rightLabel="TEAM B"
            rightPlayers={match.sideB.map((p) => ({ id: p.playerId, name: p.name }))}
            rightScore={match.scoreB}
            status="confirmed"
            statusLabel="FINAL"
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
    paddingTop: Space.sm,
    paddingBottom: Space.lg,
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
    minHeight: 44,
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
