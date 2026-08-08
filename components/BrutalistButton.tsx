import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

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
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "accent" ? Colors.black : Colors.white}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
  },
  inner: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: { marginRight: 2 },
  size_xs: { paddingHorizontal: 10, paddingVertical: 6 },
  size_sm: { paddingHorizontal: 14, paddingVertical: 9 },
  size_md: { paddingHorizontal: 20, paddingVertical: 14 },
  size_lg: { paddingHorizontal: 24, paddingVertical: 18 },
  variant_primary: { backgroundColor: Colors.white, borderWidth: 0 },
  variant_accent: { backgroundColor: Colors.accent, borderWidth: 0 },
  variant_outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border },
  variant_ghost: { backgroundColor: "transparent", borderWidth: 0 },
  variant_dark: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.75 },
  label: {
    fontFamily: Typography.heading,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  labelSize_xs: { fontSize: 10 },
  labelSize_sm: { fontSize: 11 },
  labelSize_md: { fontSize: 13 },
  labelSize_lg: { fontSize: 15 },
  labelVariant_primary: { color: Colors.black },
  labelVariant_accent: { color: Colors.black },
  labelVariant_outline: { color: Colors.text },
  labelVariant_ghost: { color: Colors.text },
  labelVariant_dark: { color: Colors.white },
});
