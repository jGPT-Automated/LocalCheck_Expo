import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors } from "@/constants/colors";
import { getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { runs, joinRun, currentUser } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);

  const run = runs.find((r) => r.id === id);
  if (!run) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>RUN NOT FOUND</Text>
        <BrutalistButton label="GO BACK" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const sportColor = getSportColor(run.sport);
  const total = run.participants.length;
  const max = run.maxPlayers;
  const spotsLeft = Math.max(0, max - total);
  const isJoined = run.participants.some((p) => p.id === currentUser.id);
  const isFull = spotsLeft === 0;

  const handleJoin = async () => {
    if (isJoined || isFull || joining) return;
    setJoining(true);
    setJoinError(false);
    const ok = await joinRun(run.id);
    setJoining(false);
    if (!ok) setJoinError(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 34 : bottom) + 120 }}
      >
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerMain}>
            <View style={styles.headerMeta}>
              <View style={[styles.sportTag, { borderColor: sportColor }]}>
                <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                <Text style={[styles.sportTagText, { color: sportColor }]}>{run.sport}</Text>
              </View>
              <View style={styles.levelTag}>
                <Text style={styles.levelText}>{run.skillLevel}</Text>
              </View>
            </View>
            <Text style={styles.runTitle}>{run.title}</Text>
            <Text style={styles.runInfo}>{run.time} · {run.date} · {run.courtName.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.controlRow}>
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>GOING</Text>
            <Text style={styles.controlValue}>{total}/{max}</Text>
          </View>
          <View style={[styles.controlItem, styles.controlBorder]}>
            <Text style={styles.controlLabel}>SPOTS LEFT</Text>
            <Text style={styles.controlValue}>{spotsLeft}</Text>
          </View>
        </View>

        {/* Single RSVP roster — the DB models who's going, not team sides.
            Teams get sorted out on the court. */}
        <View style={styles.rosterArea}>
          <View style={[styles.teamHeader, { borderBottomColor: sportColor }]}>
            <Text style={styles.teamLabel}>WHO'S GOING</Text>
          </View>
          {run.participants.map((player) => (
            <View key={player.id} style={styles.playerSlot}>
              <PlayerAvatar initials={player.avatar} size={34} />
              <View>
                <Text style={styles.slotName}>
                  {player.name.split(" ")[0]}
                  {player.id === run.hostId ? "  · HOST" : ""}
                </Text>
                <Text style={styles.slotElo}>{player.elo} ELO</Text>
              </View>
            </View>
          ))}
          {Array.from({ length: spotsLeft }).map((_, i) => (
            <View key={`open-${i}`} style={styles.playerSlot}>
              <View style={styles.emptySlot}>
                <Text style={styles.emptySlotText}>OPEN</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.resultSection}>
          <Text style={styles.resultLabel}>PLAYED A GAME HERE?</Text>
          <View style={styles.resultButtons}>
            <BrutalistButton
              label="LOG A GAME"
              onPress={() => router.push(`/(tabs)/compete?tab=log&courtId=${run.courtId}`)}
              variant="outline"
              style={styles.resultBtn}
              testID="log-game-btn"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: (Platform.OS === "web" ? 34 : bottom) + 12 }]}>
        {joinError && <Text style={styles.joinError}>COULD NOT JOIN — TRY AGAIN</Text>}
        <BrutalistButton
          label={isJoined ? "YOU'RE GOING ✓" : isFull ? "RUN FULL" : joining ? "JOINING…" : "JOIN RUN"}
          onPress={handleJoin}
          variant={isJoined ? "outline" : "accent"}
          style={{ flex: 1, opacity: isFull && !isJoined ? 0.5 : 1 }}
          testID="join-run-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 40 },
  notFoundText: { fontFamily: Typography.heading, fontSize: 24, color: Colors.text, letterSpacing: 2 },
  header: {
    paddingHorizontal: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.black,
    flexDirection: "row", gap: 16,
  },
  backBtn: {},
  backText: { fontFamily: Typography.heading, fontSize: 26, color: Colors.white, lineHeight: 28 },
  headerMain: { flex: 1 },
  headerMeta: { flexDirection: "row", gap: 8, marginBottom: 8 },
  sportTag: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  sportDot: { width: 6, height: 6, borderRadius: 3 },
  sportTagText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 2, textTransform: "uppercase" as const },
  levelTag: { borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 3 },
  levelText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.mutedDark, letterSpacing: 2, textTransform: "uppercase" as const },
  runTitle: { fontFamily: Typography.heading, fontSize: 32, color: Colors.white, letterSpacing: 1, lineHeight: 34 },
  runInfo: { fontFamily: Typography.body, fontSize: 12, color: Colors.mutedDark, marginTop: 4 },
  controlRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  controlItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  controlBorder: { borderLeftWidth: 1, borderColor: Colors.border },
  controlLabel: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.muted, letterSpacing: 2, textTransform: "uppercase" as const },
  controlValue: { fontFamily: Typography.heading, fontSize: 18, color: Colors.text },
  rosterArea: {},
  teamHeader: { borderBottomWidth: 3, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.surface },
  teamLabel: { fontFamily: Typography.heading, fontSize: 13, color: Colors.text, letterSpacing: 3 },
  playerSlot: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.border },
  slotName: { fontFamily: Typography.bodyBold, fontSize: 12, color: Colors.text },
  slotElo: { fontFamily: Typography.heading, fontSize: 11, color: Colors.muted, marginTop: 1 },
  emptySlot: { flex: 1, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed", alignItems: "center" },
  emptySlotText: { fontFamily: Typography.bodyMedium, fontSize: 10, color: Colors.muted, letterSpacing: 1.5 },
  resultSection: { paddingHorizontal: 20, paddingTop: 24 },
  resultLabel: { fontFamily: Typography.heading, fontSize: 13, color: Colors.text, letterSpacing: 3, borderBottomWidth: 1, borderColor: Colors.border, paddingBottom: 10, marginBottom: 12, textTransform: "uppercase" as const },
  resultButtons: { flexDirection: "row", gap: 10 },
  resultBtn: { flex: 1 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border },
  joinError: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.loss, letterSpacing: 1.5, textAlign: "center", marginBottom: 8 },
});
