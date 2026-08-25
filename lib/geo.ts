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
    point: { lat, lon, matchedAddress: m.matchedAddress ?? address },
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
