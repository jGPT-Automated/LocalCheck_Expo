import { Linking, Platform } from "react-native";

import type { Court } from "@/constants/data";

export async function openCourtInMaps(court: Court): Promise<void> {
  const label = encodeURIComponent(court.name);
  const coordinates = `${court.latitude},${court.longitude}`;
  const url = Platform.select({
    ios: `maps://?q=${label}&ll=${coordinates}`,
    android: `geo:${coordinates}?q=${coordinates}(${label})`,
    default: `https://www.google.com/maps/search/?api=1&query=${coordinates}`,
  });
  if (url) await Linking.openURL(url);
}
