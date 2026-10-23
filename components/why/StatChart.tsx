"use client";

/**
 * Observed (solid) vs forecast (dashed) stage chart with the flood-stage
 * reference line — hand-rolled SVG, no chart library (B6 budget).
 */

import { CHART_H, CHART_W, chartLayout, type ChartInput } from "@/lib/chart";
import { copy } from "@/lib/copy";

/**
 * The chart's text alternative, built from the same numbers it draws:
 * the newest reading, the forecast high and the flood-stage line.
 */
export function chartAriaLabel({ observed, forecast, floodStageFt }: ChartInput): string {
  const last = observed.at(-1);
  const high = forecast.length
    ? Math.max(...forecast.map((p) => p.stageFt))
    : null;
  return copy.chartLabel(
    last ? last.stageFt.toFixed(1) : null,
    high !== null ? high.toFixed(1) : null,
    typeof floodStageFt === "number" ? floodStageFt.toFixed(1) : null,
  );
}

export function StatChart(props: ChartInput) {
  const c = chartLayout(props);
  if (!c) return null;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      role="img"
      aria-label={chartAriaLabel(props)}
      className="w-full rounded-2xl bg-surface"
    >
      {c.yTicks.map((t) => (
        <g key={t.label}>
          <line
            x1="44"
            x2={CHART_W - 6}
            y1={t.y}
            y2={t.y}
            stroke="var(--color-line)"
            strokeWidth="0.5"
          />
          <text x="40" y={t.y + 4} textAnchor="end" fontSize="12" className="tnum" fill="var(--color-dim)">
            {t.label}
          </text>
        </g>
      ))}

      {c.floodY !== null && (
        <g>
          <line
            x1="44"
            x2={CHART_W - 6}
            y1={c.floodY}
            y2={c.floodY}
            stroke="var(--color-risewatch)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <text
            x={CHART_W - 8}
            y={c.floodY - 4}
            textAnchor="end"
            fontSize="12"
            fill="var(--color-risewatch)"
          >
            flood stage
          </text>
        </g>
      )}

      <polyline
        points={c.obsPoints}
        fill="none"
        stroke="var(--color-current)"
        strokeWidth="2"
      />
      <polyline
        points={c.fcstPoints}
        fill="none"
        stroke="var(--color-current)"
        strokeWidth="2"
        strokeDasharray="5 4"
        opacity="0.85"
      />

      {c.xLabels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={CHART_H - 6}
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          fontSize="12"
          className="tnum"
          fill="var(--color-dim)"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
