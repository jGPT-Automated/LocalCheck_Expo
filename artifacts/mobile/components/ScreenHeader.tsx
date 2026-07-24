import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

/**
 * Canonical tab-screen header: LC mark + Kanit title lockup on a surface band
 * with a bottom hairline (per the brand lockup sheet — logo sits at cap
 * height, left of the title). Every tab screen renders this — never
 * hand-roll a header again (that's how the four screens drifted).
 * `right` is the action slot (MAP toggle, "+" button, rank readout, …).
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  return (
    <View style={[styles.header, { paddingTop: topPad + 12 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.lockup}>
          <LogoMark size={30} />
          <Text style={styles.title}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/**
 * Canonical section label ("NEAREST COURT", "WHO'S PULLING UP", …): 11px caps
 * on the 20px gutter, optional accent counter/action on the right.
 */
export function SectionHeader({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof right === "string" ? (
        <Text style={styles.sectionAccent}>{right}</Text>
      ) : (
        right
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 1,
    lineHeight: 34,
    textTransform: "uppercase" as const,
  },
  subtitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  sectionAccent: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
});
