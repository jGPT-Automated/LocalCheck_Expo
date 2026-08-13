import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { LogoMark } from "@/components/brand/LogoMark";
import { brandHeaderGap } from "@/components/brand/logoPresentation";
import { Layout, Space } from "@/constants/layout";
import { FontSizes, LetterSpacings, Typography } from "@/constants/typography";

export function DetailHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 44 : top;
  return (
    <View style={[styles.header, { gap: brandHeaderGap(30), paddingTop: topPad }]}>
      <Pressable
        accessibilityHint="Returns to the previous screen"
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.brandBack, pressed && styles.pressed]}
      >
        <LogoMark size={30} variant="back" />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 100, paddingHorizontal: Layout.screenGutter, paddingBottom: Space.md, flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  brandBack: { width: 32, height: Layout.minTouchTarget, alignItems: "flex-start", justifyContent: "center" },
  title: { flex: 1, minWidth: 0, fontFamily: Typography.bodySemiBold, fontSize: FontSizes.lg, lineHeight: FontSizes.xl, color: Colors.text, letterSpacing: LetterSpacings.normal, textTransform: "uppercase" },
  right: { minWidth: 32, minHeight: Layout.minTouchTarget, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.68, transform: [{ scale: 0.96 }] },
});
