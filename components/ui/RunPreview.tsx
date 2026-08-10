import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatRunIdentity } from "@/components/home/homePresentation";
import { Colors, Radius } from "@/constants/colors";
import type { GameRun } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

export function RunPreview({
  run,
  onPress,
}: {
  run: GameRun;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Opens run details"
      accessibilityLabel={`${formatRunIdentity(run)}, ${run.date} at ${run.time}, ${run.participants.length} of ${run.maxPlayers} going`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.timeWell}>
        <Text style={styles.time}>{run.time}</Text>
        <Text style={styles.date}>
          {run.date === "TODAY" ? "TODAY" : run.date}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.identity}>
          {formatRunIdentity(run)}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {run.participants.length} going ·{" "}
          {Math.max(0, run.maxPlayers - run.participants.length)} spots open
        </Text>
      </View>
      <Feather color={Colors.muted} name="chevron-right" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 70,
    marginHorizontal: Layout.screenGutter,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.surfacePressed,
    transform: [{ scale: 0.99 }],
  },
  timeWell: {
    width: 58,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  time: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.text,
    textTransform: "uppercase",
  },
  date: {
    marginTop: 1,
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  identity: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  meta: {
    marginTop: 3,
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.textSecondary,
  },
});
