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
      snapPoints={["50%"]}
      bottomClearance={Layout.tabBarClearance}
      contentBottomPadding={12}
    >
      <View style={styles.content}>
        <Text style={styles.body}>
          Submit a court near you and it goes live for everyone once verified.
        </Text>
        <View style={styles.rows}>
          <IntroRow
            icon="map-pin"
            title="DROP YOUR PIN"
            body="Uses your live location. Be at the court."
          />
          <IntroRow
            icon="camera"
            title="SNAP A LIVE PHOTO"
            body="A photo of the court right now — no gallery."
          />
          <IntroRow
            icon="check-circle"
            title="CONFIRM & SUBMIT"
            body="Name auto-fills. Pick the sport and add."
          />
        </View>
        <Text style={styles.note}>
          AI checks the photo is a real court · 2 tries, then a short cooldown.
        </Text>
        <BrutalistButton
          label="LET’S GO"
          variant="accent"
          size="md"
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
        <Feather name={icon} color={Colors.accent} size={16} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Space.md },
  body: { ...TextStyles.bodySmall, color: Colors.textSecondary },
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
  copy: { flex: 1, gap: 1 },
  rowTitle: { ...TextStyles.labelSmall, color: Colors.text, letterSpacing: 1 },
  rowBody: { ...TextStyles.caption, color: Colors.muted },
  note: {
    ...TextStyles.caption,
    color: Colors.muted,
  },
  fullButton: { width: "100%", marginTop: Space.xs },
});
