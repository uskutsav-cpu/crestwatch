/**
 * Replay engine (T10) — historical daily stages replayed against a pin's
 * elevation. Pure math over the recorded daily values in lib/replay-data.
 * Client-safe: no server modules, no network.
 */

import type { ReplayEvent } from "@/lib/config";
import type { SeriesPoint } from "@/lib/gauges";

/**
 * DV daily points. dateTime arrives offset-less ("2020-02-01T00:00:00.000"
 * in gauge-local time) — the calendar DATE is taken straight from the
 * string so a UTC+ server can't shift every day by one. Picks the 00065
 * series explicitly rather than trusting series order.
 */
export function parseDvSeries(data: unknown): SeriesPoint[] {
  const seriesList =
    (
      data as {
        value?: {
          timeSeries?: Array<{
            variable?: { variableCode?: Array<{ value?: string }> };
            values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
          }>;
        };
      }
    )?.value?.timeSeries ?? [];
  const ts =
    seriesList.find(
      (s) => s.variable?.variableCode?.[0]?.value === "00065",
    ) ?? seriesList[0];
  const raw = ts?.values?.[0]?.value ?? [];
  const out: SeriesPoint[] = [];
  for (const p of raw) {
    const v = parseFloat(p.value ?? "");
    const date = p.dateTime?.slice(0, 10);
    if (Number.isFinite(v) && v > -100 && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      out.push({ t: date, stageFt: v });
    }
  }
  return out;
}

export interface ReplayDay {
  date: string; // YYYY-MM-DD
  waterElevFt: number;
}

export function toElevationSeries(
  series: SeriesPoint[],
  event: ReplayEvent,
): ReplayDay[] {
  const offset =
    event.toElevation.mode === "addGaugeZero"
      ? event.toElevation.gaugeZeroFt
      : 0;
  return series.map((p) => ({
    date: p.t.slice(0, 10), // already a plain date from parseDvSeries
    waterElevFt: p.stageFt + offset,
  }));
}

export interface ReplayStats {
  crest: ReplayDay;
  daysAbove: number;
  firstAbove: string | null;
  lastAbove: string | null;
}

export function replayStats(
  days: ReplayDay[],
  pinElevationFt: number,
): ReplayStats | null {
  if (days.length === 0) return null;
  let crest = days[0];
  const above: ReplayDay[] = [];
  for (const d of days) {
    if (d.waterElevFt > crest.waterElevFt) crest = d;
    if (d.waterElevFt >= pinElevationFt) above.push(d);
  }
  return {
    crest,
    daysAbove: above.length,
    firstAbove: above[0]?.date ?? null,
    lastAbove: above.at(-1)?.date ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Distance: a recorded river level only speaks for places near it     */
/* ------------------------------------------------------------------ */

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle miles. A local copy so the client never loads lib/gauges. */
export function haversineMi(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function eventDistanceMi(
  event: Pick<ReplayEvent, "gaugeLat" | "gaugeLon">,
  place: { lat: number; lon: number },
): number {
  return haversineMi(place.lat, place.lon, event.gaugeLat, event.gaugeLon);
}

export function isNearEvent(
  event: Pick<ReplayEvent, "gaugeLat" | "gaugeLon" | "maxMi">,
  place: { lat: number; lon: number },
): boolean {
  return eventDistanceMi(event, place) <= event.maxMi;
}

/**
 * The closest event whose gauge is within its own radius of the place, or
 * null when none is. Events that share a gauge tie, and the tie goes to
 * `preferId` (the flood already on screen) so switching between two
 * Jackson places doesn't jump from 2022 back to 2020.
 */
export function nearestEventFor<
  E extends Pick<ReplayEvent, "id" | "gaugeLat" | "gaugeLon" | "maxMi">,
>(events: readonly E[], place: { lat: number; lon: number }, preferId?: string): E | null {
  let best: E | null = null;
  let bestMi = Infinity;
  for (const e of events) {
    const mi = eventDistanceMi(e, place);
    if (mi > e.maxMi) continue;
    const tie = Math.abs(mi - bestMi) < 0.01;
    if (mi < bestMi - 0.01 || (tie && e.id === preferId)) {
      best = e;
      bestMi = Math.min(mi, bestMi);
    }
  }
  return best;
}

/** Index of the highest day, the stop for "jump to the crest". */
export function crestIndex(days: readonly ReplayDay[]): number {
  let best = 0;
  for (let i = 1; i < days.length; i++) {
    if (days[i].waterElevFt > days[best].waterElevFt) best = i;
  }
  return best;
}
