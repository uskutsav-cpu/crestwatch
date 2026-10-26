export interface RiverImpact {
  stage: number;
  statement: string;
}
/** Only official, finite stage-in-feet impact notes; never infer missing thresholds. */
export function parseImpacts(raw: unknown): RiverImpact[] {
  const d = raw as {
    flood?: {
      stageUnits?: string;
      impacts?: Array<{ stage?: unknown; statement?: unknown }>;
    };
  };
  if (d?.flood?.stageUnits !== "ft" || !Array.isArray(d.flood.impacts))
    return [];
  return d.flood.impacts
    .filter(
      (n): n is RiverImpact =>
        typeof n.stage === "number" &&
        Number.isFinite(n.stage) &&
        typeof n.statement === "string" &&
        n.statement.trim().length > 0,
    )
    .map((n) => ({ stage: n.stage, statement: n.statement.trim() }))
    .sort((a, b) => a.stage - b.stage);
}
export function impactContext(stage: number, notes: RiverImpact[]) {
  const sorted = notes.slice().sort((a, b) => a.stage - b.stage);
  return {
    reached: Number.isFinite(stage)
      ? sorted.filter((n) => n.stage <= stage)
      : [],
    next: Number.isFinite(stage)
      ? (sorted.find((n) => n.stage > stage) ?? null)
      : null,
  };
}
