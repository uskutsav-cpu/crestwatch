/**
 * Geo pipeline (T02): address → coordinates (Census geocoder, D1) →
 * ground elevation in ft NAVD88 (USGS EPQS, D2). Pure adapters with an
 * injectable fetch so tests run on recorded fixtures, no network.
 */

import { fetchJson, type FetchJson } from "@/lib/net";

export interface GeoPoint {
  lat: number;
  lon: number;
  matchedAddress: string;
  /**
   * "address" = an exact street address (house-level, what the verdict
   * math wants). "place" = a town/ZIP centroid, which is NOT the
   * visitor's ground. Callers must say so out loud.
   */
  precision: "address" | "place";
}

export type GeocodeResult =
  | { ok: true; point: GeoPoint }
  | { ok: false; error: "NOT_FOUND" | "UPSTREAM" };

export function censusUrl(address: string): string {
  const u = new URL(
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
  );
  u.searchParams.set("address", address);
  u.searchParams.set("benchmark", "Public_AR_Current");
  u.searchParams.set("format", "json");
  return u.toString();
}

/* ------------------------------------------------------------------ */
/* Place / ZIP fallback (keyless)                                      */
/* ------------------------------------------------------------------ */

/** Two-letter code -> full state name, for matching the API's admin1. */
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

/**
 * Pull a state out of the query ("Vicksburg, MS" / "Vicksburg
 * Mississippi") so "Vicksburg" doesn't land in Michigan, and return the
 * bare place text to search on.
 */
export function splitStateHint(query: string): {
  place: string;
  state: string | null;
} {
  const trimmed = query.trim().replace(/\s+/g, " ");
  const abbr = /[,\s]+([A-Za-z]{2})\.?\s*(\d{5})?$/.exec(trimmed);
  if (abbr) {
    const code = abbr[1].toUpperCase();
    if (US_STATES[code]) {
      return {
        place: trimmed.slice(0, abbr.index).trim() || trimmed,
        state: US_STATES[code],
      };
    }
  }
  for (const name of Object.values(US_STATES)) {
    const re = new RegExp(`[,\\s]+${name}\\.?$`, "i");
    if (re.test(trimmed)) {
      return { place: trimmed.replace(re, "").trim() || trimmed, state: name };
    }
  }
  return { place: trimmed, state: null };
}

export function placeSearchUrl(place: string): string {
  const u = new URL("https://geocoding-api.open-meteo.com/v1/search");
  u.searchParams.set("name", place);
  u.searchParams.set("count", "10");
  u.searchParams.set("language", "en");
  u.searchParams.set("format", "json");
  return u.toString();
}

interface PlaceHit {
  name?: string;
  admin1?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Town / ZIP lookup for when the Census street matcher finds nothing —
 * the common case when someone types "Vicksburg, MS" or a ZIP. Returns a
 * "place" precision point so callers can be honest that it is a town
 * centre and not the visitor's own ground.
 */
export async function geocodePlace(
  query: string,
  fetchImpl: FetchJson = fetchJson,
): Promise<GeocodeResult> {
  const { place, state } = splitStateHint(query);
  if (place.length < 2) return { ok: false, error: "NOT_FOUND" };

  let data: unknown;
  try {
    data = await fetchImpl(placeSearchUrl(place));
  } catch {
    return { ok: false, error: "UPSTREAM" };
  }
  const hits = ((data as { results?: PlaceHit[] })?.results ?? []).filter(
    (r) =>
      typeof r.latitude === "number" &&
      typeof r.longitude === "number" &&
      Number.isFinite(r.latitude) &&
      Number.isFinite(r.longitude),
  );
  if (hits.length === 0) return { ok: false, error: "NOT_FOUND" };

  const us = hits.filter((r) => r.country_code === "US");
  const pool = us.length > 0 ? us : hits;
  const inState = state
    ? pool.filter((r) => (r.admin1 ?? "").toLowerCase() === state.toLowerCase())
    : [];
  // A named state that matches nothing is a miss, not a licence to jump
  // to another state's town of the same name.
  if (state && inState.length === 0) return { ok: false, error: "NOT_FOUND" };
  const best = (inState.length > 0 ? inState : pool)[0];

  const label = [best.name, best.admin1].filter(Boolean).join(", ");
  return {
    ok: true,
    point: {
      lat: best.latitude as number,
      lon: best.longitude as number,
      matchedAddress: label || query.trim(),
      precision: "place",
    },
  };
}

export async function geocodeAddress(
  address: string,
  fetchImpl: FetchJson = fetchJson,
): Promise<GeocodeResult> {
  let data: unknown;
  try {
    data = await fetchImpl(censusUrl(address));
  } catch {
    return { ok: false, error: "UPSTREAM" };
  }
  const matches = (
    data as {
      result?: {
        addressMatches?: Array<{
          matchedAddress?: string;
          coordinates?: { x?: number; y?: number };
        }>;
      };
    }
  )?.result?.addressMatches;
  const m = matches?.[0];
  const lon = m?.coordinates?.x;
  const lat = m?.coordinates?.y;
  if (
    !m ||
    typeof lon !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lon) ||
    !Number.isFinite(lat)
  ) {
    return { ok: false, error: "NOT_FOUND" };
  }
  return {
    ok: true,
    point: {
      lat,
      lon,
      matchedAddress: m.matchedAddress ?? address,
      precision: "address",
    },
  };
}

export function epqsUrl(lat: number, lon: number): string {
  const u = new URL("https://epqs.nationalmap.gov/v1/json");
  u.searchParams.set("x", String(lon));
  u.searchParams.set("y", String(lat));
  u.searchParams.set("units", "Feet");
  return u.toString();
}

/**
 * Ground elevation in ft NAVD88, or null when EPQS has no data here
 * (open water, out of coverage, or a sentinel value).
 */
export async function groundElevationFt(
  lat: number,
  lon: number,
  fetchImpl: FetchJson = fetchJson,
): Promise<number | null> {
  let data: unknown;
  try {
    data = await fetchImpl(epqsUrl(lat, lon));
  } catch {
    return null;
  }
  const value = (data as { value?: unknown })?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Sentinel/no-data guard: nothing in this district sits below -400 ft
  // or above 30,000 ft.
  if (value < -400 || value > 30_000) return null;
  return value;
}
