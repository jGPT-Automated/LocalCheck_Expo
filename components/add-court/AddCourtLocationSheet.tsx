import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import type { DeviceCoordinate } from "@/context/deviceLocationModel";
import { coordinateForLocationAction } from "@/context/deviceLocationModel";

/** Location step rendered over Explore's existing map. */
export function AddCourtLocationSheet({
  visible,
  onBack,
  onClose,
  onContinue,
  onCoordinate,
}: {
  visible: boolean;
  onBack: () => void;
  onClose: () => void;
  onContinue: (coordinate: DeviceCoordinate) => void;
  onCoordinate: (coordinate: DeviceCoordinate | null) => void;
}) {
  const { refresh } = useDeviceLocation();
  const [coordinate, setCoordinate] = React.useState<DeviceCoordinate | null>(
    null,
  );
  const [notice, setNotice] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setCoordinate(null);
      setNotice(null);
      setLocating(false);
    }
  }, [visible]);

  const locate = React.useCallback(async () => {
    setNotice(null);
    setLocating(true);
    const result = await refresh();
    const resolved = coordinateForLocationAction(result.status, result.coord);
    setLocating(false);
    if (!resolved) {
      setCoordinate(null);
      onCoordinate(null);
      setNotice("Location access is off. Turn it on, then try again.");
      return;
    }
    setCoordinate(resolved);
    onCoordinate(resolved);
  }, [onCoordinate, refresh]);

  return (
    <RunFlowSheet
      visible={visible}
      onClose={onClose}
      title="ADD A COURT"
      eyebrow="STEP 1 OF 3 · LOCATION"
      snapPoints={["34%"]}
      bottomClearance={Layout.tabBarClearance}
      contentBottomPadding={12}
      backdropOpacity={0}
    >
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Add Court overview"
          onPress={onBack}
          style={styles.back}
        >
          <Feather name="chevron-left" size={15} color={Colors.textSecondary} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <View style={styles.locationRow}>
          <View style={styles.iconBox}>
            <Feather
              name={coordinate ? "map-pin" : "crosshair"}
              size={16}
              color={Colors.accent}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>
              {coordinate ? "LOCATION LOCKED" : "DROP YOUR PIN"}
            </Text>
            <Text style={styles.body}>
              {coordinate
                ? "Your live location is ready."
                : "Stand at the court, then use your live location."}
            </Text>
          </View>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <BrutalistButton
          label={coordinate ? "CONTINUE TO PHOTO" : "USE MY LOCATION"}
          onPress={coordinate ? () => onContinue(coordinate) : locate}
          loading={locating}
          variant="accent"
          size="md"
          style={styles.fullButton}
          icon={
            <Feather
              name={coordinate ? "camera" : "navigation"}
              size={15}
              color={Colors.black}
            />
          }
        />
      </View>
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: Space.md },
  back: {
    minHeight: 32,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  backText: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
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
  title: { ...TextStyles.label, color: Colors.text, letterSpacing: 1 },
  body: { ...TextStyles.caption, color: Colors.textSecondary },
  notice: { ...TextStyles.caption, color: Colors.muted },
  fullButton: { width: "100%", marginTop: Space.xs },
});
