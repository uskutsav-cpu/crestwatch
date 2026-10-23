"use client";

/**
 * The last good answer, kept for when the signal drops.
 *
 * After a check of the visitor's OWN saved places succeeds, a copy of the
 * answer goes into this browser's localStorage, and nowhere else. If a
 * later check fails before anything is on screen, the copy is shown
 * instead ("This is the answer from {time}"), but only when the places
 * are exactly the ones it was made for and it is under 12 hours old.
 *
 * Never for a shared or example link: those aren't this visitor's places,
 * so nothing about them is kept (lib/use-watch.ts enforces that).
 * "Delete all my data" and any change to the places clear it
 * (lib/pin-store.ts).
 *
 * Every storage access is wrapped: a browser that blocks storage simply
 * never gets a saved answer, and nothing breaks.
 */

import { FCST_STALE_H, OBS_STALE_H } from "@/lib/config";
import type { Pin } from "@/lib/pins";
import type { Staleness, Verdict } from "@/lib/surveyor";
import type { PinWatch } from "@/lib/watch-service";

export const LAST_ANSWER_KEY = "crestwatch.lastAnswer";
/** A saved answer this old or older is never shown. */
export const LAST_ANSWER_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const HOUR_MS = 3_600_000;

/** What sits in localStorage. */
interface StoredAnswer {
  pinsKey: string;
  watches: PinWatch[];
  /** The server's clock when it made these verdicts. */
  now: string | null;
  /** This browser's clock when the answer arrived (ms). */
  savedAt: number;
}

/** A saved answer, ready for the screens. */
export interface LastAnswer {
  /**
   * The saved verdicts, unchanged except for the clock: staleness and
   * "hours from now" are counted to this moment, not to when it was saved.
   */
  watches: PinWatch[];
  /** The verdicts' clock moved forward by the answer's age (ISO). */
  now: string;
  /** When the answer arrived (ms). Screens show it as "the answer from". */
  savedAt: number;
}

/**
 * Names one exact set of places: ids, spots and ground heights, in order.
 * Names are left out on purpose; they don't change any verdict.
 */
export function pinsKeyFor(pins: readonly Pin[]): string {
  return JSON.stringify(pins.map((p) => [p.id, p.lat, p.lon, p.elevationFt]));
}

/** Forget the saved answer. Never throws. */
export function clearLastAnswer(): void {
  try {
    localStorage.removeItem(LAST_ANSWER_KEY);
  } catch {
    // storage blocked: there is nothing we could have saved either
  }
}

/**
 * Keep this answer for `pins`. True only when the write went through.
 * Callers must only pass the visitor's own saved places.
 */
export function saveLastAnswer(
  pins: readonly Pin[],
  watches: PinWatch[],
  now: string | null,
  savedAt: number = Date.now(),
): boolean {
  if (pins.length === 0 || watches.length === 0) return false;
  const stored: StoredAnswer = { pinsKey: pinsKeyFor(pins), watches, now, savedAt };
  try {
    localStorage.setItem(LAST_ANSWER_KEY, JSON.stringify(stored));
    return true;
  } catch {
    // Blocked or full. An older copy must not stand in for this answer.
    clearLastAnswer();
    return false;
  }
}

/**
 * The saved answer for exactly these places, if it is under 12 hours old.
 * Anything else (no copy, other places, too old, a clock that went
 * backwards, a damaged copy, blocked storage) gives null, and a copy that
 * can never be shown again is removed.
 */
export function loadLastAnswer(
  pins: readonly Pin[],
  nowMs: number = Date.now(),
): LastAnswer | null {
  if (pins.length === 0) return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(LAST_ANSWER_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const ids = new Set(pins.map((p) => p.id));
  if (!isStoredAnswer(parsed) || !parsed.watches.every((w) => ids.has(w.pinId))) {
    clearLastAnswer();
    return null;
  }
  const ageMs = nowMs - parsed.savedAt;
  if (
    parsed.pinsKey !== pinsKeyFor(pins) ||
    !(ageMs >= 0 && ageMs < LAST_ANSWER_MAX_AGE_MS)
  ) {
    clearLastAnswer();
    return null;
  }

  // Count the age on one clock (this browser's), then move the server's
  // clock forward by it, so a wrong device clock can't skew "hours ago".
  const madeMs = parsed.now === null ? NaN : Date.parse(parsed.now);
  const frameNowMs = (Number.isFinite(madeMs) ? madeMs : parsed.savedAt) + ageMs;
  return {
    watches: parsed.watches.map((w) => agedWatch(w, ageMs, frameNowMs)),
    now: new Date(frameNowMs).toISOString(),
    savedAt: parsed.savedAt,
  };
}

/**
 * A saved verdict seen `ageMs` later. Only the clock moves: the band, the
 * margin, the peak and the crossing time stay exactly what the data said.
 * The data's age grows by `ageMs`, so past the usual limits (OBS_STALE_H,
 * FCST_STALE_H) it reads as stale, the way the Surveyor marks old data:
 * the "data delayed" chip and "Heads up" line appear, and the sentence
 * says "the last forecast" instead of "today" or "now". "Hours from now"
 * is counted to `nowMs` (the verdicts' own clock).
 */
export function agedWatch(w: PinWatch, ageMs: number, nowMs: number): PinWatch {
  const v = w.verdict;
  if (v.tier === "ALERT_ONLY" || !(ageMs > 0)) return w;
  const ageH = ageMs / HOUR_MS;
  const stale = agedStaleness(v.stale, ageH);
  if (v.tier === "CATEGORY") return { ...w, verdict: { ...v, stale } };
  let crossing = v.crossing;
  if (crossing) {
    const crossMs = Date.parse(crossing.t);
    crossing = {
      t: crossing.t,
      hoursFromNow: Number.isFinite(crossMs)
        ? Math.round((crossMs - nowMs) / HOUR_MS)
        : Math.round(crossing.hoursFromNow - ageH),
    };
  }
  const verdict: Verdict = { ...v, stale, crossing };
  return { ...w, verdict };
}

function agedStaleness(s: Staleness, ageH: number): Staleness {
  const observedH = s.observedH === null ? null : s.observedH + ageH;
  const forecastH = s.forecastH === null ? null : s.forecastH + ageH;
  return {
    observedH,
    forecastH,
    // Data only ever gets older: stale stays stale.
    staleObserved: s.staleObserved || observedH === null || observedH > OBS_STALE_H,
    staleForecast: s.staleForecast || forecastH === null || forecastH > FCST_STALE_H,
  };
}

/* ---------------------------------------------------------------- */
/* Shape checks. A damaged or hand-edited copy must never reach a      */
/* screen: the screens read these fields without asking.               */
/* ---------------------------------------------------------------- */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isNumOrNull = (x: unknown) => x === null || isNum(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const isStrOrNull = (x: unknown) => x === null || isStr(x);
const isBool = (x: unknown): x is boolean => typeof x === "boolean";

const isPoint = (p: unknown) => isObj(p) && isStr(p.t) && isNum(p.stageFt);
const isSeries = (s: unknown) => Array.isArray(s) && s.every(isPoint);

function isStaleness(s: unknown): boolean {
  return (
    isObj(s) &&
    isNumOrNull(s.observedH) &&
    isNumOrNull(s.forecastH) &&
    isBool(s.staleObserved) &&
    isBool(s.staleForecast)
  );
}

const BANDS = ["LIKELY", "BORDERLINE", "UNLIKELY"];
const CATEGORIES = ["action", "minor", "moderate", "major", "none"];

function isVerdict(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (v.tier === "ALERT_ONLY") return true;
  if (v.tier === "CATEGORY") {
    return (
      isNum(v.peakStageFt) &&
      isStr(v.peakT) &&
      isNumOrNull(v.aboveFloodFt) &&
      (v.category === null ||
        v.category === undefined ||
        CATEGORIES.includes(v.category as string)) &&
      isStaleness(v.stale)
    );
  }
  if (v.tier === "FULL") {
    const peak = v.peak;
    const crossing = v.crossing;
    return (
      BANDS.includes(v.band as string) &&
      isNum(v.marginFt) &&
      isObj(peak) &&
      isNum(peak.waterElevFt) &&
      isNum(peak.stageFt) &&
      isStr(peak.t) &&
      (crossing === null ||
        (isObj(crossing) && isStr(crossing.t) && isNum(crossing.hoursFromNow))) &&
      isBool(v.pastPeak) &&
      isBool(v.currentlyAbove) &&
      isNumOrNull(v.currentWaterElevFt) &&
      isStaleness(v.stale)
    );
  }
  return false;
}

function isGauge(g: unknown): boolean {
  if (g === null) return true;
  return (
    isObj(g) &&
    isStr(g.lid) &&
    isStr(g.name) &&
    isStrOrNull(g.usgsId) &&
    isNum(g.distanceMi) &&
    isNumOrNull(g.gaugeZeroFt) &&
    isStrOrNull(g.gaugeDatum) &&
    isObj(g.categories) &&
    Array.isArray(g.historicCrests) &&
    isSeries(g.observed) &&
    isSeries(g.forecast) &&
    isStrOrNull(g.forecastIssued)
  );
}

const isOptStr = (x: unknown) => x === undefined || isStrOrNull(x);

function isAlert(a: unknown): boolean {
  return (
    isObj(a) &&
    isStr(a.event) &&
    isOptStr(a.headline) &&
    isOptStr(a.severity) &&
    isOptStr(a.areaDesc) &&
    isOptStr(a.expires)
  );
}

function isWatch(w: unknown): w is PinWatch {
  return (
    isObj(w) &&
    isStr(w.pinId) &&
    isVerdict(w.verdict) &&
    isGauge(w.gauge) &&
    Array.isArray(w.alerts) &&
    w.alerts.every(isAlert) &&
    isBool(w.alertsOk)
  );
}

function isStoredAnswer(x: unknown): x is StoredAnswer {
  return (
    isObj(x) &&
    isStr(x.pinsKey) &&
    isStrOrNull(x.now) &&
    isNum(x.savedAt) &&
    Array.isArray(x.watches) &&
    x.watches.length > 0 &&
    x.watches.every(isWatch)
  );
}
