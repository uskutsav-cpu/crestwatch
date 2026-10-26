import type { SeriesPoint } from "./gauges";
import { isFresh } from "./river-stations";

/** Compare a published threshold with future official samples, never interpolate onset. */
export function thresholdForecast(
  series: SeriesPoint[],
  issued: string | null,
  threshold: number,
  now = Date.now(),
) {
  const points = series
    .filter(
      (p) =>
        Number.isFinite(p.stageFt) &&
        Number.isFinite(Date.parse(p.t)) &&
        Date.parse(p.t) > now,
    )
    .slice()
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const high = points.length
    ? points.reduce((a, b) => (a.stageFt > b.stageFt ? a : b))
    : null;
  const fresh = isFresh(issued, 24, now);
  const first =
    Number.isFinite(threshold) && fresh
      ? (points.find((p) => p.stageFt >= threshold) ?? null)
      : null;
  return {
    status:
      !Number.isFinite(threshold) || !points.length
        ? ("unavailable" as const)
        : !fresh
          ? ("older" as const)
          : first
            ? ("reached" as const)
            : ("below" as const),
    high: fresh ? high : null,
    first,
    end: points.at(-1)?.t ?? null,
    count: points.length,
  };
}

export function nearestImpact(
  stage: number,
  notes: { stage: number; statement: string }[],
) {
  const valid = notes
    .filter((n) => Number.isFinite(n.stage))
    .slice()
    .sort((a, b) => a.stage - b.stage);
  return valid.filter((n) => n.stage <= stage).at(-1) ?? valid[0] ?? null;
}
