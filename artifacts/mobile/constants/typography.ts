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
  // Shared brand lockup role. Screen titles must not tune this independently.
  wordmark: "Oswald_500Medium",
  body: "Inter_400Regular",
  bodyExtraLight: "Inter_200ExtraLight",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
};

// Compact mobile product scale. The role names are semantic so screens do not
// invent local sizes. Values are anchored to the Material 3 title/body/label
// ladder, then tightened where the condensed LocalCheck display face allows it.
export const TypeScale = {
  navigation: { fontSize: 23, lineHeight: 27, letterSpacing: 1.5 },
  navigationIdentity: { fontSize: 17, lineHeight: 22, letterSpacing: 0.8 },
  titleMedium: { fontSize: 16, lineHeight: 20, letterSpacing: 0.3 },
  bodyMedium: { fontSize: 14, lineHeight: 20 },
  supporting: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 11, lineHeight: 16 },
  metricLarge: { fontSize: 24, lineHeight: 28 },
  metric: { fontSize: 18, lineHeight: 22 },
} as const;

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
