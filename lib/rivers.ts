/**
 * "Right now on our rivers" (package rivers): the district's main river
 * gauges, read straight from NOAA's NWPS before anyone types an address.
 * NWPS only (gauge detail + stageflow, through the same URL builders and
 * parsers as lib/gauges.ts). No USGS, no geocoding, no house-level math:
 * each river's latest reading, which way it's moving, its flood stage and
 * the forecast high. A river whose data fails is left out, never faked.
 */

import { cached } from "@/lib/cache";
import {
  defaultFetchers,
  nwpsDetailUrl,
  nwpsStageflowUrl,
  parseCategories,
  parseStageflowSeries,
  type Fetchers,
  type SeriesPoint,
} from "@/lib/gauges";
import { categoryFor, type CategoryLevel } from "@/lib/surveyor";
import { trendOf, type Trend } from "@/lib/trend";

export interface RiverGauge {
  /** NWS location id (NWPS). */
  lid: string;
  /** Display name. Ours, not upstream's: upstream names drift. */
  name: string;
}

/** Checked live Oct 2026: each returns observed stage in ft and all four flood categories. */
export const RIVER_GAUGES: readonly RiverGauge[] = [
  { lid: "VCKM6", name: "Mississippi River at Vicksburg" },
  { lid: "GEEM6", name: "Mississippi River near Greenville" },
  { lid: "YZOM6", name: "Yazoo River at Yazoo City" },
  { lid: "JACM6", name: "Pearl River at Jackson" },
];

export interface RiverNow {
  lid: string;
  name: string;
  /** Latest observed stage, ft on the gauge. */
  stageFt: number;
  /** ISO time (UTC) of that reading. */
  observedAt: string;
  /** From the observed series (lib/trend.ts); null when it can't tell. */
  trend: Trend | null;
  /** Official flood stage (the NWS "minor" category); null when unpublished. */
  floodStageFt: number | null;
  /** Flood category of the LATEST observed stage (lib/surveyor categoryFor). */
  category: CategoryLevel | null;
  /** Highest forecast point still ahead of the check time; null when none. */
  forecastHigh: { stageFt: number; t: string } | null;
  /** Flood category of forecastHigh; null when there's no forecastHigh or no flood stage to judge it by. */
  forecastCategory: CategoryLevel | null;
}

export type RiversAnswer =
  | { ok: true; checkedAt: string; rivers: RiverNow[] }
  | { ok: false; error: "UPSTREAM" };

/** A complete answer: the observed-data cadence. */
export const RIVERS_TTL_MS = 15 * 60 * 1000;
/** An answer missing a river: short, so a river that comes back shows up soon. */
export const RIVERS_PARTIAL_TTL_MS = 2 * 60 * 1000;

type DetailArg = Parameters<typeof parseCategories>[0];
type SeriesArg = Parameters<typeof parseStageflowSeries>[0];

const asObject = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

const isoOf = (t: string) => new Date(Date.parse(t)).toISOString();

/** Oldest to newest, one point per instant. */
function tidy(series: SeriesPoint[]): SeriesPoint[] {
  const byMs = new Map<number, SeriesPoint>();
  for (const p of series) {
    const ms = Date.parse(p.t);
    if (Number.isFinite(ms) && !byMs.has(ms)) byMs.set(ms, p);
  }
  return [...byMs.entries()].sort(([a], [b]) => a - b).map(([, p]) => p);
}

/**
 * One river from its raw NWPS detail and stageflow bodies. Pure: `nowMs`
 * decides which forecast points are still ahead. Null when there is no
 * usable observed reading (missing, or not in feet), so the river is
 * left out rather than shown with a made-up number.
 */
export function shapeRiver(
  gauge: RiverGauge,
  detailRaw: unknown,
  stageflowRaw: unknown,
  nowMs: number,
): RiverNow | null {
  const stageflow = asObject(stageflowRaw);
  const observed = tidy(parseStageflowSeries(asObject(stageflow.observed) as SeriesArg));
  const latest = observed.at(-1);
  if (!latest) return null;

  const categories = parseCategories(asObject(detailRaw) as DetailArg);

  let high: SeriesPoint | null = null;
  for (const p of parseStageflowSeries(asObject(stageflow.forecast) as SeriesArg)) {
    if (Date.parse(p.t) <= nowMs) continue;
    if (high === null || p.stageFt > high.stageFt) high = p;
  }

  return {
    lid: gauge.lid,
    name: gauge.name,
    stageFt: latest.stageFt,
    observedAt: isoOf(latest.t),
    trend: trendOf(observed),
    floodStageFt: categories.minor ?? null,
    category: categoryFor(latest.stageFt, categories),
    forecastHigh: high ? { stageFt: high.stageFt, t: isoOf(high.t) } : null,
    forecastCategory: high ? categoryFor(high.stageFt, categories) : null,
  };
}

/** Detail + stageflow for one river. Any failure leaves it out (null). */
export async function fetchRiver(
  gauge: RiverGauge,
  fetchers: Fetchers,
  nowMs: number,
): Promise<RiverNow | null> {
  try {
    const [detail, stageflow] = await Promise.all([
      fetchers.json(nwpsDetailUrl(gauge.lid)),
      fetchers.json(nwpsStageflowUrl(gauge.lid)),
    ]);
    return shapeRiver(gauge, detail, stageflow, nowMs);
  } catch {
    return null;
  }
}

/** Every river, uncached. ok:false only when no river answered. */
export async function fetchRivers(
  fetchers: Fetchers = defaultFetchers,
  now: () => number = Date.now,
): Promise<RiversAnswer> {
  const nowMs = now();
  const rivers = (
    await Promise.all(RIVER_GAUGES.map((g) => fetchRiver(g, fetchers, nowMs)))
  ).filter((r): r is RiverNow => r !== null);
  if (rivers.length === 0) return { ok: false, error: "UPSTREAM" };
  return { ok: true, checkedAt: new Date(nowMs).toISOString(), rivers };
}

const isComplete = (a: RiversAnswer) =>
  a.ok && a.rivers.length === RIVER_GAUGES.length;

/**
 * The cached answer GET /api/rivers serves. A complete answer is kept 15
 * minutes. One missing a river is kept 2 minutes: long enough that a
 * gauge that's down doesn't cost every visitor a slow timeout, short
 * enough that it shows up again soon after it's back. A failure
 * (ok:false) is never kept.
 */
export function riversNow(
  fetchers: Fetchers = defaultFetchers,
  now: () => number = Date.now,
): Promise<RiversAnswer> {
  return cached(
    "rivers:complete",
    RIVERS_TTL_MS,
    () =>
      cached(
        "rivers:any",
        RIVERS_PARTIAL_TTL_MS,
        () => fetchRivers(fetchers, now),
        (a) => a.ok,
      ),
    isComplete,
  );
}
