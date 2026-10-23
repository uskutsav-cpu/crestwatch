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
   * math wants). "place" = a town/ZIP centroid or a point on a street
   * whose house wasn't found, which is NOT the visitor's ground. Callers
   * must say so out loud.
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
 * NOT take the street path: a house-level hit there would silently drop
 * the "approximate spot" warning.
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
  // Needed to tell a real house (address.house_number) from a road.
  u.searchParams.set("addressdetails", "1");
  return u.toString();
}

export interface NominatimHit {
  lat?: string;
  lon?: string;
  display_name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  /** Nominatim's own scale: 26-27 streets, 30 houses, buildings, shops. */
  place_rank?: number;
  address?: { house_number?: string; road?: string };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * House-level only when the hit really is a house or building that
 * carries a house number, and (when the query starts with one) the SAME
 * number. A road centroid ("North Main Street, Yazoo City") or another
 * house on the street is a point on the street, not the visitor's ground.
 *
 * "Building" includes a shop or office in its own building: the live hit
 * for 1400 Washington St, Vicksburg is a gift shop's outline (class
 * "shop", place_rank 30) carrying house_number 1400.
 */
export function isHouseLevelHit(hit: NominatimHit, query: string): boolean {
  const number = hit.address?.house_number?.trim();
  if (!number || hit.class === "highway") return false;
  const houseOrBuilding =
    hit.class === "building" ||
    hit.type === "house" ||
    hit.addresstype === "house" ||
    hit.addresstype === "building" ||
    (typeof hit.place_rank === "number" && hit.place_rank >= 30);
  if (!houseOrBuilding) return false;
  const asked = /^\s*(\d+[a-z]?)\b/i.exec(query)?.[1];
  if (!asked) return true;
  // OSM can list several numbers on one building: "1400;1402", "1400-1402".
  return number.split(/[;,-]/).some((n) => norm(n) === norm(asked));
}

/**
 * Second street-level opinion for addresses the Census database has never
 * heard of — its TIGER file stores address RANGES, so real houses go
 * missing. Keyless, but a volunteer-run service: we only reach it after
 * Census misses, the result is cached for a day, and any failure just
 * falls through to the town lookup. If it ever blocks us the app quietly
 * degrades to town-level answers instead of breaking.
 *
 * Often it finds only the street. That comes back as precision "place",
 * an approximate spot just like a town center, so the warning shows.
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
  const hit = Array.isArray(data) ? (data[0] as NominatimHit | undefined) : undefined;
  const lat = parseFloat(hit?.lat ?? "");
  const lon = parseFloat(hit?.lon ?? "");
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const houseLevel = isHouseLevelHit(hit, query);
  const a = hit.address as Record<string, string | undefined> | undefined;
  const town = a?.city ?? a?.town ?? a?.village ?? a?.hamlet;
  // A house hit reads as its address ("1400 Washington Street, Vicksburg"),
  // not as whatever shop sits there. Otherwise trim the long OSM display
  // name to something a person recognises.
  // OSM can list several numbers on one building ("1400;1402"); show the
  // one the person asked for. A street point reads as "road, town", never
  // as a business that happens to sit on it.
  const asked = /^\s*(\d+[a-z]?)\b/i.exec(query)?.[1];
  const shownNumber = asked ?? a?.house_number?.split(/[;,]/)[0]?.trim();
  const label =
    houseLevel && shownNumber && a?.road
      ? [`${shownNumber} ${a.road}`, town].filter(Boolean).join(", ")
      : a?.road
        ? [a.road, town].filter(Boolean).join(", ")
        : (hit.display_name ?? query).split(",").slice(0, 3).join(",").trim();
  return {
    ok: true,
    point: {
      lat,
      lon,
      matchedAddress: label,
      precision: houseLevel ? "address" : "place",
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

/** EPQS's own gateway gives up at about 29 s, so waiting longer is pointless. */
export const EPQS_ATTEMPT_MS = 29_000;
/** Whole-call budget across retries. Fits inside the lookup route's 60 s. */
export const EPQS_BUDGET_MS = 40_000;
export const EPQS_MAX_ATTEMPTS = 4;

export interface ElevationOptions {
  budgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ground elevation in ft NAVD88, or null when EPQS has no data here
 * (open water, out of coverage, or a sentinel value).
 */
export async function groundElevationFt(
  lat: number,
  lon: number,
  fetchImpl: FetchJson = fetchJson,
  {
    budgetMs = EPQS_BUDGET_MS,
    sleep = realSleep,
    now = Date.now,
  }: ElevationOptions = {},
): Promise<number | null> {
  // EPQS fails two ways under load: an instant 500, or a slow tile that
  // takes 15-29 s. Both usually clear a moment later, so keep asking
  // (with a short pause) until the budget runs out. One bad answer must
  // not cost the visitor their whole verdict.
  const start = now();
  const left = () => budgetMs - (now() - start);
  let data: unknown;
  let got = false;
  for (let attempt = 0; attempt < EPQS_MAX_ATTEMPTS && !got; attempt++) {
    if (left() < 2_000) break;
    try {
      data = await fetchImpl(epqsUrl(lat, lon), {
        timeoutMs: Math.min(EPQS_ATTEMPT_MS, left()),
      });
      got = true;
    } catch {
      const pause = Math.min(1_000 * (attempt + 1), left() - 2_000);
      if (attempt < EPQS_MAX_ATTEMPTS - 1 && pause > 0) await sleep(pause);
    }
  }
  if (!got) return null;
  const value = (data as { value?: unknown })?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Sentinel/no-data guard: nothing in this district sits below -400 ft
  // or above 30,000 ft.
  if (value < -400 || value > 30_000) return null;
  return value;
}
