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

export function dayWord(iso: string, nowIso: string): string {
  const d = new Date(iso);
  const now = new Date(nowIso);
  const target = ctDate(d);
  const todayCT = ctDate(now);
  if (target === todayCT) return "today";
  // "Tomorrow" in pure calendar space — DST transitions (23h/25h days)
  // must not shift which date counts as tomorrow.
  const tomorrowCT = new Date(Date.parse(`${todayCT}T12:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (target === tomorrowCT) return "tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: CT, weekday: "long" }).format(d);
}

export function timeWord(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CT,
    hour: "numeric",
  })
    .format(new Date(iso))
    .toLowerCase()
    .replace(" ", "");
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
    const gaugeName = gauge?.name ?? "the nearest gauge";
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
    return `The forecast crest at ${gaugeName} stays below flood stage. Low areas near the river should stay passable.`;
  }

  const river = gauge ? riverName(gauge.name) : "The river";

  if (verdict.band === "LIKELY") {
    // Already flooded and still rising outranks every other phrasing —
    // never tell a family under water about a peak "within a foot".
    // Only assert "in the water NOW" from a fresh reading; with a stale
    // gauge we fall through to the forecast-based wording instead.
    if (
      verdict.currentlyAbove &&
      !verdict.pastPeak &&
      !verdict.stale.staleObserved
    ) {
      return copy.verdictLikelyNow(pinName, river);
    }
    if (verdict.pastPeak) {
      // The forecast says the crest is behind us. When the live gauge is
      // measurably rising at the same time, the two sources disagree, and
      // saying "coming down" would pick the staler one. Say both.
      if (observedTrend === "rising") {
        return copy.verdictLikelyPastPeakButRising(river, pinName);
      }
      return copy.verdictLikelyPastPeak(river, pinName);
    }
    if (verdict.crossing) {
      const peakMs = Date.parse(verdict.peak.t);
      const crossMs = Date.parse(verdict.crossing.t);
      const hoursBefore = Math.max(1, Math.round((peakMs - crossMs) / 3_600_000));
      return copy.verdictLikely(
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
      return `${copy.bandLikely} The forecast peak comes within a foot of ${pinName}.`;
    }
    return `${copy.bandLikely} Check back after the next forecast.`;
  }

  if (verdict.band === "BORDERLINE") {
    const next = gauge?.forecastIssued
      ? timeWord(new Date(Date.parse(gauge.forecastIssued) + 8 * 3_600_000).toISOString())
      : "the next update";
    return copy.verdictBorderline(pinName, wholeFt(verdict.marginFt), next);
  }

  return copy.verdictUnlikely(
    river,
    dayWord(verdict.peak.t, now),
    verdict.peak.stageFt.toFixed(1),
    pinName,
    wholeFt(verdict.marginFt),
  );
}

/** Short one-liner for place cards (S3). */
export function statusLine(verdict: Verdict): string {
  if (verdict.tier === "ALERT_ONLY") return copy.noGaugeHeadline;
  if (verdict.tier === "CATEGORY") {
    if (verdict.category === "action") {
      return "close to flood stage at the nearest gauge";
    }
    if (verdict.category && verdict.category !== "none") {
      return `${verdict.category} flooding forecast near the gauge`;
    }
    return "below flood stage at the nearest gauge";
  }
  if (verdict.band === "LIKELY") return copy.bandLikely;
  if (verdict.band === "BORDERLINE") return copy.bandBorderline;
  return copy.bandUnlikely(wholeFt(verdict.marginFt));
}
