import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { AppShell, Spacing } from "@/constants/layout";
import { Typography, TypeScale } from "@/constants/typography";

/**
 * Canonical tab-screen header: LC mark + condensed Oswald title lockup on a
 * surface band with a bottom hairline (per the brand lockup sheet — logo sits at cap
 * height, left of the title). Every tab screen renders this — never
 * hand-roll a header again (that's how the four screens drifted).
 * `right` is the action slot (MAP toggle, "+" button, rank readout, …).
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  titleRole = "screen",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  titleRole?: "screen" | "identity";
}) {
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  return (
    <View style={[styles.header, { paddingTop: topPad + 12 }]}>
      <View style={[styles.titleArea, subtitle && styles.titleAreaWithSubtitle]}>
        <View style={styles.lockup}>
          <LogoMark size={26} accessible={false} />
          <Text
            style={[styles.title, titleRole === "identity" && styles.identityTitle]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.rightSlot}>{right}</View> : null}
    </View>
  );
}

export function HeaderMetric({
  value,
  label,
  accessibilityLabel,
  tone = "accent",
}: {
  value: string | number;
  label: string;
  accessibilityLabel?: string;
  tone?: "accent" | "default" | "muted";
}) {
  return (
    <View
      style={styles.metric}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${value} ${label}`}
    >
      <Text
        style={[
          styles.metricValue,
          tone === "accent" && styles.metricValueAccent,
          tone === "muted" && styles.metricValueMuted,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
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
    minHeight: AppShell.headerContentHeight,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.screen,
    paddingBottom: AppShell.headerBottomPadding,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
    height: 44,
    justifyContent: "center",
  },
  titleAreaWithSubtitle: { height: 52 },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  title: {
    fontFamily: Typography.wordmark,
    ...TypeScale.navigation,
    color: Colors.text,
    textTransform: "uppercase" as const,
  },
  identityTitle: {
    ...TypeScale.navigationIdentity,
  },
  subtitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
    marginTop: 4,
  },
  rightSlot: {
    width: 100,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  metric: {
    maxWidth: 100,
    height: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  metricValue: {
    fontFamily: Typography.headingRegular,
    fontSize: 18,
    lineHeight: 20,
    color: Colors.text,
    letterSpacing: 0.5,
    fontVariant: ["tabular-nums"],
  },
  metricValueAccent: { color: Colors.accent },
  metricValueMuted: { color: Colors.muted },
  metricLabel: {
    maxWidth: 100,
    marginTop: 1,
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    lineHeight: 11,
    color: Colors.muted,
    letterSpacing: 1.05,
    textAlign: "right",
    textTransform: "uppercase",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  sectionAccent: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
});
