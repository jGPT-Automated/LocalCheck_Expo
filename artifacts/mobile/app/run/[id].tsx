import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { BrutalistButton } from "@/components/BrutalistButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { updateScheduledGame } from "@/services/scheduledGameService";

const RUN_SIZES = [4, 6, 8, 10];

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { runs, joinRun, currentUser, refreshRuns } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

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
  const isHost = run.hostId === currentUser.id;
  // Before the start time the run can be edited; after it, it's a played game to log.
  const hasStarted = new Date(run.startTimeIso).getTime() <= Date.now();

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

        {/* Before start: host can edit the run. After start: it's a played
            game anyone here can log (routes to the Compete log flow). */}
        {hasStarted ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>GAME DONE? LOG THE RESULT</Text>
            <View style={styles.resultButtons}>
              <BrutalistButton
                label="LOG A GAME"
                onPress={() => router.push(`/(tabs)/compete?tab=log&courtId=${run.courtId}`)}
                variant="accent"
                style={styles.resultBtn}
                testID="log-game-btn"
              />
            </View>
          </View>
        ) : isHost ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>MANAGE THIS RUN</Text>
            <View style={styles.resultButtons}>
              <BrutalistButton
                label="EDIT RUN"
                onPress={() => setShowEdit(true)}
                variant="outline"
                style={styles.resultBtn}
                testID="edit-run-btn"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <EditRunModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        runId={run.id}
        initialTitle={run.title}
        initialMax={run.maxPlayers}
        goingCount={total}
        onSaved={refreshRuns}
      />

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

/**
 * Compact host-only run editor: title, capacity (never below who's already
 * going), and note. Time editing is intentionally out of scope here — recreate
 * the run for a different slot. Persists via updateScheduledGame (organizer-only
 * RLS); zero returned rows surfaces as an error.
 */
function EditRunModal({
  visible,
  onClose,
  runId,
  initialTitle,
  initialMax,
  goingCount,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  runId: string;
  initialTitle: string;
  initialMax: number;
  goingCount: number;
  onSaved: () => Promise<void> | void;
}) {
  const { top } = useSafeAreaInsets();
  const [title, setTitle] = useState(initialTitle);
  const [maxPlayers, setMaxPlayers] = useState(initialMax);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setMaxPlayers(initialMax);
      setFailed(false);
    }
  }, [visible, initialTitle, initialMax]);

  const sizes = RUN_SIZES.filter((n) => n >= Math.max(2, goingCount));
  const handleSave = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await updateScheduledGame(runId, {
      title: title.trim() || "PICKUP RUN",
      maxPlayers,
    });
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    await onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.editSheet, { paddingTop: Platform.OS === "ios" ? top : top + 12 }]}>
        <View style={styles.editHeader}>
          <Text style={styles.editTitle}>EDIT RUN</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color={Colors.muted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.editLabel}>TITLE</Text>
          <TextInput
            style={styles.editInput}
            value={title}
            onChangeText={setTitle}
            placeholder="PICKUP RUN"
            placeholderTextColor={Colors.mutedDark}
          />

          <Text style={styles.editLabel}>MAX PLAYERS</Text>
          <View style={styles.editSizeRow}>
            {sizes.map((n) => (
              <Pressable
                key={n}
                style={[styles.editSizeCell, maxPlayers === n && styles.editSizeCellActive]}
                onPress={() => setMaxPlayers(n)}
              >
                <Text style={[styles.editSizeText, maxPlayers === n && styles.editSizeTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          {failed && <Text style={styles.editError}>COULD NOT SAVE — TRY AGAIN</Text>}

          <Pressable style={[styles.editSaveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.editSaveText}>{saving ? "SAVING…" : "SAVE CHANGES"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
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

  // ── Edit run modal ──
  editSheet: { flex: 1, backgroundColor: Colors.background },
  editHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.border,
  },
  editTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.text, letterSpacing: 3 },
  editLabel: {
    fontFamily: Typography.bodyBold, fontSize: 11, color: Colors.muted, letterSpacing: 2,
    textTransform: "uppercase" as const, marginTop: 20, marginBottom: 8,
  },
  editInput: {
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, color: Colors.text,
    fontFamily: Typography.bodyMedium, fontSize: 13, paddingHorizontal: 12, minHeight: 44,
    paddingVertical: 10, borderRadius: Radius.xs,
  },
  editSizeRow: { flexDirection: "row", gap: 8 },
  editSizeCell: {
    flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: Radius.xs,
  },
  editSizeCellActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  editSizeText: { fontFamily: Typography.heading, fontSize: 13, color: Colors.muted, letterSpacing: 1 },
  editSizeTextActive: { color: Colors.accent },
  editError: {
    fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.loss, letterSpacing: 1.5,
    marginTop: 14, textAlign: "center",
  },
  editSaveBtn: {
    backgroundColor: Colors.accent, alignItems: "center", paddingVertical: 14,
    borderRadius: Radius.xs, marginTop: 20,
  },
  editSaveText: { fontFamily: Typography.heading, fontSize: 12, color: Colors.black, letterSpacing: 2 },
});
