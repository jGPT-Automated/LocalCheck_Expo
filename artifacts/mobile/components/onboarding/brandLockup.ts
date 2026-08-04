/**
 * Geometry and copy shared by the brand intro and the auth screen it hands off
 * to. The intro animates a lockup that must land exactly on top of the static
 * one, so these values have to come from a single place — when they drifted,
 * the handoff visibly jumped.
 */

/**
 * Broken across two lines on purpose. At this tracking the tagline does not
 * fit one line on any phone width, and letting it wrap on its own orphans
 * "UP." — two balanced centred lines read as deliberate instead.
 */
export const BRAND_TAGLINE = "KNOW WHO'S RUNNING.\nSHOW UP. RANK UP.";

/** Mark size in the horizontal lockup. */
export const MARK_SIZE = 46;

/** Space between the mark and the wordmark. */
export const MARK_GAP = 12;

/** Wordmark size. Matches the auth screen's title. */
export const WORDMARK_SIZE = 32;

/**
 * The artwork stays full-bleed at its natural proportions — shrinking it to
 * dodge the form wrecked the composition. Overlap is solved by moving the
 * lockup up and the form down, not by making the figure smaller.
 */
export const ARTWORK_TOP_RATIO = 0;
export const ARTWORK_HEIGHT_RATIO = 1;
