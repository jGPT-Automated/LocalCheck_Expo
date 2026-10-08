import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { AUTO_CHECK_IN_HOLD_MINUTES } from "@/lib/autoCheckInModel";

const POINTS: { icon: React.ComponentProps<typeof Feather>["name"]; text: string }[] = [
  { icon: "map-pin", text: "Only this court. Nowhere else is watched." },
  {
    icon: "clock",
    text: `You show up after ${AUTO_CHECK_IN_HOLD_MINUTES} minutes, so walking or driving past never posts.`,
  },
  { icon: "rotate-ccw", text: "You get a notification with Undo. Leaving checks you out." },
  { icon: "eye", text: "Uses your privacy setting. Turn it off anytime in Settings." },
];

/**
 * The opt-in for auto check-in (D35, D36). Shown once when a player sets a
 * local court, and from Settings. iOS asks for location right after, then
 * offers "Change to Always Allow".
 */
export function AutoCheckInSheet({
  visible,
  courtName,
  busy,
  onTurnOn,
  onClose,
}: {
  visible: boolean;
  courtName: string;
  busy: boolean;
  onTurnOn: () => void;
  onClose: () => void;
}) {
  return (
    <RunFlowSheet dynamic eyebrow="AUTO CHECK-IN" onClose={onClose} title={`Check in automatically at ${courtName}?`} visible={visible}>
      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.icon} style={styles.point}>
            <Feather color={Colors.accent} name={point.icon} size={16} style={styles.icon} />
            <Text style={styles.pointText}>{point.text}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>
        Next, iPhone asks to use your location. Choose Allow While Using, then Change to Always Allow so it works with
        your phone in your pocket.
      </Text>
      <BrutalistButton
        label={busy ? "TURNING ON…" : "TURN ON"}
        onPress={onTurnOn}
        style={styles.primary}
        variant="accent"
      />
      <BrutalistButton label="NOT NOW" onPress={onClose} style={styles.secondary} variant="ghost" />
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
  points: { marginTop: Space.lg, gap: Space.md },
  point: { flexDirection: "row", gap: Space.md, alignItems: "flex-start" },
  icon: { marginTop: 2 },
  pointText: { ...TextStyles.body, flex: 1, color: Colors.text },
  hint: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.textSecondary },
  primary: { marginTop: Space.xl, minHeight: 52 },
  secondary: { marginTop: Space.sm, minHeight: 48 },
});
