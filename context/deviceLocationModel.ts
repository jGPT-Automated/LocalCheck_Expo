export type DeviceLocationStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";
export type DeviceCoordinate = { lat: number; lng: number };
export interface DeviceLocationResolution {
  coord: DeviceCoordinate | null;
  status: DeviceLocationStatus;
}

export function coordinateForLocationAction(
  status: DeviceLocationStatus,
  coordinate: DeviceCoordinate | null,
): DeviceCoordinate | null {
  return status === "granted" ? coordinate : null;
}
