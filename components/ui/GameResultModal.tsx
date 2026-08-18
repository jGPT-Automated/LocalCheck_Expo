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
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowLeft}>
                {sport ? (
                  <MaterialCommunityIcons
                    color={Colors.accent}
                    name={SPORT_ICON[sport]}
                    size={12}
                  />
                ) : null}
                <Text style={styles.eyebrowText}>{sport ? `${sport}` : ""}</Text>
              </View>
              {/* Only "confirmed" exists on this summary today, but the badge
                  is built to take pending/disputed variants without a
                  restyle once those states reach this modal. Kept on the
                  opposite edge from the sport tag — match state and sport
                  type are different categories of metadata and shouldn't
                  read as one grouped label. */}
              <StatusBadge status="confirmed" />
            </View>
            <Text style={styles.court}>{courtName || "GAME RESULT"}</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>

          <View style={styles.scoreboard}>
            <ResultSide
              label="SIDE A"
              names={formatMatchSide(match.sideA)}
              score={match.scoreA}
              winner={match.winnerSide === "a"}
            />
            <View style={styles.scoreDivider} />
            <ResultSide
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

const STATUS_BADGE: Record<
  "confirmed" | "pending" | "disputed",
  { label: string; background: string; color: string }
> = {
  confirmed: { label: "FINAL", background: Colors.accent, color: Colors.black },
  pending: { label: "PENDING", background: Colors.surfaceHigh, color: Colors.textSecondary },
  disputed: { label: "OBJECTED", background: Colors.loss, color: Colors.white },
};

function StatusBadge({ status }: { status: "confirmed" | "pending" | "disputed" }) {
  const { label, background, color } = STATUS_BADGE[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: background }]}>
      <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function ResultSide({
  label,
  names,
  score,
  winner,
}: {
  label: string;
  names: string;
  score: number;
  winner: boolean;
}) {
  return (
    <View style={styles.side}>
      <Text style={styles.sideLabel}>{label}</Text>
      <Text style={styles.sideNames}>{names}</Text>
      {/* WIN is an annotation on this side's score, not a match-state badge
          — it must not share the status pill's visual language (that's what
          made WIN and FINAL read as the same kind of thing). Text-only,
          tied to the number it explains, with a matching-height spacer on
          the other side so both scores still land on the same baseline. */}
      {winner ? (
        <View style={styles.winRow}>
          <Feather color={Colors.accent} name="check" size={10} />
          <Text style={styles.winText}>WIN</Text>
        </View>
      ) : (
        <View style={styles.winRowSpacer} />
      )}
      <Text style={[styles.sideScore, winner && styles.winnerScore]}>
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
    // No close button here anymore — the backdrop tap and DONE both close
    // this modal already, so a redundant X was competing with the court
    // name for the same row's width and forcing it to truncate.
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  eyebrowText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  statusBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
  },
  court: {
    marginTop: 8,
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
    textAlign: "center",
    fontFamily: Typography.headingBold,
    fontSize: 45,
    lineHeight: 49,
    color: Colors.textSecondary,
  },
  winnerScore: {
    color: Colors.accent,
  },
  winRow: {
    marginTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  winRowSpacer: {
    marginTop: Space.md,
    height: 12,
  },
  winText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  scoreDivider: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
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
