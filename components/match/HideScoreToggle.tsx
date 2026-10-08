import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

/** "Hide my score" switch (decision D30), used when logging, confirming, or
 * any time later from the game screen. */
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
      <View style={styles.copy}>
        <Text style={styles.title}>Hide my score</Text>
        <Text style={styles.body}>
          Others see only who won. It still counts for ELO, rank and record.
        </Text>
      </View>
      <Switch
        accessibilityLabel="Hide my score from other players"
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
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  copy: { flex: 1, gap: 2 },
  title: { ...TextStyles.listName, color: Colors.text },
  body: { ...TextStyles.caption, lineHeight: 15, color: Colors.textSecondary },
});
