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
