/**
 * Server-side composition (T05): geo → gauges → Surveyor → alerts, with
 * TTL caching so the federal APIs see one fetch per gauge per window no
 * matter how many visitors are watching.
 */

import { GAUGE_RADIUS_MI } from "@/lib/config";
import {
  extractLocality,
  geocodeAddress,
  geocodePlace,
  geocodeStreetFallback,
  groundElevationFt,
  looksLikeStreetAddress,
  splitStateHint,
} from "@/lib/geo";
import {
  pickForecastGauge,
  defaultFetchers,
  type Fetchers,
  type GaugeBundle,
} from "@/lib/gauges";
import { fetchFloodAlerts, type FloodAlert } from "@/lib/alerts";
import { survey, type Verdict } from "@/lib/surveyor";
import { cached } from "@/lib/cache";
import type { Pin } from "@/lib/pins";

const GAUGE_TTL_MS = 15 * 60 * 1000; // observed data cadence
const GEO_TTL_MS = 24 * 60 * 60 * 1000; // immutable per location
const ALERTS_TTL_MS = 10 * 60 * 1000;

export interface GaugeSummary {
  lid: string;
  name: string;
  usgsId: string | null;
  distanceMi: number;
  gaugeZeroFt: number | null;
  gaugeDatum: string | null;
  categories: GaugeBundle["categories"];
  historicCrests: GaugeBundle["historicCrests"];
  observed: GaugeBundle["observed"];
  forecast: GaugeBundle["forecast"];
  forecastIssued: string | null;
}

export type LookupResult =
  | {
      ok: true;
      matchedAddress: string;
      lat: number;
      lon: number;
      elevationFt: number;
      /**
       * "address" = an exact street match. "place" = a town or ZIP
       * centroid — the elevation is the middle of town, NOT the
       * visitor's own ground, and the UI must say so.
       */
      precision: "address" | "place";
      gauge: { lid: string; name: string; distanceMi: number } | null;
    }
  | { ok: false; error: "NOT_FOUND" | "NO_ELEVATION" | "UPSTREAM" };

export async function lookupAddress(
  address: string,
  fetchers: Fetchers = defaultFetchers,
): Promise<LookupResult> {
  const key = address.trim().toLowerCase();
  const geo = await cached(
    `geo:${key}`,
    GEO_TTL_MS,
    async () => {
      // Three tiers, best precision first. House-level is what the verdict
      // math deserves, but never dead-end a real person over a house
      // number some federal file happens to be missing.
      //  1. Census — authoritative US street addresses.
      const exact = await geocodeAddress(address, fetchers.json);
      if (exact.ok || exact.error === "UPSTREAM") return exact;

      //  2. A second street-level opinion for addresses Census lacks —
      //     only for things that really are street addresses, so a town
      //     or ZIP can never come back wearing house-level precision.
      if (looksLikeStreetAddress(address)) {
        const street = await geocodeStreetFallback(address, fetchers.json);
        if (street.ok) return street;
      }

      //  3. The town inside the address ("1234 Main St, Yazoo City, MS"
      //     -> "Yazoo City"), then the query itself for bare towns/ZIPs.
      const { state } = splitStateHint(address);
      const locality = extractLocality(address);
      if (locality) {
        const asTown = await geocodePlace(
          state ? `${locality}, ${state}` : locality,
          fetchers.json,
        );
        if (asTown.ok) return asTown;
      }
      return geocodePlace(address, fetchers.json);
    },
    // A NOT_FOUND is a stable answer worth caching; an UPSTREAM blip is
    // not — caching it would blank this address for a day.
    (g) => g.ok || g.error === "NOT_FOUND",
  );
  if (!geo.ok) return { ok: false, error: geo.error };

  const { lat, lon, matchedAddress } = geo.point;
  const elevationFt = await cached(
    `elev:${lat.toFixed(5)},${lon.toFixed(5)}`,
    GEO_TTL_MS,
    () => groundElevationFt(lat, lon, fetchers.json),
    // null covers both "no elevation data here" and "EPQS was down";
    // re-asking is cheap and far better than pinning an outage for a day.
    (e) => e !== null,
  );
  if (elevationFt === null) return { ok: false, error: "NO_ELEVATION" };

  const gauge = await gaugeFor(lat, lon, fetchers);
  return {
    ok: true,
    matchedAddress,
    lat,
    lon,
    elevationFt,
    precision: geo.point.precision,
    gauge: gauge
      ? { lid: gauge.lid, name: gauge.name, distanceMi: gauge.distanceMi }
      : null,
  };
}

async function gaugeFor(
  lat: number,
  lon: number,
  fetchers: Fetchers,
): Promise<GaugeBundle | null> {
  // Key by coarse location: pins a street apart share a gauge.
  const key = `gauge:${lat.toFixed(2)},${lon.toFixed(2)}`;
  return cached(key, GAUGE_TTL_MS, () =>
    pickForecastGauge(lat, lon, GAUGE_RADIUS_MI, fetchers),
  );
}

export interface PinWatch {
  pinId: string;
  verdict: Verdict;
  gauge: GaugeSummary | null;
  alerts: FloodAlert[];
  /** False when the NWS alert service couldn't be reached (not "no alerts"). */
  alertsOk: boolean;
}

export async function watchPins(
  pins: Pin[],
  fetchers: Fetchers = defaultFetchers,
  now: string = new Date().toISOString(),
): Promise<PinWatch[]> {
  return Promise.all(
    pins.map(async (pin): Promise<PinWatch> => {
      const [gauge, alertsResult] = await Promise.all([
        gaugeFor(pin.lat, pin.lon, fetchers),
        cached(
          `alerts:${pin.lat.toFixed(2)},${pin.lon.toFixed(2)}`,
          ALERTS_TTL_MS,
          () => fetchFloodAlerts(pin.lat, pin.lon, fetchers.json),
          // null means the alert service was unreachable — never cache
          // that, or one blip suppresses alerts for ten minutes.
          (v) => v !== null,
        ),
      ]);
      const verdict = survey({
        pinElevationFt: pin.elevationFt,
        gauge,
        now,
      });
      return {
        pinId: pin.id,
        verdict,
        alertsOk: alertsResult !== null,
        gauge: gauge
          ? {
              lid: gauge.lid,
              name: gauge.name,
              usgsId: gauge.usgsId,
              distanceMi: gauge.distanceMi,
              gaugeZeroFt: gauge.gaugeZeroFt,
              gaugeDatum: gauge.gaugeDatum,
              categories: gauge.categories,
              historicCrests: gauge.historicCrests,
              observed: gauge.observed,
              forecast: gauge.forecast,
              forecastIssued: gauge.forecastIssued,
            }
          : null,
        alerts: alertsResult ?? [],
      };
    }),
  );
}
