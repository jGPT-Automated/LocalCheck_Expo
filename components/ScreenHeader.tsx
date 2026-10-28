import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoLockup, LogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import {
  checkInVisibilityLabel,
  formatCheckInElapsed,
} from "@/lib/checkInStatus";

/**
 * How long you have been checked in and who can see it: the far right of the
 * orange header. Ticks once a second; digits are tabular so it never jitters.
 */
function CheckInClock({
  startedAt,
  visibility,
}: {
  startedAt: string | null;
  visibility: "public" | "friends" | "private";
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = startedAt ? formatCheckInElapsed(startedAt, now) : "0:00";
  return (
    <View
      accessibilityLabel={`Checked in for ${elapsed}. Visible to ${checkInVisibilityLabel(visibility).toLowerCase()}.`}
      accessible
      style={styles.clock}
    >
      <Text style={styles.clockTime}>{elapsed}</Text>
      <Text style={styles.clockVisibility}>
        {checkInVisibilityLabel(visibility)}
      </Text>
    </View>
  );
}

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
  onLogoPress,
  hideRightWhenLive = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  wordmark?: boolean;
  onBack?: () => void;
  onLogoPress?: () => void;
  /** Drop the right slot while checked in, for a label too wide to share the bar with the timer. */
  hideRightWhenLive?: boolean;
}) {
  const { top } = useSafeAreaInsets();
  const { checkedInCourtId, checkedInAt, visibility } = useApp();
  const live = Boolean(checkedInCourtId);
  const tone = live ? "dark" : "light";
  const topPad = Platform.OS === "web" ? 44 : top;
  return (
    <View
      style={[styles.header, live && styles.headerLive, { paddingTop: topPad }]}
    >
      <View style={styles.contentRow}>
        <View style={styles.titleSlot}>
          {wordmark ? (
            <LogoLockup width={154} />
          ) : (
            <View style={styles.lockup}>
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
                  <LogoMark size={24} tone={tone} variant="back" />
                </Pressable>
              ) : onLogoPress ? (
                <Pressable
                  accessibilityHint="Returns to Explore"
                  accessibilityLabel="Back to Explore"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={onLogoPress}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <LogoMark size={24} tone={tone} />
                </Pressable>
              ) : (
                <LogoMark size={24} tone={tone} />
              )}
              <Text
                numberOfLines={1}
                style={[styles.title, live && styles.titleLive]}
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
        {right && !(live && hideRightWhenLive) ? (
          <View style={[styles.rightSlot, live && styles.rightSlotLive]}>
            {right}
          </View>
        ) : null}
        {live ? (
          <CheckInClock startedAt={checkedInAt} visibility={visibility} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Canonical icon-only header action. The visible control stays restrained while
 * the press target remains the iOS-recommended 44 points.
 */
export function HeaderIconAction({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconActionTarget,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconActionVisual}>
        <Feather color={Colors.textSecondary} name={icon} size={16} />
      </View>
    </Pressable>
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
  // Checked in: the whole bar turns orange and the logo inverts.
  headerLive: {
    backgroundColor: Colors.accent,
    borderBottomColor: Colors.accent,
  },
  contentRow: {
    height: Layout.headerContentHeight,
    paddingHorizontal: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
  },
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
  // The screen's own action sits on a dark chip so its colours still read on orange.
  rightSlotLive: {
    minWidth: 0,
    paddingHorizontal: Space.sm,
    borderRadius: 9,
    backgroundColor: Colors.background,
  },
  clock: {
    minWidth: 76,
    marginLeft: Space.md,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  clockTime: {
    fontFamily: Typography.headingSemiBold,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 0.4,
    color: Colors.background,
    fontVariant: ["tabular-nums"],
  },
  clockVisibility: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.4,
    color: Colors.background,
  },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  pressed: { opacity: 0.68 },
  backAction: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    marginLeft: -10,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionTarget: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionVisual: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHigh,
  },
  title: {
    flexShrink: 1,
    fontFamily: Typography.headingRegular,
    fontSize: 21,
    color: Colors.text,
    letterSpacing: 1.4,
    lineHeight: 25,
    textTransform: "uppercase" as const,
  },
  titleLive: { color: Colors.background },
  subtitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.7,
    marginTop: 1,
    marginLeft: 32,
    textTransform: "uppercase" as const,
  },
  // Court-flow section label: small bold uppercase on the left with a quiet
  // count beside it, a hairline under the row.
  sectionRow: {
    minHeight: Layout.minTouchTarget,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Layout.screenGutter,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  sectionIdentity: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Space.sm,
  },
  sectionTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.text,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
  sectionAccent: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.muted,
  },
  sectionCount: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.muted,
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
