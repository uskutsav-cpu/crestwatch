/**
 * Which way is the river moving? Read straight off the observed series,
 * comparing the newest reading with one from a few hours back. A tenth
 * of a foot is noise; two tenths over the window is a real move.
 */

import type { SeriesPoint } from "@/lib/gauges";

export type Trend = "rising" | "falling" | "steady";

const WINDOW_MS = 6 * 3_600_000;
const THRESHOLD_FT = 0.2;

export function trendOf(observed: SeriesPoint[]): Trend | null {
  if (observed.length < 2) return null;
  const sorted = [...observed]
    .filter((p) => Number.isFinite(Date.parse(p.t)))
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  if (sorted.length < 2) return null;

  const last = sorted[sorted.length - 1];
  const lastMs = Date.parse(last.t);
  // The reading closest to six hours ago, or the oldest we have.
  let ref = sorted[0];
  for (const p of sorted) {
    if (Date.parse(p.t) <= lastMs - WINDOW_MS) ref = p;
    else break;
  }
  if (ref.t === last.t) ref = sorted[0];
  if (ref.t === last.t) return null;

  const delta = last.stageFt - ref.stageFt;
  if (delta > THRESHOLD_FT) return "rising";
  if (delta < -THRESHOLD_FT) return "falling";
  return "steady";
}
