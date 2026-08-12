export type SplashMode = "signed-in" | "signed-out";
export type SplashGlyph = "pin" | "win" | "check";

export const SIGNED_IN_TOTAL_MS = 1_100;
export const SIGNED_OUT_TOTAL_MS = 1_650;

export interface SplashTimelineState {
  artworkProgress: number;
  complete: boolean;
  glyph: SplashGlyph;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Pure contract for both launch treatments. The UI animates between these
 * beats, while tests keep the signed-in path below the two-second release
 * budget and make Reduce Motion deterministic.
 */
export function splashStateAt(
  elapsedMs: number,
  mode: SplashMode,
  reducedMotion: boolean,
): SplashTimelineState {
  if (reducedMotion) {
    return { artworkProgress: 1, complete: true, glyph: "check" };
  }

  const elapsed = Math.max(0, elapsedMs);
  const glyph = elapsed < 260 ? "pin" : elapsed < 520 ? "win" : "check";
  const total = mode === "signed-in" ? SIGNED_IN_TOTAL_MS : SIGNED_OUT_TOTAL_MS;

  return {
    artworkProgress:
      mode === "signed-out" ? clamp01(elapsed / 900) : 1,
    complete: elapsed >= total,
    glyph,
  };
}
