/**
 * Verdict sentences (Appendix C) — pure builders, no fetch, no clock.
 * Sub-foot precision never reaches the reader: margins round to whole
 * feet, hours carry "~". TEAM: hand-tune the wording in lib/copy.ts.
 */

import { copy } from "@/lib/copy";
import type { GaugeSummary } from "@/lib/watch-service";
import type { Verdict } from "./zzzold-surveyor";

const CT = "America/Chicago";

/** "Yazoo River at Yazoo City" → "Yazoo River". */
export function riverName(gaugeName: string): string {
  const cut = gaugeName.search(/\s+(at|near|above|below)\s+/i);
  return cut > 0 ? gaugeName.slice(0, cut) : gaugeName;
}

export function dayWord(iso: string, nowIso: string): string {
  const d = new Date(iso);
  const now = new Date(nowIso);
  const fmt = (x: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: CT, dateStyle: "short" }).format(x);
  if (fmt(d) === fmt(now)) return "today";
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (fmt(d) === fmt(tomorrow)) return "tomorrow";
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
}

/** The one sentence (Display size on S2). */
export function verdictSentence({ pinName, verdict, gauge, now }: SentenceInput): string {
  if (verdict.tier === "ALERT_ONLY") {
    return copy.verdictAlertOnly;
  }

  if (verdict.tier === "CATEGORY") {
    const cat = verdict.category;
    const catWord =
      cat === null || cat === "none"
        ? null
        : cat === "action"
          ? "near-flood (Action)"
          : `${cat[0].toUpperCase()}${cat.slice(1)}`;
    if (
      catWord &&
      verdict.aboveFloodFt !== null &&
      verdict.aboveFloodFt > 0 &&
      gauge
    ) {
      return copy.verdictCategory(
        verdict.aboveFloodFt.toFixed(1),
        gauge.name,
        catWord,
      );
    }
    // Below flood stage (or categories unpublished): calm, factual.
    return `The forecast crest at ${gauge?.name ?? "the nearest gauge"} stays below flood stage. Low areas near the river should stay passable.`;
  }

  const river = gauge ? riverName(gauge.name) : "The river";

  if (verdict.band === "LIKELY") {
    if (verdict.pastPeak) {
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
    // Within the LIKELY margin but no forecast crossing — too close to
    // promise either way; say it like BORDERLINE with the likely lean.
    return `${copy.bandLikely} The forecast peak comes within a foot of ${pinName}.`;
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
    if (verdict.category && verdict.category !== "none") {
      return `${verdict.category} flooding forecast near the gauge`;
    }
    return "below flood stage at the nearest gauge";
  }
  if (verdict.band === "LIKELY") return copy.bandLikely;
  if (verdict.band === "BORDERLINE") return copy.bandBorderline;
  return copy.bandUnlikely(wholeFt(verdict.marginFt));
}
