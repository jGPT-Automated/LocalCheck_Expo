import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

/**
 * The one shell for every task/creation form presented over a screen
 * (Pick a Court, Add a Court, Host a Run, Edit Run, …).
 *
 * Before this existed each of those hand-rolled its own `Modal` +
 * header + close button, so they drifted: different title casing, different
 * close affordances, different top padding, and no safe-area allowance — which
 * is why titles collided with the status bar / Dynamic Island on device.
 *
 * Contextual *court preview* stays on the `@gorhom/bottom-sheet` primitive in
 * CourtSheetHost. Quick look = bottom sheet; do a task = this. Don't add a
 * third pattern.
 */
export function FormSheet({
  visible,
  onClose,
  title,
  eyebrow,
  right,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Small caps line above the title, e.g. "STEP 1 OF 2 — COURT DETAILS". */
  eyebrow?: string;
  /** Optional trailing action; the close button is rendered when omitted. */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { top } = useSafeAreaInsets();

  // A native iOS pageSheet is already inset below the status bar, so adding the
  // full inset there would double the gap. Every other target needs it.
  const headerTopPad = Platform.OS === "ios" ? 14 : Math.max(top, 12) + 6;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      // Keeps the status-bar area dark while the sheet slides in on Android.
      statusBarTranslucent
    >
      <View style={styles.sheet}>
        <View style={[styles.header, { paddingTop: headerTopPad }]}>
          <View style={styles.headerText}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {right ?? (
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="form-sheet-close"
            >
              <Feather name="x" size={20} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  title: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  // 44pt target per Apple HIG; the glyph itself stays visually light.
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    borderRadius: Radius.sm,
  },
});
