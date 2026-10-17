// Canonical tokens from the LocalCheck Brand Asset Sheet. Components should
// never introduce a competing orange, surface, or text palette locally.
// Oct 7: tuned to the source-of-truth mocks (screenshots/mocks): a deeper
// orange (#FC4C02), slightly lifted surfaces, and neutral rather than blue
// greys. Same names, so every screen picks it up.
export const Colors = {
  primary: "#FFFFFF",
  background: "#0D0D10",
  surface: "#17171C",
  surfaceHigh: "#1F1F25",
  surfacePressed: "#26262D",
  surfaceSelected: "#1F1F25",
  surfaceDark: "#09090B",
  card: "#17171C",
  border: "#27272D",
  borderLight: "#34343E",
  borderSubtle: "#202027",
  text: "#F2F2F6",
  textSecondary: "#9C9CA6",
  // 4.8–5.7:1 on every surface (Apple contrast minimum 4.5:1); was #6E6E7A at 3.3–3.9:1.
  muted: "#8A8A96",
  mutedDark: "#4E4E58",
  accent: "#FC4C02",
  brandMark: "#FD6A03",
  accentDim: "rgba(252,76,2,0.12)",
  liveQuiet: "rgba(252,76,2,0.08)",
  accentGlow: "rgba(252,76,2,0.35)",
  accentGhost: "rgba(252,76,2,0.035)",
  accentBorder: "rgba(252,76,2,0.36)",
  accentBorderStrong: "rgba(252,76,2,0.48)",
  accentTextShadow: "rgba(252,76,2,0.45)",
  win: "#00E87A",
  winDim: "rgba(0,232,122,0.12)",
  loss: "#FF3B5C",
  lossDim: "rgba(255,59,92,0.12)",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.75)",
  overlayLight: "rgba(0,0,0,0.50)",

  courtCardStart: "#202027",
  courtCardEnd: "#19191E",
  basketballTint: "rgba(216,181,141,0.11)",
  pickleballTint: "rgba(156,207,190,0.11)",
  basketballMeta: "#D8B58D",
  pickleballMeta: "#9CCFBE",
  // Court flow (Claude Design handoff, rn/theme.ts): sport label ink, the
  // hairline court trace, and the strip/tab dividers.
  basketballLabel: "#D8C8B6",
  pickleballLabel: "#BDD7CF",
  basketballTrace: "rgba(216,181,141,0.34)",
  pickleballTrace: "rgba(156,207,190,0.34)",
  hairline: "rgba(242,242,246,0.075)",
  hairlineCard: "rgba(242,242,246,0.09)",
  hairlineChrome: "rgba(242,242,246,0.16)",
  panel: "#18181D",
  sheet: "#121216",
  // Court flow chrome: raised tile/avatar fill, the sheet grab bar, quiet
  // dashed outlines for empty states, the live ink on dark (On court counts),
  // and the light secondary ink used on chips and the Court ↗ button.
  tile: "#24242C",
  grabber: "#3A3A44",
  dashed: "rgba(242,242,246,0.14)",
  liveInk: "#FF7B4B",
  inkSoft: "#D1D1D9",
  checkOutDot: "#4D4D56",
  // Planned-visit heat ramp (Week heatmap, drawer Today bars): fewer → more.
  heat1: "rgba(252,76,2,0.2)",
  heat2: "rgba(252,76,2,0.38)",
  heat3: "rgba(252,76,2,0.62)",

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
  card: 16,
  // Court flow radii (HANDOFF.md › Brand rules): buttons 4, chips 9,
  // rows 13, panels 16, cards 20, sheet 22.
  button: 4,
  chip: 9,
  row: 13,
  panel: 16,
  courtCard: 20,
  sheet: 22,
};

export default Colors;
