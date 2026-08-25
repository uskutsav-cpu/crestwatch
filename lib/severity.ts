/**
 * Worst-first ordering for the places board (S3). Lower = more urgent.
 */

import type { PinWatch } from "@/lib/watch-service";

export function severityRank(w: PinWatch): number {
  const v = w.verdict;
  if (v.tier === "FULL") {
    if (v.band === "LIKELY") return 0;
    if (v.band === "BORDERLINE") return 4;
    return 8;
  }
  if (v.tier === "CATEGORY") {
    switch (v.category) {
      case "major":
        return 1;
      case "moderate":
        return 2;
      case "minor":
        return 3;
      case "action":
        return 5;
      default:
        return 7;
    }
  }
  // ALERT_ONLY: active alerts outrank quiet
  return w.alerts.length > 0 ? 6 : 9;
}

export function sortWorstFirst(watches: PinWatch[]): PinWatch[] {
  return [...watches].sort((a, b) => severityRank(a) - severityRank(b));
}
