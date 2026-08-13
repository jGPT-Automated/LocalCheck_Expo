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

// Unitless multipliers: lineHeight = fontSize * LineHeightRatios.<role>.
export const LineHeightRatios = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.625,
  heading: 1.1,
};

// Fixed pixel line-heights, kept out of LineHeightRatios so `fontSize *
// LineHeights.<role>` can never silently resolve to the wrong unit.
export const LineHeightsPx = {
  body: 22,
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
