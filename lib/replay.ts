/**
 * Replay engine (T10) — historical daily stages replayed against a pin's
 * elevation. Pure math over recorded/fetched daily values.
 */

import type { ReplayEvent } from "@/lib/config";
import type { SeriesPoint } from "@/lib/gauges";

export function usgsDvUrl(site: string, startDT: string, endDT: string): string {
  // statCd=00003 pins the daily MEAN — some sites also publish min/max
  // statistics and the series order isn't guaranteed.
  return `https://waterservices.usgs.gov/nwis/dv/?sites=${site}&parameterCd=00065&statCd=00003&startDT=${startDT}&endDT=${endDT}&format=json`;
}

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
