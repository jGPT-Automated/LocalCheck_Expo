import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { HomeCheckInStatus } from "@/components/home/homeStatusModel";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

/** Informational only; the corresponding controls stay below the court hero. */
export function HomeSessionStatus({ status }: { status: HomeCheckInStatus }) {
  return (
    <View
      testID="home-session-status"
      accessible
      accessibilityLabel={`${status.phase === "pending" ? "Not posted. " : ""}${status.label}${status.clock ? ` ${status.clock}` : ""}`}
      style={styles.status}
    >
      <Text style={styles.label}>{status.label}</Text>
      {status.clock ? (
        <Text testID="home-session-clock" style={styles.clock}>
          {status.clock}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  status: { alignItems: "flex-end", justifyContent: "center", gap: 2 },
  label: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.background,
  },
  clock: {
    fontFamily: Typography.headingSemiBold,
    fontSize: 23,
    lineHeight: 25,
    color: Colors.background,
    fontVariant: ["tabular-nums"],
  },
});
