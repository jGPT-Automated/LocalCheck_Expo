import * as Location from "expo-location";
import { Platform } from "react-native";

export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Center of a US city ("Conroe" or "Conroe, TX"). On iPhone this uses Apple's
 * geocoder (no location permission needed); if that fails, or on web,
 * Mapbox's geocoder with the app's public token. Returns null when neither
 * finds it.
 */
export async function coordinateForPlace(query: string): Promise<Coordinate | null> {
  const text = query.trim();
  if (!text) return null;
  if (Platform.OS !== "web") {
    try {
      const [hit] = await Location.geocodeAsync(`${text}, United States`);
      if (hit) return { lat: hit.latitude, lng: hit.longitude };
    } catch {
      /* fall through to Mapbox */
    }
  }
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(text)}` +
      `&country=us&types=place,locality&limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const coords = json.features?.[0]?.geometry?.coordinates;
    return coords ? { lat: coords[1], lng: coords[0] } : null;
  } catch {
    return null;
  }
}

export interface StreetAddress {
  street: string;
  city: string;
  /** Two-letter state, e.g. "TX". */
  state: string;
  name: string;
}

/**
 * Street, city and state for a spot, from Mapbox's reverse geocoder. Used on
 * web, where expo-location can't reverse-geocode, and as a fallback on iPhone.
 */
export async function addressForCoordinate(lat: number, lng: number): Promise<StreetAddress | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}` +
      `&types=address,street,place&limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: {
        properties?: {
          name?: string;
          context?: {
            address?: { name?: string };
            street?: { name?: string };
            place?: { name?: string };
            locality?: { name?: string };
            region?: { region_code?: string };
          };
        };
      }[];
    };
    const props = json.features?.[0]?.properties;
    const ctx = props?.context;
    const state = (ctx?.region?.region_code ?? "").toUpperCase();
    const city = ctx?.place?.name ?? ctx?.locality?.name ?? "";
    const street = ctx?.address?.name ?? ctx?.street?.name ?? props?.name ?? "";
    if (!city || !/^[A-Z]{2}$/.test(state)) return null;
    return { street, city, state, name: props?.name ?? street };
  } catch {
    return null;
  }
}
