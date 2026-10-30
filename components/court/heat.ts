import { Colors } from "@/constants/colors";
import { heatStep } from "@/lib/heatModel";

/** Fill for each heat step (lib/heatModel), quiet → busiest. */
export const HEAT_FILL = [Colors.heat0, Colors.heat1, Colors.heat2, Colors.heat3, Colors.heat4, Colors.accent] as const;

/** The fill and the number's ink for a count of people going. */
export function heatColors(count: number): { fill: string; ink: string } {
  const step = heatStep(count);
  return {
    fill: HEAT_FILL[step],
    ink: step === 5 ? Colors.background : step >= 3 ? Colors.text : Colors.textSecondary,
  };
}
