import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { LogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { AppShell, ControlSize, Motion, Spacing } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function HeaderIconButton({
  icon,
  label,
  onPress,
  badge,
  tone = "default",
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  badge?: number;
  tone?: "default" | "accent" | "danger";
}) {
  const color = tone === "accent" ? Colors.accent : tone === "danger" ? Colors.loss : Colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={color} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Math.min(badge, 9)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function DetailHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  return (
    <View style={[styles.header, { paddingTop: topPad }]}>
      <BrandBackButton onPress={onBack} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{right ?? <View style={styles.placeholder} />}</View>
    </View>
  );
}

function BrandBackButton({ onPress }: { onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? 1
      : withTiming(1, {
          duration: Motion.state,
          easing: Easing.out(Easing.cubic),
        });
  }, [progress, reducedMotion]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.62], [1, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 0.82]) },
      { translateX: interpolate(progress.value, [0, 1], [0, -2]) },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.28, 1], [0, 1]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.78, 1]) },
      { translateX: interpolate(progress.value, [0, 1], [3, 0]) },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={4}
      style={({ pressed }) => [styles.brandBackButton, pressed && styles.pressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.brandBackGlyph, markStyle]}>
        <LogoMark size={26} accessible={false} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.brandBackGlyph, backStyle]}>
        <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
          <Path
            d="M16.5 5.5 9 13l7.5 7.5"
            stroke={Colors.accent}
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: AppShell.headerContentHeight,
    paddingHorizontal: Spacing.screen,
    paddingBottom: AppShell.headerBottomPadding,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 0,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    marginLeft: -9,
    paddingBottom: 6,
  },
  title: {
    fontFamily: Typography.wordmark,
    fontSize: 23,
    lineHeight: 27,
    color: Colors.text,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  subtitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    color: Colors.muted,
    letterSpacing: 1.1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  right: { minWidth: ControlSize.minimum, alignItems: "flex-end" },
  placeholder: { width: ControlSize.minimum, height: ControlSize.minimum },
  brandBackButton: {
    width: ControlSize.minimum,
    height: ControlSize.minimum,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  brandBackGlyph: {
    position: "absolute",
    left: 0,
    top: 9,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: ControlSize.minimum,
    height: ControlSize.minimum,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  badge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  badgeText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.surfaceDark },
});
