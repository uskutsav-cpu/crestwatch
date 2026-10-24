/**
 * "Past floods at your place" (package history). Pure: no fetch, no
 * clock (`now` is an input). For each big crest NWPS lists at the gauge,
 * it asks: if that crest came back today, how high would the water reach
 * compared with this pin's ground?
 *
 *   crest water level = gauge zero + crest stage
 *   depth at the pin  = crest water level - pin ground
 *
 * Only for a gauge zero the Surveyor trusts (FULL tier): the caller passes
 * null otherwise. Crests NWPS flags "olddatum" were read against an older
 * gauge zero, so adding today's zero to them would be wrong. They are left
 * out and counted, and the summary then says "can compare". Levees and
 * floodwalls are not modelled; the copy says so.
 *
 * The summary uses the Surveyor's own bands: a crest that stays below the
 * ground by BANDS.borderline or less is "too close to call", the words the
 * live verdict uses for the same margin. The intro asks "if one came back
 * today", which is the forecast case, so the two must never disagree.
 */

import { BANDS } from "@/lib/config";
import { copy } from "@/lib/copy";
// Type only: this module runs in the browser, and lib/gauges pulls in the
// server-side fetch helpers.
import type { HistoricCrest } from "@/lib/gauges";

/** How many of the highest crests the list and the summary cover. */
export const PAST_FLOODS_TOP = 5;
/** The most recent crest this many years back gets a row of its own. */
export const PAST_FLOODS_RECENT_YEARS = 15;

/**
 * Float noise: 46.22 + 47.48 - 92.7 is 0.99999… and must read as 1 ft.
 * Depths are snapped to a millionth of a foot before any threshold.
 */
const snap = (ft: number) => Math.round(ft * 1e6) / 1e6;

/**
 * lib/gauges datumLooksSane, restated so the browser bundle stays free of
 * the fetch code: water more than 200 ft from the ground means a datum
 * problem, not a flood. tests/flood-history.test.ts holds the two equal.
 */
export function crestLooksSane(
  gaugeZeroFt: number,
  stageFt: number,
  pinElevationFt: number,
): boolean {
  return Math.abs(gaugeZeroFt + stageFt - pinElevationFt) <= 200;
}

export type PastFloodOutcome =
  /** Water at the pin, 1 ft or more: "about {n} ft of water here". */
  | "water"
  /** Water at the pin, under a foot: "less than a foot of water here". */
  | "underFoot"
  /** Stayed below the pin by under a foot: "stayed below, but within a foot". */
  | "withinFoot"
  /** Stayed below the pin by 1 ft or more: "stayed about {n} ft below". */
  | "below";

export interface PastFloodRow {
  /** NWPS occurredTime, as given. */
  time: string;
  /** "May 2011" (read in UTC: NWPS dates crests at 00:00Z). */
  monthYear: string;
  stageFt: number;
  /** "57.1 ft on the gauge". */
  stageLabel: string;
  /** gaugeZeroFt + stageFt. */
  waterElevFt: number;
  /** waterElevFt - pinElevationFt, snapped. 0 or more = water reaches the pin. */
  depthFt: number;
  outcome: PastFloodOutcome;
  /** depthFt >= 0. */
  reached: boolean;
  /** "about 11 ft of water here", "stayed about 14 ft below", ... */
  atPin: string;
  /**
   * The extra row: the most recent crest of the last 15 years, added only
   * when it isn't already one of the highest. Never counted in the summary.
   */
  recent: boolean;
}

export interface PastFloodsInput {
  pinName: string;
  /**
   * The gauge's flood stage (categories.minor). When it's known, the extra
   * "most recent big one" row is only added for a crest at or above it, so
   * a small rise is never called a big one. Unknown keeps the old rule.
   */
  floodStageFt?: number | null;
  /** Town or street point: the summary says "this spot", never the name. */
  approximate?: boolean;
  pinElevationFt: number;
  /** Pass only for a FULL verdict; null renders nothing. */
  gaugeZeroFt: number | null;
  historicCrests: HistoricCrest[];
  /** ISO time the "last 15 years" window is measured from. */
  now: string;
}

export interface PastFloods {
  /** Highest first, then the recent row (if any) last. */
  rows: PastFloodRow[];
  /** How many highest crests the summary covers (1 to PAST_FLOODS_TOP). */
  top: number;
  /** Of those, how many reach the pin. */
  reached: number;
  /**
   * Of those, how many stay below but by BANDS.borderline or less: the
   * margin the Surveyor calls too close to call (or likely, under
   * BANDS.likely). The summary never calls these a miss.
   */
  closeCalls: number;
  /** Old-datum crests dropped. */
  leftOut: number;
  /** pinName, or "this spot" for an approximate pin. */
  pinLabel: string;
  /** The one line: "2 of the 5 highest crests here would have reached Home." */
  summary: string;
  /** copy.pastFloodsBigger (or ...BiggerOne for a single crest) when none reached; else null. */
  noneNote: string | null;
  /** copy.pastFloodsLeftOut(n) when old-datum crests were dropped; else null. */
  leftOutNote: string | null;
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "May 2011". */
export function crestMonthYear(iso: string): string {
  return MONTH_YEAR.format(new Date(iso));
}

/** Words for one crest at the pin, from its depth (water - ground, ft). */
export function outcomeFor(depthFt: number): PastFloodOutcome {
  const d = snap(depthFt);
  if (d >= 1) return "water";
  if (d >= 0) return "underFoot";
  if (d > -1) return "withinFoot";
  return "below";
}

export function atPinWords(depthFt: number): string {
  const d = snap(depthFt);
  switch (outcomeFor(d)) {
    case "water":
      return copy.pastFloodsWater(Math.round(d));
    case "underFoot":
      return copy.pastFloodsWaterUnderFoot;
    case "withinFoot":
      return copy.pastFloodsWithinFoot;
    case "below":
      return copy.pastFloodsBelow(Math.round(-d));
  }
}

interface Usable {
  stageFt: number;
  time: string;
  ms: number;
}

/**
 * Comparable crests: finite stage, readable date, not old datum. One per
 * date (the higher, if NWPS lists a date twice). Highest first; a tie goes
 * to the more recent crest.
 */
function usableCrests(crests: HistoricCrest[]): { usable: Usable[]; leftOut: number } {
  const byTime = new Map<string, Usable>();
  let leftOut = 0;
  for (const c of crests ?? []) {
    if (!c || typeof c.stageFt !== "number" || !Number.isFinite(c.stageFt)) continue;
    // NWPS marks a missing value with -9999 (same rule as parseCategories).
    if (c.stageFt <= -100) continue;
    if (typeof c.time !== "string") continue;
    const ms = Date.parse(c.time);
    if (!Number.isFinite(ms)) continue;
    if (c.oldDatum === true) {
      leftOut++;
      continue;
    }
    const prev = byTime.get(c.time);
    if (!prev || c.stageFt > prev.stageFt) {
      byTime.set(c.time, { stageFt: c.stageFt, time: c.time, ms });
    }
  }
  const usable = [...byTime.values()].sort(
    (a, b) => b.stageFt - a.stageFt || b.ms - a.ms,
  );
  return { usable, leftOut };
}

/**
 * Everything the Past floods block shows, or null when there's nothing
 * honest to show: no gauge zero, no usable crest, an unusable pin height,
 * or a gauge zero that puts a crest absurdly far (>200 ft) from the ground.
 */
export function pastFloods(input: PastFloodsInput): PastFloods | null {
  const { gaugeZeroFt: zero, pinElevationFt: ground } = input;
  if (zero === null || !Number.isFinite(zero) || !Number.isFinite(ground)) return null;

  const { usable, leftOut } = usableCrests(input.historicCrests);
  if (usable.length === 0) return null;

  const top = usable.slice(0, PAST_FLOODS_TOP);
  const picked: Array<{ c: Usable; recent: boolean }> = top.map((c) => ({
    c,
    recent: false,
  }));

  // The most recent crest of the last 15 years, when it isn't already up
  // there. With a known flood stage, only a crest that reached it counts
  // as a "big one".
  const nowMs = Date.parse(input.now);
  const fs = input.floodStageFt;
  const floodStage = typeof fs === "number" && Number.isFinite(fs) ? fs : null;
  if (Number.isFinite(nowMs)) {
    const from = new Date(nowMs);
    from.setUTCFullYear(from.getUTCFullYear() - PAST_FLOODS_RECENT_YEARS);
    let latest: Usable | null = null;
    for (const c of usable) {
      if (c.ms < from.getTime() || c.ms > nowMs) continue;
      if (floodStage !== null && c.stageFt < floodStage) continue;
      if (!latest || c.ms > latest.ms) latest = c;
    }
    if (latest && !top.includes(latest)) picked.push({ c: latest, recent: true });
  }

  // Same rule as the Surveyor's tier gate: a gauge zero that puts the water
  // hundreds of feet from the ground is a datum problem, not a flood.
  if (!picked.every(({ c }) => crestLooksSane(zero, c.stageFt, ground))) return null;

  const rows: PastFloodRow[] = picked.map(({ c, recent }) => {
    const waterElevFt = zero + c.stageFt;
    const depthFt = snap(waterElevFt - ground);
    const outcome = outcomeFor(depthFt);
    return {
      time: c.time,
      monthYear: crestMonthYear(c.time),
      stageFt: c.stageFt,
      stageLabel: copy.pastFloodsStage(c.stageFt.toFixed(1)),
      waterElevFt,
      depthFt,
      outcome,
      reached: depthFt >= 0,
      atPin: atPinWords(depthFt),
      recent,
    };
  });

  const counted = rows.filter((r) => !r.recent);
  const reached = counted.filter((r) => r.reached).length;
  // Margin = ground - water = -depth. Same test as the Surveyor's bandFor:
  // margin <= BANDS.borderline is not a miss.
  const closeCalls = counted.filter(
    (r) => !r.reached && -r.depthFt <= BANDS.borderline,
  ).length;
  const pinLabel = input.approximate ? copy.pastFloodsSpot : input.pinName;

  return {
    rows,
    top: counted.length,
    reached,
    closeCalls,
    leftOut,
    pinLabel,
    summary: copy.pastFloodsLine(reached, counted.length, closeCalls, pinLabel, leftOut > 0),
    noneNote:
      reached === 0
        ? counted.length === 1
          ? copy.pastFloodsBiggerOne
          : copy.pastFloodsBigger
        : null,
    leftOutNote: leftOut > 0 ? copy.pastFloodsLeftOut(leftOut) : null,
  };
}

/**
 * The summary for a compact spot (a <summary>, a place card). When none of
 * the highest crests reached, it carries copy.pastFloodsBigger too, so the
 * line alone never reads as an all-clear.
 */
export function pastFloodsSummary(input: PastFloodsInput): string | null {
  const r = pastFloods(input);
  if (!r) return null;
  return [r.summary, r.noneNote].filter(Boolean).join(" ");
}
