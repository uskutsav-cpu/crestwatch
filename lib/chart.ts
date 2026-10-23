/**
 * StatChart layout (T09) — pure geometry for the observed/forecast stage
 * chart. Observed solid, forecast dashed, flood stage as a reference line.
 */

import type { SeriesPoint } from "@/lib/gauges";

export const CHART_W = 400;
export const CHART_H = 160;
const PAD_L = 46;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 20;

export interface ChartInput {
  observed: SeriesPoint[];
  forecast: SeriesPoint[];
  floodStageFt?: number | null;
}

export interface ChartLayout {
  obsPoints: string;
  fcstPoints: string;
  floodY: number | null;
  yTicks: Array<{ y: number; label: string }>;
  xLabels: Array<{ x: number; label: string }>;
  /** x of the observed→forecast handoff (the "now-ish" seam). */
  seamX: number | null;
}

export function chartLayout(input: ChartInput): ChartLayout | null {
  const all = [...input.observed, ...input.forecast];
  if (all.length < 2) return null;

  const times = all.map((p) => Date.parse(p.t));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  if (t1 <= t0) return null;

  const stages = all.map((p) => p.stageFt);
  let lo = Math.min(...stages);
  let hi = Math.max(...stages);
  const flood = input.floodStageFt ?? null;
  // Include the flood line when it's anywhere near the data.
  if (flood !== null && flood < hi + (hi - lo) && flood > lo - (hi - lo)) {
    lo = Math.min(lo, flood);
    hi = Math.max(hi, flood);
  }
  const span = Math.max(hi - lo, 2);
  lo -= span * 0.1;
  hi += span * 0.1;

  const x = (t: number) =>
    PAD_L + ((t - t0) / (t1 - t0)) * (CHART_W - PAD_L - PAD_R);
  const y = (s: number) =>
    PAD_T + ((hi - s) / (hi - lo)) * (CHART_H - PAD_T - PAD_B);

  const pts = (series: SeriesPoint[]) =>
    series.map((p) => `${x(Date.parse(p.t)).toFixed(1)},${y(p.stageFt).toFixed(1)}`).join(" ");

  // y ticks: 3 round numbers
  const yTicks: ChartLayout["yTicks"] = [];
  const step = Math.max(1, Math.round(span / 2));
  for (let s = Math.ceil(lo); s <= hi; s += step) {
    yTicks.push({ y: y(s), label: `${s} ft` });
    if (yTicks.length >= 4) break;
  }

  // x labels: start, middle, end as short dates
  const fmt = (t: number) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "numeric",
      day: "numeric",
    }).format(new Date(t));
  const xLabels = [t0, (t0 + t1) / 2, t1].map((t) => ({
    x: x(t),
    label: fmt(t),
  }));

  const lastObs = input.observed.at(-1);
  return {
    obsPoints: pts(input.observed),
    fcstPoints: pts(input.forecast),
    floodY: flood !== null && flood >= lo && flood <= hi ? y(flood) : null,
    yTicks,
    xLabels,
    seamX: lastObs ? x(Date.parse(lastObs.t)) : null,
  };
}
