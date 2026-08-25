/**
 * Replay engine (T10) — historical daily stages replayed against a pin's
 * elevation. Pure math over recorded/fetched daily values.
 */

import type { ReplayEvent } from "@/lib/config";
import { parseIvSeries, type SeriesPoint } from "@/lib/gauges";

export function usgsDvUrl(site: string, startDT: string, endDT: string): string {
  return `https://waterservices.usgs.gov/nwis/dv/?sites=${site}&parameterCd=00065&startDT=${startDT}&endDT=${endDT}&format=json`;
}

/** DV JSON has the same series shape as IV. */
export const parseDvSeries = parseIvSeries;

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
    date: p.t.slice(0, 10),
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
