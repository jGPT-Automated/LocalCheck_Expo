const US_STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

export function normalizeState(region: string | null | undefined): string {
  const trimmed = region?.trim() ?? "";
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return US_STATE_CODES[trimmed.toLowerCase()] ?? "";
}

export function courtDetailsReady({
  latitude,
  longitude,
  address,
  city,
  stateCode,
}: {
  latitude: number | null;
  longitude: number | null;
  address: string;
  city: string;
  stateCode: string;
}): boolean {
  return latitude != null
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && longitude != null
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180
    && address.trim().length >= 2
    && city.trim().length >= 2
    && /^[A-Za-z]{2}$/.test(stateCode.trim());
}

/** Keep card labels source-derived, compact, and stable across platforms. */
export function compactCourtLabel(officialName: string, street: string): string {
  const source = (officialName.trim() || street.trim()).replace(/\s+/g, " ");
  if (source.length <= 32) return source;
  const words = source.split(" ");
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > 32) break;
    result = next;
  }
  return result || source.slice(0, 32).trim();
}

const STREET_TYPE_SUFFIX =
  /\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|ter|terrace|cir|circle|pkwy|parkway|hwy|highway|trl|trail|sq|square|loop|path|walk|row|aly|alley|expressway|expy)\.?$/i;

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * The auto-filled court name. A real POI name from the geocoder wins; a plain
 * street address becomes "<Street> Courts" — "123 Silver Sky St" → "Silver Sky
 * Courts", not the raw address. The field stays user-editable either way.
 */
export function courtNameFromLocation(
  placeName: string | null | undefined,
  street: string,
): string {
  const name = (placeName ?? "").trim().replace(/\s+/g, " ");
  const road = (street ?? "").trim().replace(/\s+/g, " ");
  const nameIsJustTheAddress =
    !name ||
    /^\d/.test(name) ||
    name.toLowerCase() === road.toLowerCase();
  if (!nameIsJustTheAddress) return compactCourtLabel(name, road);

  let base = road
    .replace(/^\d+[a-z]?\s+/i, "") // leading house number ("123 ", "12b ")
    .replace(/^(?:[NSEW]|NE|NW|SE|SW)\s+/i, "") // leading directional
    .replace(STREET_TYPE_SUFFIX, "") // trailing "St" / "Ave" / …
    .trim();
  if (!base) base = road.replace(/^\d+[a-z]?\s+/i, "").trim();
  if (!base) return "Community Court";
  return compactCourtLabel(`${titleCase(base)} Courts`, road);
}
