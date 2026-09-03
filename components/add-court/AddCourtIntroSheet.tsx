import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

/** The Explore-owned Add Court entry. Schedule's exact task-drawer owner owns interaction. */
export function AddCourtIntroSheet({
  visible,
  onClose,
  onStart,
}: {
  visible: boolean;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <RunFlowSheet
      visible={visible}
      onClose={onClose}
      title="ADD A COURT"
      snapPoints={["64%"]}
      bottomClearance={Layout.tabBarClearance}
      contentBottomPadding={12}
    >
      <View style={styles.content}>
        <Text style={styles.body}>
          Help grow the network. Submit a court near you and it’ll be live for
          everyone once verified.
        </Text>
        <View style={styles.rows}>
          <IntroRow
            icon="map-pin"
            title="DROP YOUR PIN"
            body="We use your live location. You must be at the court."
          />
          <IntroRow
            icon="camera"
            title="SNAP A LIVE PHOTO"
            body="Take a photo of the court right now. No gallery picks — keeps it real."
          />
          <IntroRow
            icon="check-circle"
            title="CONFIRM & SUBMIT"
            body="Court name auto-fills from your street. Pick the sport and hit Add."
          />
        </View>
        <View style={styles.warning}>
          <Feather name="alert-circle" color={Colors.muted} size={18} />
          <Text style={styles.warningCopy}>
            AI verifies your photo is an actual court. You get{" "}
            <Text style={styles.warningStrong}>2 attempts</Text> — then a
            cooldown before you can try again.
          </Text>
        </View>
        <BrutalistButton
          label="LET’S GO"
          variant="accent"
          size="lg"
          style={styles.fullButton}
          onPress={onStart}
        />
      </View>
    </RunFlowSheet>
  );
}

function IntroRow({
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
        <Feather name={icon} color={Colors.accent} size={20} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Space.lg },
  body: { ...TextStyles.bodySmall, color: Colors.textSecondary },
  rows: { gap: Space.md },
  row: { flexDirection: "row", alignItems: "center", gap: Space.md },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentGhost,
  },
  copy: { flex: 1, gap: 2 },
  rowTitle: { ...TextStyles.label, color: Colors.text, letterSpacing: 1.1 },
  rowBody: { ...TextStyles.metadata, color: Colors.muted, lineHeight: 18 },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  warningCopy: {
    ...TextStyles.metadata,
    flex: 1,
    color: Colors.muted,
    lineHeight: 18,
  },
  warningStrong: {
    color: Colors.text,
    fontFamily: TextStyles.label.fontFamily,
  },
  fullButton: { width: "100%" },
});
