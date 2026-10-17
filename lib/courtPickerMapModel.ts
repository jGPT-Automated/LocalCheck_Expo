/**
 * Web Mercator math for onboarding's court picker map (Mapbox static images
 * use 512px tiles). Pure functions so the pin positions are tested.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapViewport {
  center: LatLng;
  zoom: number;
}

const TILE = 512;
const MAX_LAT = 85.05;
/** The whole continental US, before we know where anyone is. */
export const DEFAULT_VIEW: MapViewport = { center: { lat: 39.5, lng: -98.35 }, zoom: 2.4 };
/** One point on its own (just you, or one court): about a neighborhood. */
export const SINGLE_POINT_ZOOM = 13;
const MIN_ZOOM = 2;
const MAX_ZOOM = 15;

function worldXY({ lat, lng }: LatLng): { x: number; y: number } {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

function fromWorld(x: number, y: number): LatLng {
  return {
    lng: x * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
  };
}

/**
 * The view that fits every point with room around the edges (pins and the
 * selected label stay inside). No points: the default US view.
 */
export function mapView(points: LatLng[], width: number, height: number): MapViewport {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0 || width <= 0 || height <= 0) return DEFAULT_VIEW;
  const xy = valid.map(worldXY);
  const minX = Math.min(...xy.map((p) => p.x));
  const maxX = Math.max(...xy.map((p) => p.x));
  const minY = Math.min(...xy.map((p) => p.y));
  const maxY = Math.max(...xy.map((p) => p.y));
  const center = fromWorld((minX + maxX) / 2, (minY + maxY) / 2);
  const dx = maxX - minX;
  const dy = maxY - minY;
  if (dx < 1e-9 && dy < 1e-9) return { center, zoom: SINGLE_POINT_ZOOM };
  const fitX = dx > 0 ? Math.log2((width * 0.7) / (dx * TILE)) : MAX_ZOOM;
  const fitY = dy > 0 ? Math.log2((height * 0.6) / (dy * TILE)) : MAX_ZOOM;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(fitX, fitY)));
  return { center, zoom };
}

/** Where a point lands, in view pixels from the top-left. */
export function projectToView(point: LatLng, view: MapViewport, width: number, height: number): { x: number; y: number } {
  const scale = TILE * 2 ** view.zoom;
  const p = worldXY(point);
  const c = worldXY(view.center);
  return { x: width / 2 + (p.x - c.x) * scale, y: height / 2 + (p.y - c.y) * scale };
}
