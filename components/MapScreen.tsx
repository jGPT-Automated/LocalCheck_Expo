import Constants, { ExecutionEnvironment } from "expo-constants";
import React from "react";

import { MapListFallback } from "@/components/MapListFallback";
import type { MapScreen as NativeMapScreenType } from "@/components/NativeMapScreen";

type MapScreenProps = React.ComponentProps<typeof NativeMapScreenType>;

// Expo Go has no Mapbox native code, and @rnmapbox/maps throws as soon as it
// is imported there. Load the real map only in real builds, so PR previews
// still open in Expo Go (the Explore tab shows the nearby-court list instead).
const runningInExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function ExpoGoMap(_props: MapScreenProps) {
  return <MapListFallback message="MAP NOT AVAILABLE IN EXPO GO — SHOWING NEARBY COURTS" />;
}

export const MapScreen: React.ComponentType<MapScreenProps> = runningInExpoGo
  ? ExpoGoMap
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("./NativeMapScreen") as { MapScreen: React.ComponentType<MapScreenProps> }).MapScreen;
