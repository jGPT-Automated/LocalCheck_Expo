export interface CourtDiscoveryOrigin {
  lat: number;
  lng: number;
}

export interface CourtDiscoveryBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

/**
 * Explore expands from a neighborhood-sized box to a metro-sized box. Each
 * database query is geographically constrained before its row limit is
 * applied, so client-side distance sorting never starts from arbitrary rows
 * across an entire market.
 */
export const MARKET_DISCOVERY_RADII_DEG = [0.15, 0.5, 2.5] as const;

export function courtDiscoveryBounds(
  origin: CourtDiscoveryOrigin,
  latitudeRadiusDeg: number,
): CourtDiscoveryBounds {
  const latitude = Math.max(-90, Math.min(90, origin.lat));
  const longitude = Math.max(-180, Math.min(180, origin.lng));
  const longitudeScale = Math.max(
    0.2,
    Math.abs(Math.cos((latitude * Math.PI) / 180)),
  );
  const longitudeRadiusDeg = latitudeRadiusDeg / longitudeScale;

  return {
    swLat: Math.max(-90, latitude - latitudeRadiusDeg),
    swLng: Math.max(-180, longitude - longitudeRadiusDeg),
    neLat: Math.min(90, latitude + latitudeRadiusDeg),
    neLng: Math.min(180, longitude + longitudeRadiusDeg),
  };
}
