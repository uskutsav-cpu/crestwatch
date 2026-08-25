/**
 * Crest-compare chip (T10): where does the current forecast crest rank
 * among this gauge's historic crests since 2000? Shown only when the
 * forecast is at least at action stage — a quiet river needs no ranking.
 */

import type { FloodCategories, HistoricCrest } from "@/lib/gauges";

export interface CrestCompare {
  rank: number; // 1 = highest since `sinceYear`
  sinceYear: number;
  ordinal: string; // "3rd"
}

export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function crestCompare(
  peakStageFt: number,
  crests: HistoricCrest[],
  categories: FloodCategories,
  sinceYear = 2000,
): CrestCompare | null {
  const action = categories.action ?? categories.minor;
  if (typeof action !== "number" || peakStageFt < action) return null;

  const modern = crests.filter(
    (c) => new Date(c.time).getUTCFullYear() >= sinceYear,
  );
  if (modern.length === 0) return null;

  const higher = modern.filter((c) => c.stageFt > peakStageFt).length;
  const rank = higher + 1;
  return { rank, sinceYear, ordinal: ordinal(rank) };
}
