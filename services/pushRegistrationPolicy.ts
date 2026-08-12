export type PushPermissionStatus = "undetermined" | "granted" | "denied";
export type PushRegistrationAction = "prompt" | "register" | "none";

export function getPushRegistrationAction(input: {
  preferenceEnabled: boolean;
  permissionStatus: PushPermissionStatus;
}): PushRegistrationAction {
  if (input.permissionStatus === "undetermined") return "prompt";
  if (input.preferenceEnabled && input.permissionStatus === "granted") return "register";
  return "none";
}
