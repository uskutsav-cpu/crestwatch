/**
 * "Your flood number" (package floodnumber). Pure math, no fetch, no clock.
 *
 * The flood number is the river stage, read on the pin's own gauge, at
 * which the water surface reaches the pin's ground. Same arithmetic as the
 * Surveyor (lib/surveyor.ts), turned around:
 *
 *   water surface = gauge zero + stage
 *   flood number  = pin elevation - gauge zero
 *
 * People hear crest numbers on the news ("the river will crest at 48 ft").
 * This makes that number personal. FULL tier only: it needs a gauge zero
 * the Surveyor trusts (floodNumberInputFor enforces that). CrestWatch does
 * not model levees or floodwalls, and every flood number says so.
 *
 * Rounding, so nothing reads more precise than the data:
 *  - the flood number: nearest half foot with "about" (whole feet for a
 *    rough number from an approximate town or street point);
 *  - gauge readings, flood stage, record crest and what-if stages: one
 *    decimal, as the gauge reports them and as the rest of the app shows;
 *  - gaps and depths: whole feet, "less than a foot" under 1.
 * Every "dry / close / wet" decision is made on the raw numbers with the
 * Surveyor's own expressions and BANDS, so the what-if readout at the
 * forecast crest always agrees with the verdict sentence.
 */

import { BANDS } from "@/lib/config";
import { copy } from "@/lib/copy";
import type { FloodCategories } from "@/lib/gauges";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";

/** What-if slider step, ft. */
export const WHAT_IF_STEP_FT = 0.5;
/** Room the slider leaves below the lowest and above the highest mark, ft. */
export const WHAT_IF_PAD_FT = 5;

/**
 * A historic crest. Structurally a lib/gauges HistoricCrest plus the NWPS
 * `olddatum` flag. Only a crest with `oldDatum === false` counts: a crest
 * read from an older zero mark isn't on today's scale, and a crest whose
 * datum is unknown can't be trusted to be. (HistoricCrest[] is assignable
 * here; until parseHistoricCrests carries `oldDatum`, no record shows.)
 */
export interface FloodNumberCrest {
  stageFt: number;
  time: string;
  oldDatum?: boolean;
}

export interface FloodNumberInput {
  pinName: string;
  /** Pin.approximate: a town or street point, not a house. */
  approximate?: boolean;
  pinElevationFt: number;
  /** Gauge zero (alt_va). Null renders nothing. */
  gaugeZeroFt: number | null;
  /** "Mississippi River at Vicksburg". */
  gaugeName: string;
  /** Latest observed stage, ft; null when there is no reading. */
  currentStageFt: number | null;
  /** The latest reading is old (verdict.stale.staleObserved): never say "now". */
  currentStale?: boolean;
  /** verdict.peak.stageFt: where the what-if slider starts. */
  forecastPeakStageFt: number;
  categories: FloodCategories;
  historicCrests: readonly FloodNumberCrest[];
}

export interface WhatIfRange {
  min: number;
  max: number;
  step: number;
  /** The forecast crest, clamped into the range. Not snapped to the step. */
  start: number;
}

export type WhatIfMarkKind = "yours" | "floodStage" | "record" | "forecast";

export interface WhatIfMark {
  kind: WhatIfMarkKind;
  stageFt: number;
  /** "flood stage" */
  label: string;
  /** "43.0 ft" ("about 46.5 ft" for your number) */
  value: string;
  /** 0..1 along the slider. */
  frac: number;
}

export interface RecordCrest {
  stageFt: number;
  time: string;
  /** "May 2011"; null when the date doesn't parse. */
  when: string | null;
  /** Some crests were left out (older or unknown zero mark). */
  partial: boolean;
}

export interface FloodNumberView {
  /** Raw flood number, ft. */
  floodNumberFt: number;
  /** The rounded number the reader sees. */
  shownFt: number;
  /** Approximate pin: "rough flood number" plus copy.approximateTag. */
  rough: boolean;
  /** "Your flood number" | "Your rough flood number" */
  title: string;
  /** "about 46.5 ft" */
  value: string;
  /** "on the Mississippi River gauge at Vicksburg." */
  onGauge: string;
  /** "Your flood number: about 46.5 ft on the Mississippi River gauge at Vicksburg." */
  headline: string;
  /** "When the river reads about 46.5 ft on that gauge, water reaches the ground at Levee St." */
  explainer: string;
  /** Only the lines that are true and available: reading, flood stage, record. */
  context: string[];
  /** "CrestWatch doesn't count levees or floodwalls." */
  levees: string;
  range: WhatIfRange;
  /** Slider ticks and legend, lowest stage first. */
  marks: WhatIfMark[];
}

/* ---------------------------------------------------------------- */
/* Numbers and words                                                 */
/* ---------------------------------------------------------------- */

const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/** Nearest multiple of `step` (0.5 = nearest half foot). Never -0. */
export function roundTo(ft: number, step: number): number {
  return Math.round(ft / step) * step + 0;
}

/** 46 -> "46", 46.5 -> "46.5". For numbers already rounded by roundTo. */
export function fmtRounded(ft: number): string {
  return Number.isInteger(ft) ? String(ft) : ft.toFixed(1);
}

/** A stage on the gauge, one decimal like the rest of the app: "15.0". */
export function fmtStage(ft: number): string {
  const s = ft.toFixed(1);
  return s === "-0.0" ? "0.0" : s;
}

/** "about 31 ft" | "less than a foot" (whole feet, never "about 0"). */
function aboutFeet(ft: number): string {
  return ft < 1
    ? copy.floodNumberUnderFoot
    : copy.floodNumberAboutFeet(Math.round(ft));
}

/** Display step: half feet for a house, whole feet for a rough number. */
const stepFor = (approximate: boolean | undefined) => (approximate ? 1 : 0.5);

/**
 * "Mississippi River at Vicksburg" -> "the Mississippi River gauge at
 * Vicksburg". A name with no "at/near/above/below" becomes "the {name}
 * gauge"; a blank name, "the nearest gauge".
 */
export function gaugePhrase(gaugeName: string): string {
  const name = (gaugeName ?? "").trim();
  if (!name) return copy.verdictGaugeFallback;
  const m = name.match(/^(.+?)\s+(at|near|above|below)\s+(.+)$/i);
  return m
    ? copy.floodNumberGauge(m[1], `${m[2].toLowerCase()} ${m[3]}`)
    : copy.floodNumberGaugeBare(name);
}

/** "May 2011". Crest dates are midnight UTC days, so read them in UTC. */
function monthYear(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}

/* ---------------------------------------------------------------- */
/* The math                                                          */
/* ---------------------------------------------------------------- */

/**
 * The stage at which water reaches the pin's ground, ft (unrounded).
 * Null when either input is missing, or when it would be below the
 * gauge's zero mark (the ground sits under the gauge's 0 ft: no number a
 * family would ever hear on the news).
 */
export function floodNumberFt(
  pinElevationFt: number,
  gaugeZeroFt: number | null,
): number | null {
  if (!finite(pinElevationFt) || !finite(gaugeZeroFt)) return null;
  const ft = pinElevationFt - gaugeZeroFt;
  return ft < 0 ? null : ft;
}

/**
 * Highest historic crest on today's zero mark (oldDatum === false), or
 * null. `partial` says some crests were left out, so the sentence can say
 * "measured from today's zero mark" instead of claiming the all-time
 * record.
 */
export function recordCrest(
  crests: readonly FloodNumberCrest[] | null | undefined,
): RecordCrest | null {
  let best: FloodNumberCrest | null = null;
  let partial = false;
  for (const c of crests ?? []) {
    if (!c || !finite(c.stageFt)) continue;
    if (c.oldDatum !== false) {
      partial = true;
      continue;
    }
    if (best === null || c.stageFt > best.stageFt) best = c;
  }
  if (best === null) return null;
  return {
    stageFt: best.stageFt,
    time: best.time,
    when: monthYear(best.time),
    partial,
  };
}

/**
 * The context lines, only those that are true and available:
 *  1. the latest reading against the number (or "already above");
 *  2. the number against flood stage (categories.minor);
 *  3. the highest crest on record on today's zero mark.
 */
export function contextLines(input: FloodNumberInput): string[] {
  const fn = floodNumberFt(input.pinElevationFt, input.gaugeZeroFt);
  if (fn === null || !finite(input.gaugeZeroFt)) return [];
  const zero = input.gaugeZeroFt;
  const step = stepFor(input.approximate);
  const lines: string[] = [];

  const cur = finite(input.currentStageFt) ? input.currentStageFt : null;
  if (cur !== null) {
    // Same test as the Surveyor's currentlyAbove.
    if (zero + cur >= input.pinElevationFt) {
      lines.push(
        input.currentStale
          ? copy.floodNumberLastReadingAbove
          : copy.floodNumberAlreadyAbove,
      );
    } else {
      const gap = aboutFeet(fn - cur);
      lines.push(
        input.currentStale
          ? copy.floodNumberLastReading(fmtStage(cur), gap)
          : copy.floodNumberNow(fmtStage(cur), gap),
      );
    }
  }

  const fs = input.categories?.minor;
  if (finite(fs)) {
    if (zero + fs > input.pinElevationFt) {
      // Water at flood stage would already be over this ground.
      lines.push(copy.floodNumberBelowFloodStage(fmtStage(fs)));
    } else {
      // From the number the reader sees, so 46.5 vs 43.0 reads "3.5".
      const diff = roundTo(roundTo(fn, step) - fs, step);
      lines.push(
        diff <= 0
          ? copy.floodNumberAtFloodStage(fmtStage(fs))
          : copy.floodNumberAboveFloodStage(fmtRounded(diff), fmtStage(fs)),
      );
    }
  }

  const rec = recordCrest(input.historicCrests);
  if (rec) {
    lines.push(copy.floodNumberRecord(fmtStage(rec.stageFt), rec.when, rec.partial));
  }
  return lines;
}

/**
 * Slider range. From max(0, floor(lowest - 5)) to ceil(highest + 5), where
 * lowest is the least of the reading, flood stage, the flood number and
 * the forecast crest, and highest the greatest of the record crest, the
 * flood number, the forecast crest, the reading and flood stage. (The
 * forecast crest joins the low side and the reading and flood stage the
 * high side so every mark and the start always fit.)
 */
export function whatIfRange(input: FloodNumberInput): WhatIfRange | null {
  const fn = floodNumberFt(input.pinElevationFt, input.gaugeZeroFt);
  if (fn === null) return null;
  const cur = finite(input.currentStageFt) ? input.currentStageFt : null;
  const minor = input.categories?.minor;
  const fs = finite(minor) ? minor : null;
  const peak = finite(input.forecastPeakStageFt) ? input.forecastPeakStageFt : null;
  const rec = recordCrest(input.historicCrests)?.stageFt ?? null;

  const lows = [cur, fs, fn, peak].filter(finite);
  const highs = [rec, fn, peak, cur, fs].filter(finite);
  const min = Math.max(0, Math.floor(Math.min(...lows) - WHAT_IF_PAD_FT));
  const max = Math.ceil(Math.max(...highs) + WHAT_IF_PAD_FT);
  const start = clamp(peak ?? cur ?? fn, min, max);
  return { min, max, step: WHAT_IF_STEP_FT, start };
}

/** A slider value, snapped to the step and kept inside the range. */
export function snapWhatIf(stageFt: number, range: WhatIfRange): number {
  return clamp(roundTo(stageFt, range.step), range.min, range.max);
}

/**
 * What the water would do at `stageFt` on the gauge. Bands match the
 * verdict (BANDS): over the ground -> depth; within BANDS.likely -> likely
 * reaches the ground; within BANDS.borderline -> too close to call; only
 * beyond that does a place "stay dry". A what-if readout is never an
 * all-clear the verdict wouldn't give.
 */
export function whatIfReadout(
  stageFt: number,
  input: Pick<FloodNumberInput, "pinName" | "approximate" | "pinElevationFt" | "gaugeZeroFt">,
): string {
  const zero = finite(input.gaugeZeroFt) ? input.gaugeZeroFt : 0;
  const stage = fmtStage(stageFt);
  const place = input.approximate
    ? copy.floodNumberApproxPlace(input.pinName)
    : input.pinName;
  // The Surveyor's margin, same expression: pin - (zero + stage).
  const margin = input.pinElevationFt - (zero + stageFt);
  if (margin <= 0) return copy.floodNumberIfWet(stage, aboutFeet(-margin), place);
  if (margin <= BANDS.likely) return copy.floodNumberIfAtGround(stage, place);
  if (margin <= BANDS.borderline) {
    const gap = margin < 1 ? copy.floodNumberCloseUnderFoot : copy.floodNumberAboutFeet(Math.round(margin));
    return copy.floodNumberIfClose(stage, gap, place);
  }
  return copy.floodNumberIfDry(stage, place, Math.round(margin));
}

/** Ticks and legend for the slider, lowest stage first. */
export function whatIfMarks(input: FloodNumberInput, range: WhatIfRange): WhatIfMark[] {
  const fn = floodNumberFt(input.pinElevationFt, input.gaugeZeroFt);
  if (fn === null) return [];
  const span = range.max - range.min;
  const frac = (s: number) => (span > 0 ? clamp((s - range.min) / span, 0, 1) : 0);
  const marks: WhatIfMark[] = [];
  const add = (kind: WhatIfMarkKind, stageFt: number, label: string, value: string) =>
    marks.push({ kind, stageFt, label, value, frac: frac(stageFt) });

  add(
    "yours",
    fn,
    copy.floodNumberMarkYours,
    copy.floodNumberValue(fmtRounded(roundTo(fn, stepFor(input.approximate)))),
  );
  const fs = input.categories?.minor;
  if (finite(fs)) add("floodStage", fs, copy.floodNumberMarkFloodStage, copy.floodNumberFeet(fmtStage(fs)));
  const rec = recordCrest(input.historicCrests);
  if (rec) add("record", rec.stageFt, copy.floodNumberMarkRecord, copy.floodNumberFeet(fmtStage(rec.stageFt)));
  if (finite(input.forecastPeakStageFt)) {
    add(
      "forecast",
      input.forecastPeakStageFt,
      copy.floodNumberMarkForecast,
      copy.floodNumberFeet(fmtStage(input.forecastPeakStageFt)),
    );
  }
  return marks.sort((a, b) => a.stageFt - b.stageFt);
}

/** Everything the card shows, or null when there's no flood number to show. */
export function floodNumberView(input: FloodNumberInput): FloodNumberView | null {
  const fn = floodNumberFt(input.pinElevationFt, input.gaugeZeroFt);
  const range = whatIfRange(input);
  if (fn === null || range === null) return null;
  const rough = input.approximate === true;
  const shownFt = roundTo(fn, stepFor(rough));
  const shown = fmtRounded(shownFt);
  const title = rough ? copy.floodNumberTitleRough : copy.floodNumberTitle;
  const value = copy.floodNumberValue(shown);
  const gauge = gaugePhrase(input.gaugeName);
  return {
    floodNumberFt: fn,
    shownFt,
    rough,
    title,
    value,
    onGauge: copy.floodNumberOnGauge(gauge),
    headline: copy.floodNumberHeadline(title, value, gauge),
    explainer: rough
      ? copy.floodNumberExplainRough(shown, input.pinName)
      : copy.floodNumberExplain(shown, input.pinName),
    context: contextLines(input),
    levees: copy.floodNumberLevees,
    range,
    marks: whatIfMarks(input, range),
  };
}

/**
 * One short line for a Places card: "floods at about 46.5 ft" (rough:
 * "floods at roughly 47 ft"). Takes the raw flood number. Null when there
 * is none.
 */
export function floodNumberShort(
  ft: number | null,
  approximate = false,
): string | null {
  if (!finite(ft) || ft < 0) return null;
  const shown = fmtRounded(roundTo(ft, stepFor(approximate)));
  return approximate ? copy.floodNumberShortRough(shown) : copy.floodNumberShort(shown);
}

/** Newest observed stage (ties keep the first, like the Surveyor), or null. */
function latestStage(observed: ReadonlyArray<{ t: string; stageFt: number }>): number | null {
  let best: number | null = null;
  let bestMs = -Infinity;
  for (const p of observed ?? []) {
    const ms = Date.parse(p.t);
    if (Number.isFinite(ms) && finite(p.stageFt) && ms > bestMs) {
      bestMs = ms;
      best = p.stageFt;
    }
  }
  return best;
}

/**
 * The FloodNumber props for one place, or null when it must not show: not
 * FULL tier (no trusted gauge zero), no gauge, or no flood number.
 */
export function floodNumberInputFor(
  pin: Pick<Pin, "name" | "elevationFt" | "approximate">,
  watch: Pick<PinWatch, "verdict" | "gauge">,
): FloodNumberInput | null {
  const { verdict, gauge } = watch;
  if (verdict.tier !== "FULL" || !gauge || gauge.gaugeZeroFt === null) return null;
  if (floodNumberFt(pin.elevationFt, gauge.gaugeZeroFt) === null) return null;
  return {
    pinName: pin.name,
    approximate: pin.approximate === true,
    pinElevationFt: pin.elevationFt,
    gaugeZeroFt: gauge.gaugeZeroFt,
    gaugeName: gauge.name,
    currentStageFt: latestStage(gauge.observed),
    currentStale: verdict.stale.staleObserved,
    forecastPeakStageFt: verdict.peak.stageFt,
    categories: gauge.categories,
    historicCrests: gauge.historicCrests,
  };
}

/**
 * The slider's two actions, apart from React so they can be tested:
 * slide snaps and clamps the raw input value, stores it and tells the
 * parent; back returns to the forecast (null).
 */
export function whatIfHandlers(
  range: WhatIfRange,
  setChosen: (stageFt: number | null) => void,
  onWhatIf?: (stageFt: number | null) => void,
): { slide: (raw: string) => void; back: () => void } {
  return {
    slide(raw) {
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) return;
      const s = snapWhatIf(v, range);
      setChosen(s);
      onWhatIf?.(s);
    },
    back() {
      setChosen(null);
      onWhatIf?.(null);
    },
  };
}
