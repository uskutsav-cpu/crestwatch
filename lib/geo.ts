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

const STREET_TYPES =
  "st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|hwy|highway|way|ct|court|pl|place|cir|circle|pkwy|parkway|ter|terrace|trl|trail|loop|run|path|row|sq|square";

/**
 * Reduce a full street address to the town inside it, so a house number
 * the Census database has never heard of still lands somewhere useful.
 * "1234 Main Street, Yazoo City, MS" -> "Yazoo City".
 */
export function extractLocality(query: string): string | null {
  const { place, state } = splitStateHint(query);
  const parts = place
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  // With commas the town is the last component before the state.
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    return last.length >= 2 ? last : null;
  }

  const only = parts[0] ?? "";
  if (!only) return null;

  // No commas: drop everything up to and including the street type.
  const re = new RegExp(`^.*?\\b(?:${STREET_TYPES})\\b\\.?\\s+`, "i");
  const afterStreet = only.replace(re, "").trim();
  if (afterStreet && afterStreet !== only) return afterStreet;

  // A bare "123 Something" with no street type and no comma gives us
  // nothing trustworthy to search on.
  if (/^\d/.test(only)) return null;
  return state && only.length >= 2 ? only : null;
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

/**
 * True when the query really is a street address — a house number
 * followed by a name, or a street-type word. Bare towns and ZIPs must
 * NOT take the street path: a match there would be labelled house-level
 * precision and silently drop the "town center" warning.
 */
export function looksLikeStreetAddress(query: string): boolean {
  const q = query.trim();
  const hasStreetType = new RegExp(`\\b(?:${STREET_TYPES})\\b\\.?`, "i").test(q);
  const hasHouseNumber = /^\d+[a-z]?\s+\S+/i.test(q);
  return hasStreetType || hasHouseNumber;
}

export function nominatimUrl(query: string): string {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", query);
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "us");
  u.searchParams.set("addressdetails", "0");
  return u.toString();
}

/**
 * Second street-level opinion for addresses the Census database has never
 * heard of — its TIGER file stores address RANGES, so real houses go
 * missing. Keyless, but a volunteer-run service: we only reach it after
 * Census misses, the result is cached for a day, and any failure just
 * falls through to the town lookup. If it ever blocks us the app quietly
 * degrades to town-level answers instead of breaking.
 */
export async function geocodeStreetFallback(
  query: string,
  fetchImpl: FetchJson = fetchJson,
): Promise<GeocodeResult> {
  let data: unknown;
  try {
    data = await fetchImpl(nominatimUrl(query), { timeoutMs: 8_000 });
  } catch {
    return { ok: false, error: "UPSTREAM" };
  }
  const hit = (
    data as Array<{ lat?: string; lon?: string; display_name?: string }>
  )?.[0];
  const lat = parseFloat(hit?.lat ?? "");
  const lon = parseFloat(hit?.lon ?? "");
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: "NOT_FOUND" };
  }
  // Trim the long OSM display name to something a person recognises.
  const label = (hit.display_name ?? query)
    .split(",")
    .slice(0, 3)
    .join(",")
    .trim();
  return {
    ok: true,
    point: { lat, lon, matchedAddress: label, precision: "address" },
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
  // EPQS routinely takes 3-9 seconds, so it needs a far longer leash than
  // the other federal APIs — and one retry, because a single slow tile
  // otherwise costs the visitor their whole verdict.
  let data: unknown;
  let lastErr = true;
  for (let attempt = 0; attempt < 2 && lastErr; attempt++) {
    try {
      data = await fetchImpl(epqsUrl(lat, lon), { timeoutMs: 25_000 });
      lastErr = false;
    } catch {
      lastErr = true;
    }
  }
  if (lastErr) return null;
  const value = (data as { value?: unknown })?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Sentinel/no-data guard: nothing in this district sits below -400 ft
  // or above 30,000 ft.
  if (value < -400 || value > 30_000) return null;
  return value;
}
