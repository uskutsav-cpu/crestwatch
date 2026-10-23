"use client";

/**
 * The S2 picture (Appendix B3): side-view of the ground, the pins, the
 * water at its current level (40% current-color layer, 800ms rise), and
 * the dashed forecast-crest ghost line with the gap labeled in feet.
 * Replay reuses it with its own crestLabel for a flood that already
 * happened.
 */

import { sceneLayout, SCENE_H, SCENE_W, type SceneInput } from "@/lib/scene";

/**
 * Every label gets a surface-coloured halo so it stays readable where it
 * crosses the translucent water layer (WCAG 1.4.3).
 */
const HALO = {
  stroke: "var(--color-surface)",
  strokeWidth: 3,
  strokeLinejoin: "round",
  paintOrder: "stroke",
} as const;

export interface WaterSceneProps extends SceneInput {
  /** Name of the dashed line. Default "forecast crest" (the /watch view). */
  crestLabel?: string;
}

function gapLabel(gapFt: number): string {
  const a = Math.abs(gapFt);
  if (a < 1) return "under 1 ft";
  return `${Math.round(a)} ft`;
}

export function WaterScene({
  crestLabel = "forecast crest",
  ...props
}: WaterSceneProps) {
  const s = sceneLayout(props);
  const focused = s.markers[0];
  const crestName = crestLabel.charAt(0).toUpperCase() + crestLabel.slice(1);

  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      role="img"
      aria-label={
        s.gapFt === null
          ? "Side view of the ground and river level"
          : s.gapFt >= 0
            ? `${crestName} stays ${gapLabel(s.gapFt)} below ${focused.label}`
            : `${crestName} reaches ${gapLabel(s.gapFt)} above ${focused.label}`
      }
      className="w-full rounded-2xl bg-surface"
    >
      {/* ground silhouette */}
      <path d={s.groundPath} fill="var(--color-bg)" stroke="var(--color-line)" strokeWidth="1" />

      {/* water — translucent layer rising to the observed level */}
      {s.waterY !== null && (
        <g
          className="animate-water-rise"
          style={{ transformBox: "fill-box" as const }}
        >
          <rect
            x="0"
            y={s.waterY}
            width={SCENE_W}
            height={SCENE_H - s.waterY}
            fill="var(--color-current)"
            opacity="0.4"
          />
          <line
            x1="0"
            x2={SCENE_W}
            y1={s.waterY}
            y2={s.waterY}
            stroke="var(--color-current)"
            strokeWidth="2"
          />
        </g>
      )}

      {/* forecast crest ghost line */}
      {s.crestY !== null && (
        <g>
          <line
            x1="0"
            x2={SCENE_W}
            y1={s.crestY}
            y2={s.crestY}
            stroke="var(--color-current)"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
          <text
            x={SCENE_W - 6}
            y={s.crestY - 6}
            textAnchor="end"
            className="tnum"
            fontSize="14"
            fill="var(--color-dim)"
            {...HALO}
          >
            {crestLabel}
          </text>
        </g>
      )}

      {/* gap label between the focused pin and the crest */}
      {s.crestY !== null && s.gapFt !== null && s.gapLabelY !== null && (
        <g>
          <line
            x1={focused.x + 52}
            x2={focused.x + 52}
            y1={Math.min(focused.y, s.crestY)}
            y2={Math.max(focused.y, s.crestY)}
            stroke={s.gapFt >= 0 ? "var(--color-dryland-ink)" : "var(--color-floodline-ink)"}
            strokeWidth="1.5"
          />
          <text
            x={focused.x + 58}
            y={s.gapLabelY}
            fontSize="16"
            fontWeight="600"
            className="tnum"
            fill={s.gapFt >= 0 ? "var(--color-dryland-ink)" : "var(--color-floodline-ink)"}
            {...HALO}
          >
            {gapLabel(s.gapFt)}
          </text>
        </g>
      )}

      {/* markers */}
      {s.markers.map((m, i) => (
        <g key={`${m.label}-${i}`}>
          <title>{m.label}</title>
          {i === 0 ? (
            // house
            <g>
              <rect x={m.x - 10} y={m.y - 14} width="20" height="14" fill="var(--color-fg)" opacity="0.9" rx="1.5" />
              <path
                d={`M ${m.x - 13} ${m.y - 13} L ${m.x} ${m.y - 24} L ${m.x + 13} ${m.y - 13} Z`}
                fill="var(--color-fg)"
              />
            </g>
          ) : (
            // road strip
            <rect x={m.x - 16} y={m.y - 4} width="32" height="4" rx="2" fill="var(--color-fg)" opacity="0.75" />
          )}
          <text
            x={m.x}
            y={m.y + 18}
            textAnchor="middle"
            fontSize="14"
            fontWeight="600"
            fill="var(--color-fg)"
            {...HALO}
          >
            {(m.label.length > 11
              ? `${m.label.slice(0, 10).trimEnd()}…`
              : m.label
            ).toUpperCase()}
          </text>
          <text
            x={m.x}
            y={m.y + 34}
            textAnchor="middle"
            fontSize="13"
            className="tnum"
            fill="var(--color-dim)"
            {...HALO}
          >
            {m.elevationFt.toFixed(1)} ft
          </text>
        </g>
      ))}
    </svg>
  );
}
