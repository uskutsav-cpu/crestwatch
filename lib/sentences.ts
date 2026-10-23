/**
 * Verdict sentences (Appendix C) — pure builders, no fetch, no clock.
 * Sub-foot precision never reaches the reader: margins round to whole
 * feet, hours carry "~". TEAM: hand-tune the wording in lib/copy.ts.
 */

import { copy } from "@/lib/copy";
import type { GaugeSummary } from "@/lib/watch-service";
import type { Verdict } from "@/lib/surveyor";
import type { Trend } from "@/lib/trend";

const CT = "America/Chicago";

/** "Yazoo River at Yazoo City" → "Yazoo River". */
export function riverName(gaugeName: string): string {
  const cut = gaugeName.search(/\s+(at|near|above|below)\s+/i);
  return cut > 0 ? gaugeName.slice(0, cut) : gaugeName;
}

/** Central-time calendar date "YYYY-MM-DD". */
function ctDate(x: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(x);
}

/** Central-time calendar date as a phrase: "on Oct 12". */
function dateWord(iso: string): string {
  const md = new Intl.DateTimeFormat("en-US", {
    timeZone: CT,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
  return `on ${md}`;
}

export function dayWord(iso: string, nowIso: string): string {
  const d = new Date(iso);
  const target = ctDate(d);
  const todayCT = ctDate(new Date(nowIso));
  // Count days in pure calendar space: DST transitions (23h/25h days)
  // must not shift which date counts as tomorrow.
  const ahead = Math.round(
    (Date.parse(`${target}T12:00:00Z`) - Date.parse(`${todayCT}T12:00:00Z`)) /
      86_400_000,
  );
  if (ahead === 0) return "today";
  if (ahead === 1) return "tomorrow";
  // A weekday name only points at the coming week. A crest from 60 days
  // ago (or 10 days out) named "Monday" reads as next Monday, so past
  // dates and dates a week or more away get the calendar date instead.
  if (ahead < 0 || ahead >= 7) return dateWord(iso);
  return new Intl.DateTimeFormat("en-US", { timeZone: CT, weekday: "long" }).format(d);
}

/** "12pm CT". The live chip and share card say CT too (#18). */
export function timeWord(iso: string): string {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: CT,
    hour: "numeric",
  })
    .format(new Date(iso))
    .toLowerCase()
    .replace(" ", "");
  return `${hour} CT`;
}

const wholeFt = (n: number) => String(Math.max(1, Math.round(Math.abs(n))));

export interface SentenceInput {
  pinName: string;
  verdict: Verdict;
  gauge: Pick<GaugeSummary, "name" | "forecastIssued"> | null;
  now: string;
  /** What the live gauge shows right now, when the reading is fresh. */
  observedTrend?: Trend | null;
}

/** The one sentence (Display size on S2). */
export function verdictSentence({
  pinName,
  verdict,
  gauge,
  now,
  observedTrend = null,
}: SentenceInput): string {
  if (verdict.tier === "ALERT_ONLY") {
    return copy.verdictAlertOnly;
  }

  if (verdict.tier === "CATEGORY") {
    // Branch on the SEVERITY, never on whether a margin number happens to
    // exist — a gauge that omits its minor stage can still forecast major
    // flooding, and "at exactly flood stage" is flooding, not below it.
    const cat = verdict.category;
    const gaugeName = gauge?.name ?? copy.verdictGaugeFallback;
    if (cat === "minor" || cat === "moderate" || cat === "major") {
      const catWord = `${cat[0].toUpperCase()}${cat.slice(1)}`;
      if (verdict.aboveFloodFt !== null && verdict.aboveFloodFt > 0) {
        return copy.verdictCategory(
          verdict.aboveFloodFt.toFixed(1),
          gaugeName,
          catWord,
        );
      }
      return copy.verdictCategoryNoMargin(gaugeName, catWord);
    }
    if (cat === "action") {
      return copy.verdictCategoryAction(gaugeName);
    }
    // Genuinely below every published threshold (or none published).
    return copy.verdictCategoryNone(gaugeName);
  }

  // Every template reads "the {river}", so the fallback is the bare noun.
  const river = gauge ? riverName(gauge.name) : copy.verdictRiverFallback;
  // Stale data (the "data delayed" chip is showing) never says "today" or
  // "now". Those sentences say what the last forecast showed, and name a
  // calendar date, because "today" in a 3-day-old forecast isn't today.
  const stale = verdict.stale.staleObserved || verdict.stale.staleForecast;
  // A trend only counts from a fresh reading. Callers already pass null
  // otherwise; enforce it here so a stale gauge can never claim "rising".
  const trend = verdict.stale.staleObserved ? null : observedTrend;

  if (verdict.band === "LIKELY") {
    // Already flooded and still rising outranks every other phrasing —
    // never tell a family under water about a peak "within a foot".
    // Only assert "in the water NOW" from a fresh reading; with a stale
    // gauge we fall through to the forecast-based wording instead. A
    // fresh reading next to a stale forecast still drops the word "now".
    if (
      verdict.currentlyAbove &&
      !verdict.pastPeak &&
      !verdict.stale.staleObserved
    ) {
      return verdict.stale.staleForecast
        ? copy.verdictLikelyNowStale(pinName, river)
        : copy.verdictLikelyNow(pinName, river);
    }
    if (verdict.pastPeak) {
      // The forecast says the crest is behind us. When the live gauge is
      // measurably rising at the same time, the two sources disagree, and
      // saying "coming down" would pick the staler one. Say both.
      // (A rising trend implies a fresh reading, so only the forecast can
      // be the stale half here.)
      if (trend === "rising") {
        return verdict.stale.staleForecast
          ? copy.verdictLikelyPastPeakButRisingStale(river, pinName)
          : copy.verdictLikelyPastPeakButRising(river, pinName);
      }
      return stale
        ? copy.verdictLikelyPastPeakStale(river, pinName)
        : copy.verdictLikelyPastPeak(river, pinName);
    }
    if (verdict.crossing) {
      const peakMs = Date.parse(verdict.peak.t);
      const crossMs = Date.parse(verdict.crossing.t);
      const hoursBefore = Math.max(1, Math.round((peakMs - crossMs) / 3_600_000));
      return stale
        ? copy.verdictLikelyStale(
            river,
            dateWord(verdict.peak.t),
            timeWord(verdict.peak.t),
            pinName,
            hoursBefore,
          )
        : copy.verdictLikely(
            river,
            dayWord(verdict.peak.t, now),
            timeWord(verdict.peak.t),
            pinName,
            hoursBefore,
          );
    }
    // Within the LIKELY margin but no forecast crossing. Only claim
    // "within a foot" when the peak really stays just below the pin.
    if (verdict.marginFt >= 0) {
      return copy.verdictLikelyWithinFoot(pinName);
    }
    return copy.verdictLikelyCheckBack;
  }

  if (verdict.band === "BORDERLINE") {
    // Forecasts are reissued about every 8 hours. Name that clock time
    // only while it's still ahead of us; an evening visit (or an old
    // forecast) would otherwise be told to check back at 4pm, already gone.
    const nextMs = gauge?.forecastIssued
      ? Date.parse(gauge.forecastIssued) + 8 * 3_600_000
      : NaN;
    const nextTime =
      Number.isFinite(nextMs) && nextMs > Date.parse(now)
        ? timeWord(new Date(nextMs).toISOString())
        : null;
    return copy.verdictBorderline(pinName, wholeFt(verdict.marginFt), nextTime);
  }

  const stage = verdict.peak.stageFt.toFixed(1);
  const margin = wholeFt(verdict.marginFt);
  // The last reading is the highest water: the forecast shows nothing
  // higher, so the margin was measured against that reading, not a crest.
  const fromReading =
    verdict.currentWaterElevFt !== null &&
    verdict.currentWaterElevFt >= verdict.peak.waterElevFt;
  if (stale) {
    // Say where the number came from.
    return fromReading
      ? copy.verdictUnlikelyStaleReading(river, stage, pinName, margin)
      : copy.verdictUnlikelyStale(
          river,
          dateWord(verdict.peak.t),
          stage,
          pinName,
          margin,
        );
  }
  // Falling river: only when the fresh reading IS the highest water is
  // peak.stageFt the river's level right now, so "is at … and coming
  // down" is true, and "peaks today" next to a "river falling" chip is
  // not. pastPeak alone isn't enough: the peak can be the next forecast
  // point, still above the reading. A live gauge still rising keeps the
  // "peaks" wording, as in the LIKELY branch.
  if (fromReading && trend !== "rising") {
    return copy.verdictUnlikelyFalling(river, stage, pinName, margin);
  }
  return copy.verdictUnlikely(
    river,
    dayWord(verdict.peak.t, now),
    stage,
    pinName,
    margin,
  );
}

/** Short one-liner for place cards (S3). */
export function statusLine(verdict: Verdict): string {
  if (verdict.tier === "ALERT_ONLY") return copy.noGaugeHeadline;
  if (verdict.tier === "CATEGORY") {
    if (verdict.category === "action") {
      return copy.statusCategoryAction;
    }
    if (verdict.category && verdict.category !== "none") {
      return copy.statusCategoryFlooding(verdict.category);
    }
    return copy.statusCategoryNone;
  }
  if (verdict.band === "LIKELY") return copy.bandLikely;
  if (verdict.band === "BORDERLINE") return copy.bandBorderline;
  return copy.bandUnlikely(wholeFt(verdict.marginFt));
}
