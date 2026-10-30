import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

interface BrutalistButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "accent" | "outline" | "ghost" | "dark";
  size?: "xs" | "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  icon?: React.ReactNode;
}

export function BrutalistButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
  testID,
  icon,
}: BrutalistButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <PressableScale
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={[
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={StyleSheet.flatten(styles[`labelVariant_${variant}`]).color}
          size="small"
        />
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[styles.label, styles[`labelSize_${size}`], styles[`labelVariant_${variant}`]]}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

// Court-flow button language (Claude Design handoff): 4pt corners, Inter
// bold uppercase labels with wide tracking, 50pt main actions. Orange stays
// for Check in and live actions; white is the neutral primary (Join game,
// Unlock); dark and outline are the quiet partners.
const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.button,
  },
  inner: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: { marginRight: 2 },
  size_xs: { minHeight: 30, paddingHorizontal: 12 },
  size_sm: { minHeight: 40, paddingHorizontal: 14 },
  size_md: { minHeight: 50, paddingHorizontal: 20 },
  size_lg: { minHeight: 52, paddingHorizontal: 24 },
  variant_primary: { backgroundColor: Colors.text, borderWidth: 0 },
  variant_accent: { backgroundColor: Colors.accent, borderWidth: 0 },
  variant_outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.hairlineChrome },
  variant_ghost: { backgroundColor: "transparent", borderWidth: 0 },
  variant_dark: { backgroundColor: Colors.panel, borderWidth: 1, borderColor: Colors.hairlineChrome },
  disabled: { opacity: 0.3 },
  label: {
    fontFamily: Typography.bodyBold,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
  },
  labelSize_xs: { fontSize: 9 },
  labelSize_sm: { fontSize: 10 },
  labelSize_md: { fontSize: 12 },
  labelSize_lg: { fontSize: 12 },
  labelVariant_primary: { color: Colors.background },
  labelVariant_accent: { color: Colors.background },
  labelVariant_outline: { color: Colors.text },
  labelVariant_ghost: { color: Colors.text },
  labelVariant_dark: { color: Colors.text },
});
