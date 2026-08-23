export function backLogoContainerStyle(size: number) {
  return {
    width: size,
    height: size,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

export function backLogoFrameStyle(size: number) {
  return {
    position: "absolute" as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: size,
    height: size,
  };
}

const FINAL_MARK_HEIGHT = 202;
const FINAL_MARK_TO_WORDMARK_GAP = 58;

/** Optical icon-to-title gap copied from the final full lockup geometry. */
export function brandHeaderGap(iconSize: number) {
  return Math.round(iconSize * (FINAL_MARK_TO_WORDMARK_GAP / FINAL_MARK_HEIGHT));
}
