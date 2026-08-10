import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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

import { formatMatchSide } from "@/components/home/homePresentation";
import { Colors, Radius } from "@/constants/colors";
import type { CourtSport, FeedMatchSummary } from "@/constants/data";
import { Motion, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

const SPORT_ICON = {
  BASKETBALL: "basketball",
  PICKLEBALL: "table-tennis",
  TENNIS: "tennis-ball",
  SOCCER: "soccer",
  VOLLEYBALL: "volleyball",
} as const;

export function GameResultModal({
  match,
  sport,
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

  const playedAt = new Date(match.playedAt);
  const dateLabel = Number.isNaN(playedAt.getTime())
    ? "FINAL RESULT"
    : playedAt
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase();
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [56, 0],
  });

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
              paddingBottom: Math.max(bottom, Space.lg),
              opacity: progress,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <View style={styles.eyebrow}>
                {sport ? (
                  <MaterialCommunityIcons
                    color={Colors.accent}
                    name={SPORT_ICON[sport]}
                    size={12}
                  />
                ) : null}
                <Text style={styles.eyebrowText}>
                  {sport ? `${sport} · ` : ""}FINAL
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.court}>
                {courtName || "GAME RESULT"}
              </Text>
              <Text style={styles.date}>{dateLabel}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Feather color={Colors.text} name="x" size={18} />
            </Pressable>
          </View>

          <View style={styles.scoreboard}>
            <ResultSide
              label="SIDE A"
              names={formatMatchSide(match.sideA)}
              score={match.scoreA}
              winner={match.winnerSide === "a"}
            />
            <View style={styles.scoreDivider}>
              <Text style={styles.finalLabel}>FINAL</Text>
            </View>
            <ResultSide
              align="right"
              label="SIDE B"
              names={formatMatchSide(match.sideB)}
              score={match.scoreB}
              winner={match.winnerSide === "b"}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
          >
            <Text style={styles.doneText}>DONE</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ResultSide({
  label,
  names,
  score,
  winner,
  align = "left",
}: {
  label: string;
  names: string;
  score: number;
  winner: boolean;
  align?: "left" | "right";
}) {
  return (
    <View style={styles.side}>
      <View
        style={[styles.sideMeta, align === "right" && styles.sideMetaRight]}
      >
        <Text style={[styles.sideLabel, align === "right" && styles.textRight]}>
          {label}
        </Text>
        {winner ? (
          <View style={styles.winnerChip}>
            <Feather color={Colors.black} name="check" size={9} />
            <Text style={styles.winnerChipText}>WIN</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.sideNames, align === "right" && styles.textRight]}>
        {names}
      </Text>
      <Text
        style={[
          styles.sideScore,
          winner && styles.winnerScore,
          align === "right" && styles.textRight,
        ]}
      >
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  card: {
    paddingHorizontal: 20,
    paddingTop: Space.sm,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.borderLight,
  },
  handle: {
    width: 44,
    height: 4,
    marginBottom: Space.lg,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: Colors.mutedDark,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.lg,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  eyebrowText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  court: {
    marginTop: 6,
    fontFamily: Typography.headingBold,
    fontSize: 22,
    lineHeight: 27,
    color: Colors.text,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  date: {
    marginTop: 3,
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreboard: {
    minHeight: 176,
    marginTop: Space.xl,
    paddingVertical: Space.lg,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  side: {
    flex: 1,
    paddingHorizontal: Space.md,
  },
  sideMeta: {
    minHeight: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },
  sideMetaRight: {
    justifyContent: "flex-end",
  },
  sideLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.25,
  },
  sideNames: {
    minHeight: 34,
    marginTop: Space.sm,
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.text,
    textTransform: "uppercase",
  },
  sideScore: {
    marginTop: Space.md,
    fontFamily: Typography.headingBold,
    fontSize: 45,
    lineHeight: 49,
    color: Colors.textSecondary,
  },
  winnerScore: {
    color: Colors.accent,
  },
  textRight: {
    textAlign: "right",
  },
  winnerChip: {
    minHeight: 17,
    paddingHorizontal: 5,
    borderRadius: Radius.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Colors.accent,
  },
  winnerChipText: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.black,
    letterSpacing: 0.6,
  },
  scoreDivider: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  finalLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1.1,
    transform: [{ rotate: "-90deg" }],
  },
  done: {
    minHeight: 48,
    marginTop: Space.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
  },
  doneText: {
    fontFamily: Typography.headingBold,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 1.4,
  },
  pressed: {
    opacity: 0.72,
  },
});
