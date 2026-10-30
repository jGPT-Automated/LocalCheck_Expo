/**
 * The count line on a time-slot card ("Today · 6 PM"). The hour you are in
 * counts the people on court right now as well as the ones who planned to come,
 * so checking in never leaves the card saying nobody is there. Pure, so it is
 * tested.
 */
export function slotMetaLabel({
  current,
  here,
  planned,
}: {
  /** The slot is the hour happening now. */
  current: boolean;
  /** People checked in at this court right now. */
  here: number;
  /** People who planned to come: named, private and in games. */
  planned: number;
}): string {
  if (current && here > 0) {
    return planned > 0 ? `${here} on court · ${planned} planning to go` : `${here} on court`;
  }
  return `${planned} planning to go`;
}
