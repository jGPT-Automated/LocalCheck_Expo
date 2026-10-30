/**
 * One heat ramp for every "how many are going" surface (Schedule grid, Today
 * bars, the court's Week): an empty hour, four browns, then the accent.
 * Returned as a step so callers pick the colour token and the ink on top.
 */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

export function heatStep(count: number): HeatStep {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  return 5;
}
