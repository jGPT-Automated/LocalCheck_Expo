/**
 * The Settings > Location row: what iPhone currently allows for LocalCheck.
 * "Ask next time" (not decided yet) reads as OFF: nothing is shared until the
 * player says yes.
 */
export type LocationPermissionLabel = "OFF" | "WHILE USING" | "ALWAYS";

export function locationPermissionLabel(input: {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}): LocationPermissionLabel {
  if (input.backgroundGranted) return "ALWAYS";
  if (input.foregroundGranted) return "WHILE USING";
  return "OFF";
}
