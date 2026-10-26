import type { SeriesPoint } from "./gauges";
/** Daily records are counted as samples; missing dates do not become days above stage. */
export function replaySummary(
  points: SeriesPoint[],
  floodStage: number | null,
) {
  const valid = points
    .filter(
      (p) =>
        Number.isFinite(p.stageFt) &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.t) &&
        Number.isFinite(Date.parse(p.t)),
    )
    .slice()
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const unique = [...new Map(valid.map((p) => [p.t, p])).values()];
  const peak = unique.length
    ? unique.reduce((a, b) => (a.stageFt >= b.stageFt ? a : b))
    : null;
  const compatibleStage = floodStage !== null && Number.isFinite(floodStage);
  const above =
    floodStage !== null && Number.isFinite(floodStage)
      ? unique.filter((p) => p.stageFt >= floodStage)
      : [];
  const span = unique.length
    ? Math.round(
        (Date.parse(unique.at(-1)!.t) - Date.parse(unique[0].t)) / 86400000,
      ) + 1
    : 0;
  return {
    peak,
    firstAbove: above[0] ?? null,
    lastAbove: above.at(-1) ?? null,
    samplesAbove: !compatibleStage ? null : above.length,
    missingDays: Math.max(0, span - unique.length),
    samples: unique.length,
  };
}

/** Keep missing daily dates visually discontinuous; never fabricate intervening values. */
export function splitDailySegments(points: SeriesPoint[]) {
  const groups: SeriesPoint[][] = [];
  for (const p of points) {
    const group = groups.at(-1),
      previous = group?.at(-1);
    const gap =
      previous &&
      /^\d{4}-\d{2}-\d{2}$/.test(previous.t) &&
      /^\d{4}-\d{2}-\d{2}$/.test(p.t) &&
      Date.parse(p.t) - Date.parse(previous.t) > 86400000;
    if (!group || gap) groups.push([p]);
    else group.push(p);
  }
  return groups;
}
