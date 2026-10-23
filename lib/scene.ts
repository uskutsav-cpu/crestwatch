/**
 * WaterScene geometry (T07) — pure layout math for the S2 side-view SVG,
 * unit-tested apart from React. Coordinates in a 400×220 viewBox.
 */

export const SCENE_W = 400;
export const SCENE_H = 220;
const TOP_PAD = 26;
const BOTTOM_PAD = 18;

/**
 * Below this many feet of gap (or this many px between the two lines) the
 * gap label can't fit between the pin and the crest, so it sits just above
 * the higher of the two instead of on top of the dashed line.
 */
export const GAP_LABEL_LIFT_FT = 1.5;
const GAP_LABEL_MIN_PX = 24;

export interface SceneMarker {
  label: string;
  elevationFt: number;
}

export interface SceneInput {
  markers: SceneMarker[]; // 1–2, first = the focused pin
  currentWaterElevFt: number | null;
  crestElevFt: number | null;
}

export interface SceneLayout {
  /** y for an elevation (clamped into the drawable band). */
  y: (elevFt: number) => number;
  waterY: number | null;
  crestY: number | null;
  markers: Array<SceneMarker & { x: number; y: number }>;
  /** Gap between focused pin and crest, ft (positive = pin above crest). */
  gapFt: number | null;
  /** Baseline y for the gap label; null when there is no gap to label. */
  gapLabelY: number | null;
  groundPath: string;
}

/**
 * Where the gap label's baseline goes. Normally halfway between the pin
 * and the crest; for a small gap, just above the higher line so the text
 * never sits on the dashed crest line.
 */
export function gapLabelY(pinY: number, crestY: number, gapFt: number): number {
  const tight =
    Math.abs(gapFt) < GAP_LABEL_LIFT_FT ||
    Math.abs(pinY - crestY) < GAP_LABEL_MIN_PX;
  if (!tight) return (pinY + crestY) / 2 + 4;
  return Math.max(16, Math.min(pinY, crestY) - 8);
}

export function sceneLayout(input: SceneInput): SceneLayout {
  const elevs = [
    ...input.markers.map((m) => m.elevationFt),
    ...(input.currentWaterElevFt !== null ? [input.currentWaterElevFt] : []),
    ...(input.crestElevFt !== null ? [input.crestElevFt] : []),
  ];
  const hi = Math.max(...elevs);
  const lo = Math.min(...elevs);
  const span = Math.max(hi - lo, 4); // never flatter than 4 ft of relief
  const drawable = SCENE_H - TOP_PAD - BOTTOM_PAD;

  const y = (elevFt: number) =>
    TOP_PAD + ((hi + span * 0.15 - elevFt) / (span * 1.3)) * drawable;

  // Markers sit on the ground line: focused pin on the left third,
  // second marker on the middle third; river falls away to the right.
  const xs = input.markers.length > 1 ? [70, 210] : [110];
  const markers = input.markers.map((m, i) => ({
    ...m,
    x: xs[i] ?? 110,
    y: y(m.elevationFt),
  }));

  // Ground silhouette: plateau at each marker, then a slope into the
  // river bottom at the right edge.
  const riverBottomY = SCENE_H - BOTTOM_PAD + 6;
  let d = `M 0 ${markers[0].y.toFixed(1)}`;
  for (const m of markers) {
    d += ` L ${(m.x - 40).toFixed(1)} ${m.y.toFixed(1)} L ${(m.x + 40).toFixed(1)} ${m.y.toFixed(1)}`;
  }
  d += ` L ${SCENE_W - 60} ${riverBottomY.toFixed(1)} L ${SCENE_W} ${riverBottomY.toFixed(1)}`;
  d += ` L ${SCENE_W} ${SCENE_H} L 0 ${SCENE_H} Z`;

  const focused = input.markers[0];
  const crestY = input.crestElevFt !== null ? y(input.crestElevFt) : null;
  const gapFt =
    input.crestElevFt !== null ? focused.elevationFt - input.crestElevFt : null;
  return {
    y,
    waterY: input.currentWaterElevFt !== null ? y(input.currentWaterElevFt) : null,
    crestY,
    markers,
    gapFt,
    gapLabelY:
      crestY !== null && gapFt !== null
        ? gapLabelY(markers[0].y, crestY, gapFt)
        : null,
    groundPath: d,
  };
}
