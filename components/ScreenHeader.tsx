import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoLockup, LogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

/**
 * Canonical tab-screen header: LC mark + compact Inter title lockup on a
 * surface band with a bottom hairline (per the brand lockup sheet — logo sits at cap
 * height, left of the title). Every tab screen renders this — never
 * hand-roll a header again (that's how the four screens drifted).
 * `right` is the action slot (MAP toggle, "+" button, rank readout, …).
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  wordmark = false,
  onBack,
  prominent = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  wordmark?: boolean;
  onBack?: () => void;
  prominent?: boolean;
}) {
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 44 : top;
  return (
    <View style={[styles.header, { paddingTop: topPad }]}>
      <View style={[styles.contentRow, prominent && styles.contentRowProminent]}>
        <View style={styles.titleSlot}>
          {wordmark ? (
            <LogoLockup width={154} />
          ) : (
            <View style={[styles.lockup, prominent && styles.lockupProminent]}>
              {onBack ? (
                <Pressable
                  accessibilityHint="Returns to the previous screen"
                  accessibilityLabel="Back"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.backAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <LogoMark size={24} variant="back" />
                </Pressable>
              ) : (
                <LogoMark size={prominent ? 30 : 24} />
              )}
              <Text
                numberOfLines={1}
                style={[styles.title, prominent && styles.titleProminent]}
              >
                {title}
              </Text>
            </View>
          )}
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? (
          <View
            style={[styles.rightSlot, prominent && styles.rightSlotProminent]}
          >
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Canonical section label ("NEAREST COURT", "WHO'S PULLING UP", …): 11px caps
 * on the 20px gutter, optional accent counter/action on the right.
 */
export function SectionHeader({
  title,
  count,
  actionLabel,
  onActionPress,
  right,
  style,
}: {
  title: string;
  count?: number | string;
  actionLabel?: string;
  onActionPress?: () => void;
  right?: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.sectionRow, style]}>
      <View style={styles.sectionIdentity}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined ? (
          <Text style={styles.sectionCount}>{count}</Text>
        ) : null}
      </View>
      {actionLabel && onActionPress ? (
        <Text
          accessibilityRole="button"
          onPress={onActionPress}
          style={styles.sectionAction}
        >
          {actionLabel}
        </Text>
      ) : typeof right === "string" ? (
        <Text style={styles.sectionAccent}>{right}</Text>
      ) : (
        right
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  contentRow: {
    height: Layout.headerContentHeight,
    paddingHorizontal: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
  },
  contentRowProminent: { height: 56 },
  titleSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  rightSlot: {
    minWidth: Layout.minTouchTarget,
    minHeight: Layout.minTouchTarget,
    marginLeft: Space.md,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  rightSlotProminent: { transform: [{ translateY: 5 }] },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  lockupProminent: { transform: [{ translateY: 5 }] },
  pressed: { opacity: 0.68 },
  backAction: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    marginLeft: -10,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontFamily: Typography.headingRegular,
    fontSize: 21,
    color: Colors.text,
    letterSpacing: 1.4,
    lineHeight: 25,
    textTransform: "uppercase" as const,
    transform: [{ translateY: 1 }],
  },
  titleProminent: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: 1.2,
    transform: [{ translateY: 0 }],
  },
  subtitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.7,
    marginTop: 1,
    marginLeft: 32,
    textTransform: "uppercase" as const,
  },
  sectionRow: {
    minHeight: Layout.minTouchTarget,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Layout.screenGutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  sectionIdentity: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Space.sm,
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
  sectionCount: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.text,
  },
  sectionAction: {
    minHeight: Layout.minTouchTarget,
    paddingLeft: Space.lg,
    textAlignVertical: "center",
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    lineHeight: Layout.minTouchTarget,
    color: Colors.textSecondary,
    letterSpacing: 1.3,
    textTransform: "uppercase" as const,
  },
});
