// Premium neutral dark grey — no blue tint anywhere (2026-07-18 rebrand).
// Depth = background → surface → surfaceHigh + 1px borders. No shadows.
export const Colors = {
  primary: "#FFFFFF",
  background: "#101010",
  surface: "#1A1A1A",
  surfaceHigh: "#262626",
  surfaceDark: "#0C0C0C",
  card: "#1A1A1A",
  border: "#2C2C2C",
  borderLight: "#2C2C2C",
  borderSubtle: "#222222",
  text: "#F5F5F5",
  textSecondary: "#A6A6A6",
  muted: "#7C7C7C",
  mutedDark: "#4A4A4A",
  accent: "#FF5500",
  accentDim: "rgba(255,85,0,0.12)",
  accentGlow: "rgba(255,85,0,0.35)",
  win: "#00E87A",
  winDim: "rgba(0,232,122,0.12)",
  loss: "#FF3B5C",
  lossDim: "rgba(255,59,92,0.12)",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.75)",
  overlayLight: "rgba(0,0,0,0.50)",

  tier: {
    platinum: "#E8E8FF",
    gold: "#FFD53D",
    silver: "#A6A6A6",
    bronze: "#CF8558",
  },
};

export const Radius = {
  xs: 2,
  sm: 3,
  md: 5,
  lg: 8,
};

export default Colors;
