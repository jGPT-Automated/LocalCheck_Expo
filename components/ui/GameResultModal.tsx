import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Dimensions, Pressable, StyleSheet, Text } from "react-native";

import { shortFirstName } from "@/components/match/gameCardModel";
import { ScoreCard } from "@/components/match/ScoreCard";
import { AppBottomSheetModal, useSheetBottomPadding } from "@/components/sheet/AppBottomSheetModal";
import { Colors } from "@/constants/colors";
import type { CourtSport, FeedMatchSummary } from "@/constants/data";
import { Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { summarizeHeadToHead } from "@/lib/headToHead";
import { fetchHeadToHead } from "@/services/gameService";

/**
 * Final game result, opened from a feed row (mock 3a). A real bottom sheet:
 * drag it down, tap the backdrop, or swipe it away. It used to be a Modal with
 * a drawn-on handle that didn't move.
 */
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
  const bottomPadding = useSheetBottomPadding();
  const router = useRouter();
  const sheetRef = React.useRef<BottomSheetModal>(null);
  const presentedRef = React.useRef(false);
  const { currentUser } = useApp();
  const [allTime, setAllTime] = React.useState<string | null>(null);
  // Keep showing the last game while the sheet slides away after the caller
  // clears `match`.
  const lastMatch = React.useRef<FeedMatchSummary | null>(match);
  if (match) lastMatch.current = match;
  const shown = match ?? lastMatch.current;

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
      setAllTime(`You're ${s.myWins}–${s.theirWins} all-time vs ${shortFirstName(opponent.name)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, viewerPlayed, opponent?.playerId, currentUser.id]);

  React.useEffect(() => {
    if (visible && match && !presentedRef.current) {
      presentedRef.current = true;
      requestAnimationFrame(() => sheetRef.current?.present());
    } else if (!visible && presentedRef.current) {
      sheetRef.current?.dismiss();
    }
  }, [visible, match]);

  const teamSize = shown ? Math.max(shown.sideA.length, shown.sideB.length) : 1;
  const leave = (path: string) => {
    sheetRef.current?.dismiss();
    onClose();
    router.push(path as never);
  };

  return (
    <AppBottomSheetModal
      compactHandle
      dynamic
      maxDynamicContentSize={Dimensions.get("window").height * 0.86}
      onDismiss={() => {
        presentedRef.current = false;
        onClose();
      }}
      ref={sheetRef}
      snapPoints={[]}
    >
      {shown ? (
        <BottomSheetView style={[styles.content, { paddingBottom: bottomPadding }]}>
          <ScoreCard
            courtName={courtName ?? ""}
            footnote={allTime ?? undefined}
            format={`${teamSize}V${teamSize}`}
            leftLabel="TEAM A"
            leftPlayers={shown.sideA.map((p) => ({ id: p.playerId, name: p.name, elo: p.elo ?? null }))}
            leftScore={shown.scoreA}
            onPlayerPress={(id) => leave(`/player/${id}`)}
            playedOn={shown.playedAt}
            rightLabel="TEAM B"
            rightPlayers={shown.sideB.map((p) => ({ id: p.playerId, name: p.name, elo: p.elo ?? null }))}
            rightScore={shown.scoreB}
            scoresHidden={Boolean(shown.scoresHidden)}
            status="confirmed"
            statusLabel="FINAL"
          />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => leave(`/match/${shown.id}`)}
            style={({ pressed }) => [styles.viewGame, pressed && styles.pressed]}
          >
            <Text style={styles.viewGameText}>VIEW GAME</Text>
            <Feather color={Colors.accent} name="arrow-right" size={13} />
          </Pressable>
        </BottomSheetView>
      ) : null}
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // The card starts a step under the sheet's grabber, not flush against it.
  content: { paddingHorizontal: Space.lg, paddingTop: Space.sm },
  viewGame: {
    minHeight: 44,
    marginTop: Space.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  viewGameText: {
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 1.6,
  },
  pressed: { opacity: 0.72 },
});
