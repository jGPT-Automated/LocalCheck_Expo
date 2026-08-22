export function remainingLaunchFloor(
  startedAt: number,
  now: number,
  minimumDuration: number,
): number {
  return Math.max(0, minimumDuration - Math.max(0, now - startedAt));
}
