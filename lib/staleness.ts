/**
 * One staleness rule for every page (Watch, Why, the share card), so the
 * "Heads up" line never says one thing on Watch and another on Why.
 */

import { copy } from "@/lib/copy";
import type { Verdict } from "@/lib/surveyor";

/** Stale data and how many hours old it is (0 when nobody knows). */
export function staleInfo(verdict: Verdict): { stale: boolean; hours: number } {
  if (verdict.tier === "ALERT_ONLY") return { stale: false, hours: 0 };
  const s = verdict.stale;
  return {
    stale: s.staleObserved || s.staleForecast,
    hours: Math.round(Math.max(s.observedH ?? 0, s.forecastH ?? 0)),
  };
}

/** The "Heads up" line under the sentence (and on the share card). */
export function staleLineFor(verdict: Verdict): string | null {
  const { stale, hours } = staleInfo(verdict);
  if (!stale) return null;
  return hours > 0 ? copy.staleness(hours) : copy.stalenessUnknown;
}
