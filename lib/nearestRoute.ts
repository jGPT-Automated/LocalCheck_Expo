// Shared "find nearest court" path helpers for the native and web maps. A
// straight connector renders immediately; it upgrades to the real Mapbox
// walking geometry when the court is close enough for one to make sense.

export type LngLat = [number, number];

// Past this the "nearest" court is in another region: frame both points but
// skip the Directions request, which would fail or return an absurd route.
export const ROUTE_MAX_KM = 60;

export interface NearestRoute {
  from: LngLat;
  to: LngLat;
  path: GeoJSON.LineString;
  distanceKm: number;
}

export function kmBetween(a: LngLat, b: LngLat): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function straightPath(from: LngLat, to: LngLat): GeoJSON.LineString {
  return { type: "LineString", coordinates: [from, to] };
}

export function boundsFor(points: LngLat[]): { ne: LngLat; sw: LngLat } {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)],
    sw: [Math.min(...lngs), Math.min(...lats)],
  };
}

export async function fetchWalkingPath(
  from: LngLat,
  to: LngLat,
  token: string,
): Promise<GeoJSON.LineString> {
  if (!token) return straightPath(from, to);
  try {
    const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}` +
        `?geometries=geojson&overview=full&access_token=${token}`,
    );
    if (!res.ok) return straightPath(from, to);
    const json = await res.json();
    const geometry = json?.routes?.[0]?.geometry;
    if (geometry?.type === "LineString" && Array.isArray(geometry.coordinates)) {
      return geometry as GeoJSON.LineString;
    }
  } catch {
    // fall through to the straight connector
  }
  return straightPath(from, to);
}
