import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

export const REVIEW_RULES = [
  "Every submitted score has a 3-day review. Approve it sooner to update ELO immediately; otherwise it auto-approves.",
  "A dispute puts the game on hold for 7 days. During the hold, any player—or any player from either team—can correct the score, court, or date.",
  "A corrected game notifies every player and starts a new 3-day review. Players can approve it or dispute it again.",
  "A game can be disputed twice. A third dispute, or an unresolved 7-day hold, voids the game with no profile or ELO change.",
  "If half or more of the players turn on Hide score, the score is hidden from everyone else: they see only who won. Players in the game still see the score on this game score page. It still counts for ELO, rank and record.",
];

/**
 * "How score review works" as a centred pop-up (D47), opened from the info
 * button in the game page header. Read once, closed with the X or a tap
 * outside.
 */
export function ReviewRulesModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>HOW SCORE REVIEW WORKS</Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={styles.close}
            >
              <Feather color={Colors.textSecondary} name="x" size={18} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
            {REVIEW_RULES.map((rule, index) => (
              <View key={rule} style={styles.row}>
                <View style={styles.index}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <Text style={styles.text}>{rule}</Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Layout.screenGutter,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    padding: Space.lg,
    gap: Space.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  header: { flexDirection: "row", alignItems: "center", gap: Space.md },
  title: { ...TextStyles.label, flex: 1, color: Colors.text, letterSpacing: 1.2 },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
  },
  rows: { gap: Space.lg },
  row: { flexDirection: "row", alignItems: "flex-start", gap: Space.md },
  index: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
  },
  indexText: { ...TextStyles.labelSmall, color: Colors.textSecondary },
  text: { ...TextStyles.bodySmall, flex: 1, color: Colors.textSecondary },
});
