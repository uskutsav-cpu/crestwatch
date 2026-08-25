/**
 * WaterScene geometry (T07) — pure layout math for the S2 side-view SVG,
 * unit-tested apart from React. Coordinates in a 400×220 viewBox.
 */

export const SCENE_W = 400;
export const SCENE_H = 220;
const TOP_PAD = 26;
const BOTTOM_PAD = 18;

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
  groundPath: string;
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
  return {
    y,
    waterY: input.currentWaterElevFt !== null ? y(input.currentWaterElevFt) : null,
    crestY: input.crestElevFt !== null ? y(input.crestElevFt) : null,
    markers,
    gapFt:
      input.crestElevFt !== null
        ? focused.elevationFt - input.crestElevFt
        : null,
    groundPath: d,
  };
}
