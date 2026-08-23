import type { TextStyle } from "react-native";

// Oswald is the canonical condensed display face from Design.pdf and Logo.png;
// Inter carries body copy. Components reference these tokens rather than font
// names so the brand stays consistent across the MVP.
export const Typography = {
  // 600 is the default display weight. 700 is reserved for the handful of
  // places that genuinely need emphasis; using it everywhere made the UI
  // feel crowded and flattened the hierarchy.
  heading: "Oswald_600SemiBold",
  headingBold: "Oswald_700Bold",
  headingRegular: "Oswald_500Medium",
  headingSemiBold: "Oswald_600SemiBold",
  body: "Inter_400Regular",
  bodyExtraLight: "Inter_200ExtraLight",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
};

export const FontSizes = {
  xs: 11,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 36,
  "4xl": 48,
  stat: 64,
};

export const LineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.625,
  body: 22,
  heading: 1.1,
};

export const LetterSpacings = {
  none: 0,
  tight: 0.1,
  normal: 0.3,
  wide: 1,
  wider: 1.5,
  widest: 2.5,
  caps: 2,
};

/**
 * Semantic text roles are the public typography API for product UI. Primitive
 * sizes remain available while legacy screens migrate, but shared components
 * should consume a role instead of assembling a new font treatment locally.
 */
export const TextStyles = {
  displayLarge: {
    fontFamily: Typography.headingBold,
    fontSize: FontSizes["3xl"],
    lineHeight: 40,
  },
  display: {
    fontFamily: Typography.headingSemiBold,
    fontSize: FontSizes["2xl"],
    lineHeight: 32,
  },
  title: {
    fontFamily: Typography.headingSemiBold,
    fontSize: FontSizes.xl,
    lineHeight: 26,
  },
  metric: {
    fontFamily: Typography.headingSemiBold,
    fontSize: 24,
    lineHeight: 28,
  },
  stat: {
    fontFamily: Typography.headingSemiBold,
    fontSize: FontSizes.xl,
    lineHeight: 26,
  },
  statSmall: {
    fontFamily: Typography.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: 22,
  },
  compactStat: {
    fontFamily: Typography.headingSemiBold,
    fontSize: FontSizes.md,
    lineHeight: 18,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: FontSizes.base,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: Typography.body,
    fontSize: FontSizes.md,
    lineHeight: 20,
  },
  listName: {
    fontFamily: Typography.bodySemiBold,
    fontSize: FontSizes.md,
    lineHeight: 18,
  },
  metadata: {
    fontFamily: Typography.body,
    fontSize: FontSizes.sm,
    lineHeight: 16,
  },
  caption: {
    fontFamily: Typography.body,
    fontSize: FontSizes.xs,
    lineHeight: 13,
  },
  label: {
    fontFamily: Typography.bodySemiBold,
    fontSize: FontSizes.sm,
    lineHeight: 16,
  },
  labelSmall: {
    fontFamily: Typography.bodyMedium,
    fontSize: FontSizes.xs,
    lineHeight: 13,
  },
} as const satisfies Record<string, TextStyle>;
