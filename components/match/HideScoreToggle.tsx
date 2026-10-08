import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

/**
 * "Hide score" switch (D30, D40), used when logging, confirming, or any time
 * later from the game screen. A bare row, no box of its own, so it sits cleanly
 * on a screen or inside a card. What hiding does is explained once, in "How
 * score review works", not under every switch.
 */
export function HideScoreToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Feather color={value ? Colors.accent : Colors.textSecondary} name={value ? "eye-off" : "eye"} size={17} />
      <Text style={styles.label}>Hide score</Text>
      <Switch
        accessibilityHint="Everyone sees only who won. It still counts for ELO, rank and record."
        accessibilityLabel="Hide score"
        disabled={disabled}
        onValueChange={onChange}
        thumbColor={Colors.white}
        trackColor={{ false: Colors.borderLight, true: Colors.accent }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Layout.minTouchTarget + Space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingHorizontal: Space.xs,
  },
  label: { ...TextStyles.listName, flex: 1, color: Colors.text },
});
