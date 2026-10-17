/**
 * The auto check-in circle as a GeoJSON ring, for the court Info map (a
 * Mapbox static image draws it in orange with a soft glow). Pure, tested.
 */
const EARTH_M = 6_371_000;

export function circleRing(lat: number, lng: number, radiusM: number, points = 40): Array<[number, number]> {
  const ring: Array<[number, number]> = [];
  const latRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusM * Math.cos(angle)) / EARTH_M;
    const dLng = (radiusM * Math.sin(angle)) / (EARTH_M * Math.cos(latRad));
    ring.push([
      Math.round((lng + (dLng * 180) / Math.PI) * 1e6) / 1e6,
      Math.round((lat + (dLat * 180) / Math.PI) * 1e6) / 1e6,
    ]);
  }
  return ring;
}

/** The static-image overlay: a wide faint stroke (glow) under a crisp one. */
export function geofenceOverlay(lat: number, lng: number, radiusM: number, color: string): string {
  const coordinates = [circleRing(lat, lng, radiusM)];
  const feature = (properties: Record<string, string | number>) => ({
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates },
  });
  const collection = {
    type: "FeatureCollection",
    features: [
      feature({ stroke: color, "stroke-width": 9, "stroke-opacity": 0.22, fill: color, "fill-opacity": 0 }),
      feature({ stroke: color, "stroke-width": 2.5, "stroke-opacity": 1, fill: color, "fill-opacity": 0.1 }),
    ],
  };
  return `geojson(${encodeURIComponent(JSON.stringify(collection))})`;
}
