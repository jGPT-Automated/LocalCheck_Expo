export const MAX_LOCALPLUS_COURTS = 5;

/** The viewed court is transient UI state; choosing it never changes primary. */
export function selectHomeCourt<T extends { id: string }>(
  plus: boolean, selectedId: string | null, saved: readonly T[], primary: T | null,
): T | null {
  if (!plus) return primary;
  return saved.find((court) => court.id === selectedId) ?? saved.find((court) => court.id === primary?.id) ?? saved[0] ?? primary;
}
