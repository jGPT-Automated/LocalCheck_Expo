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
  detail,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** One quiet line under the label (team games: how many it takes). */
  detail?: string;
}) {
  return (
    <View style={styles.row}>
      <Feather color={Colors.textSecondary} name={value ? "eye-off" : "eye"} size={17} />
      <View style={styles.copy}>
        <Text style={styles.label}>Hide score</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityHint="Once half the players turn this on, everyone else sees only who won. It still counts for ELO, rank and record."
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
  copy: { flex: 1, minWidth: 0, gap: 1 },
  label: { ...TextStyles.listName, color: Colors.text },
  detail: { ...TextStyles.caption, color: Colors.muted },
});
