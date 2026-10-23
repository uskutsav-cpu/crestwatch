/**
 * The Surveyor (T04, Appendix A2–A3) — the deterministic core.
 * Pure functions, no fetch, no clock: `now` is an input. Everything here
 * is covered by the golden file tests/fixtures/surveyor_cases.yaml.
 *
 * water-surface elevation = gauge zero (alt_va) + stage
 * margin = pin elevation − forecast peak water elevation
 */

import { BANDS, FCST_STALE_H, OBS_STALE_H } from "@/lib/config";
import { datumLooksSane, type FloodCategories, type SeriesPoint } from "@/lib/gauges";

export type Tier = "FULL" | "CATEGORY" | "ALERT_ONLY";
export type Band = "LIKELY" | "BORDERLINE" | "UNLIKELY";
export type CategoryLevel = "action" | "minor" | "moderate" | "major" | "none";

/** The slice of a GaugeBundle the Surveyor needs (GaugeBundle satisfies it). */
export interface SurveyGauge {
  observed: SeriesPoint[];
  forecast: SeriesPoint[];
  forecastIssued: string | null;
  categories: FloodCategories;
  gaugeZeroFt: number | null;
  gaugeDatum: string | null;
}

export interface Staleness {
  /** Hours since the newest observed point; null when none exist. */
  observedH: number | null;
  /** Hours since the forecast was issued; null when unknown. */
  forecastH: number | null;
  staleObserved: boolean;
  staleForecast: boolean;
}

export interface FullVerdict {
  tier: "FULL";
  band: Band;
  /** Pin elevation − forecast peak water elevation, ft (unrounded). */
  marginFt: number;
  peak: { waterElevFt: number; stageFt: number; t: string };
  /** First future rising crossing of the pin's elevation, or null. */
  crossing: { t: string; hoursFromNow: number } | null;
  /** The forecast says the river already peaked and is coming down. */
  pastPeak: boolean;
  /** Water is at or above the pin right now. */
  currentlyAbove: boolean;
  currentWaterElevFt: number | null;
  stale: Staleness;
}

export interface CategoryVerdict {
  tier: "CATEGORY";
  peakStageFt: number;
  peakT: string;
  /** Peak stage minus flood (minor) stage; null when unpublished. */
  aboveFloodFt: number | null;
  category: CategoryLevel | null;
  stale: Staleness;
}

export interface AlertOnlyVerdict {
  tier: "ALERT_ONLY";
}

export type Verdict = FullVerdict | CategoryVerdict | AlertOnlyVerdict;

export interface SurveyInput {
  pinElevationFt: number;
  gauge: SurveyGauge | null;
  /** ISO timestamp — injected so the engine is a pure function. */
  now: string;
}

/* ---------------------------------------------------------------- */

const HOUR_MS = 3_600_000;

function sortSeries(series: SeriesPoint[]): SeriesPoint[] {
  const seen = new Set<string>();
  return [...series]
    .filter((p) => {
      // An unparseable timestamp is unusable data, not a "past" point —
      // letting it through would empty the future window and read as a
      // confident recession. Drop it and let the tier ladder degrade.
      if (!Number.isFinite(Date.parse(p.t))) return false;
      if (seen.has(p.t)) return false;
      seen.add(p.t);
      return true;
    })
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

function staleness(
  observed: SeriesPoint[],
  forecastIssued: string | null,
  nowMs: number,
): Staleness {
  const lastObs = observed.at(-1);
  const rawObservedH = lastObs
    ? (nowMs - Date.parse(lastObs.t)) / HOUR_MS
    : null;
  const rawForecastH =
    forecastIssued !== null
      ? (nowMs - Date.parse(forecastIssued)) / HOUR_MS
      : null;
  // Unparseable timestamps must read as stale, never as fresh.
  const observedH =
    rawObservedH !== null && Number.isFinite(rawObservedH) ? rawObservedH : null;
  const forecastH =
    rawForecastH !== null && Number.isFinite(rawForecastH) ? rawForecastH : null;
  return {
    observedH,
    forecastH,
    staleObserved: observedH === null || observedH > OBS_STALE_H,
    staleForecast: forecastH === null || forecastH > FCST_STALE_H,
  };
}

export function bandFor(marginFt: number): Band {
  if (marginFt <= BANDS.likely) return "LIKELY";
  if (marginFt <= BANDS.borderline) return "BORDERLINE";
  return "UNLIKELY";
}

export function categoryFor(
  peakStageFt: number,
  categories: FloodCategories,
): CategoryLevel | null {
  const levels: Array<Exclude<CategoryLevel, "none">> = [
    "major",
    "moderate",
    "minor",
    "action",
  ];
  let anyPublished = false;
  for (const level of levels) {
    const threshold = categories[level];
    if (typeof threshold === "number") {
      anyPublished = true;
      if (peakStageFt >= threshold) return level;
    }
  }
  // "Below flood stage" is only knowable when flood stage (minor) or the
  // lower action stage is published. With only moderate/major published,
  // a crest under them could still be minor flooding: unknown, not calm.
  void anyPublished;
  return typeof categories.minor === "number" ||
    typeof categories.action === "number"
    ? "none"
    : null;
}

/**
 * First rising crossing of `targetElev` after `nowMs`, linearly
 * interpolated. The last observed point is prepended so a crossing in
 * the gap between "now" and the first forecast point isn't missed.
 */
export function risingCrossing(
  points: Array<{ tMs: number; elev: number }>,
  targetElev: number,
  nowMs: number,
): { tMs: number } | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.elev <= a.elev) continue; // rising segments only
    if (a.elev >= targetElev || b.elev < targetElev) continue;
    const frac = (targetElev - a.elev) / (b.elev - a.elev);
    const tMs = a.tMs + frac * (b.tMs - a.tMs);
    if (tMs > nowMs) return { tMs };
  }
  return null;
}

export function survey(input: SurveyInput): Verdict {
  const { gauge, pinElevationFt } = input;
  const nowMs = Date.parse(input.now);

  const forecast = gauge ? sortSeries(gauge.forecast) : [];
  if (!gauge || forecast.length < 2) {
    return { tier: "ALERT_ONLY" };
  }

  const observed = sortSeries(gauge.observed);
  const stale = staleness(observed, gauge.forecastIssued, nowMs);

  // The peak that matters is the highest water from here on. Two rules,
  // both learned the hard way:
  //  - a bygone FIRST crest must not hide a second crest still coming, so
  //    future points are what we scan (falling back to the whole series
  //    when the forecast is entirely behind us); and
  //  - water already HERE counts, so the last observation joins the
  //    candidates. Without it a receding river that is already over the
  //    house scores against its low future tail and reads as "stays dry".
  const future = forecast.filter((p) => Date.parse(p.t) > nowMs);
  const peakPool = future.length > 0 ? future : forecast;
  const lastObs = observed.at(-1) ?? null;
  const peakCandidates = lastObs ? [...peakPool, lastObs] : peakPool;
  let peakStage = peakCandidates[0];
  for (const p of peakCandidates) {
    if (p.stageFt > peakStage.stageFt) peakStage = p;
  }

  // Tier gate: gauge zero present AND believable.
  const zero = gauge.gaugeZeroFt;
  const datumSane =
    zero !== null &&
    (lastObs === null || datumLooksSane(zero, lastObs.stageFt, pinElevationFt));

  if (zero === null || !datumSane) {
    return {
      tier: "CATEGORY",
      peakStageFt: peakStage.stageFt,
      peakT: peakStage.t,
      aboveFloodFt:
        typeof gauge.categories.minor === "number"
          ? peakStage.stageFt - gauge.categories.minor
          : null,
      category: categoryFor(peakStage.stageFt, gauge.categories),
      stale,
    };
  }

  // FULL tier — the real elevation math.
  const peakWaterElev = zero + peakStage.stageFt;
  const marginFt = pinElevationFt - peakWaterElev;

  const currentWaterElevFt = lastObs === null ? null : zero + lastObs.stageFt;
  const currentlyAbove =
    currentWaterElevFt !== null && currentWaterElevFt >= pinElevationFt;

  // Crossing path: anchor at the most recent KNOWN water level at or
  // before now, then run forward through the future forecast. The anchor
  // is whichever of the last observation and the last already-past
  // forecast point is later — using a stale observation alone would
  // stretch one straight line across the whole gap and interpolate the
  // crossing into the past, where it gets discarded.
  const lastPastFcst = forecast.filter((p) => Date.parse(p.t) <= nowMs).at(-1) ?? null;
  let anchor = lastObs;
  if (
    lastPastFcst &&
    (!anchor || Date.parse(lastPastFcst.t) > Date.parse(anchor.t))
  ) {
    anchor = lastPastFcst;
  }
  const path: Array<{ tMs: number; elev: number }> = [];
  if (anchor) {
    path.push({ tMs: Date.parse(anchor.t), elev: zero + anchor.stageFt });
  }
  for (const p of future) {
    path.push({ tMs: Date.parse(p.t), elev: zero + p.stageFt });
  }
  const cross = risingCrossing(path, pinElevationFt, nowMs);
  const crossing =
    cross === null
      ? null
      : {
          t: new Date(cross.tMs).toISOString(),
          hoursFromNow: Math.round((cross.tMs - nowMs) / HOUR_MS),
        };

  // Past peak = the FORECAST shows nothing higher ahead than the water
  // already coming. Deliberately forecast-only: a stale observation must
  // never be what claims a recession, or a gauge that went quiet during a
  // crest makes a rising forecast read as "the river is coming down."
  const futureRises = future.some(
    (p, i) => i > 0 && p.stageFt > future[0].stageFt,
  );
  const pastPeak = future.length === 0 || !futureRises;

  return {
    tier: "FULL",
    band: bandFor(marginFt),
    marginFt,
    peak: { waterElevFt: peakWaterElev, stageFt: peakStage.stageFt, t: peakStage.t },
    crossing,
    pastPeak,
    currentlyAbove,
    currentWaterElevFt,
    stale,
  };
}
