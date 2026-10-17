import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

export const REVIEW_RULES = [
  "Every submitted score has a 3-day review. Approve it sooner to update ELO immediately; otherwise it auto-approves.",
  "A dispute puts the game on hold for 7 days. During the hold, any player—or any player from either team—can correct the score, court, or date.",
  "A corrected game notifies every player and starts a new 3-day review. Players can approve it or dispute it again.",
  "A game can be disputed twice. A third dispute, or an unresolved 7-day hold, voids the game with no profile or ELO change.",
  "If half or more of the players turn on Hide score, the score is hidden from everyone else: they see only who won. Players in the game still see the score on this game score page. It still counts for ELO, rank and record.",
];

/**
 * "How score review works" (D47), opened from the info button in the game
 * page header. The same drawer as every other sheet (Oct 17): drag down or
 * tap outside to close.
 */
export function ReviewRulesModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <RunFlowSheet dynamic onClose={onClose} title="How score review works" visible={visible}>
      <View style={styles.rows}>
        {REVIEW_RULES.map((rule, index) => (
          <View key={rule} style={styles.row}>
            <View style={styles.index}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            <Text style={styles.text}>{rule}</Text>
          </View>
        ))}
      </View>
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
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
