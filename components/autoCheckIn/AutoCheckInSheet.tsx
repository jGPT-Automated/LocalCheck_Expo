import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { GeofenceVisual } from "@/components/autoCheckIn/GeofenceVisual";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

/**
 * The opt-in for auto check-in (D35, D36, D48). Shown once when a player sets
 * a local court, and from Settings. iOS asks for location right after, then
 * offers "Change to Always Allow". The circle it watches first, then what it
 * does and what it never does, then the buttons.
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
    <RunFlowSheet
      contentBottomPadding={Space.lg}
      dynamic
      eyebrow={courtName.toUpperCase()}
      onClose={onClose}
      title="AUTO CHECK-IN"
      visible={visible}
    >
      <View style={styles.content}>
        <GeofenceVisual courtName={courtName} />
        <View style={styles.rows}>
          <Point body="A few minutes after you arrive" icon="log-in" title="CHECKED IN" />
          <Point body="When you leave" icon="log-out" title="CHECKED OUT" />
          <Point body="Only this circle, nowhere else" icon="lock" title="PRIVATE" />
        </View>
        <Text style={styles.note}>iPhone will ask for location: choose Always Allow.</Text>
        <View style={styles.buttons}>
          <BrutalistButton
            label={busy ? "TURNING ON…" : "TURN ON"}
            onPress={onTurnOn}
            size="md"
            style={styles.button}
            variant="accent"
          />
          <BrutalistButton label="NOT NOW" onPress={onClose} size="md" style={styles.button} variant="ghost" />
        </View>
      </View>
    </RunFlowSheet>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Feather color={Colors.accent} name={icon} size={16} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.rowBody}>
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Space.md },
  rows: { gap: Space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Space.md },
  iconBox: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentGhost,
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { ...TextStyles.labelSmall, color: Colors.text, letterSpacing: 1 },
  rowBody: { ...TextStyles.caption, color: Colors.muted },
  note: { ...TextStyles.caption, color: Colors.muted },
  buttons: { gap: Space.xs },
  button: { width: "100%" },
});
