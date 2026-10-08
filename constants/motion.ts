import { cubicBezier, Easing } from "react-native-reanimated";

/**
 * One set of motion settings for the whole app (Design and motion tab;
 * values from expo/skills `expo-animation`). Use these instead of inventing
 * a curve per screen. Only transform and opacity animate.
 */
export const Springs = {
  /** Settles without overshoot. */
  settle: { duration: 400, dampingRatio: 1 },
  /** Snap back after a drag; pass the gesture's velocity. */
  snapBack: { duration: 400, dampingRatio: 0.8 },
  /** Sheets and drawers. */
  sheet: { duration: 300, dampingRatio: 0.8 },
} as const;

/** For Reanimated CSS transitions (`transitionTimingFunction`). */
export const CssEase = {
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
} as const;

/** For `withTiming(..., { easing })`. */
export const Ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

export const Durations = {
  /** Press feedback. */
  press: 120,
  /** Toggles, chips, small state changes. */
  small: 180,
  /** Number tickers. */
  ticker: 600,
} as const;

/** How far a pressed card or button shrinks. Full-width rows highlight instead. */
export const PRESS_SCALE = 0.97;
