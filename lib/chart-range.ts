export function chartRange(values: number[], floodStage: number | null | undefined, reference: number | null, focus: boolean) {
  const numbers = values.filter(Number.isFinite);
  if (reference !== null && Number.isFinite(reference)) numbers.push(reference);
  if (!focus && floodStage != null && Number.isFinite(floodStage)) numbers.push(floodStage);
  if (!numbers.length) return { lo: 0, hi: 1 };
  const low = Math.min(...numbers), high = Math.max(...numbers);
  const pad = Math.max(2, (high - low) * .15);
  return { lo: Math.floor(low - pad), hi: Math.ceil(high + pad) };
}
