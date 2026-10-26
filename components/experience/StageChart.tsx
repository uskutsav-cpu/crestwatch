"use client";
import { useEffect, useId, useRef, useState } from "react";
import { chartRange } from "@/lib/chart-range";
import { splitDailySegments } from "@/lib/replay-summary";
import { ChartInspector, type ChartSample } from "./ChartInspector";
import type { SeriesPoint } from "@/lib/gauges";
export function StageChart({
  observed,
  forecast = [],
  floodStage,
  issued,
  compact = false,
  unit = "ft on gauge",
  cursor,
  referenceStage,
  sourceLabel = "River gauge",
}: {
  observed: SeriesPoint[];
  forecast?: SeriesPoint[];
  floodStage?: number | null;
  issued?: string | null;
  compact?: boolean;
  unit?: string;
  cursor?: number;
  referenceStage?: number | null;
  sourceLabel?: string;
}) {
  const chartRoot = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(false);
  useEffect(() => setFocus(false), [sourceLabel]);
  const [chartWidth, setChartWidth] = useState(820);
  const narrow = chartWidth < 600;
  const [inspection, setInspection] = useState<number | null>(null);
  useEffect(
    () => setInspection(null),
    [observed[0]?.t, observed.at(-1)?.t, forecast.at(-1)?.t],
  );
  useEffect(() => {
    const root = chartRoot.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(220, Math.round(entry.contentRect.width))));
    observer.observe(root);
    return () => observer.disconnect();
  }, [observed.length, forecast.length]);
  const parseTime = (t: string) =>
    Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(t) ? t + "T12:00:00Z" : t);
  const id = useId().replace(/:/g, "");
  const obs = observed
    .filter(
      (p) => Number.isFinite(p.stageFt) && Number.isFinite(parseTime(p.t)),
    )
    .sort((a, b) => parseTime(a.t) - parseTime(b.t));
  const last = obs.at(-1);
  const fc = forecast
    .filter(
      (p) =>
        Number.isFinite(p.stageFt) && parseTime(p.t) > parseTime(last?.t ?? ""),
    )
    .sort((a, b) => parseTime(a.t) - parseTime(b.t));
  const all = [...obs, ...fc];
  const samples: ChartSample[] = [
    ...obs.map((p) => ({ ...p, kind: "Observed" as const })),
    ...fc.map((p) => ({ ...p, kind: "Forecast" as const })),
  ];
  if (all.length < 2 || obs.length === 0)
    return (
      <div className="chart-empty">Not enough readings to draw a timeline.</div>
    );
  const W = chartWidth,
    H = compact ? 150 : narrow ? 260 : 230,
    L = 45,
    R = 16,
    T = 22,
    B = 32;
  const minT = parseTime(all[0].t),
    maxT = parseTime(all.at(-1)!.t);
  const reference = Number.isFinite(referenceStage) ? referenceStage! : null;
  const {lo, hi} = chartRange(all.map(p => p.stageFt), floodStage, reference, focus);
  const thresholdVisible = floodStage != null && floodStage >= lo && floodStage <= hi;
  const x = (t: string) =>
    L + ((parseTime(t) - minT) / Math.max(1, maxT - minT)) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const line = (a: SeriesPoint[]) =>
    a
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.stageFt).toFixed(1)}`,
      )
      .join(" ");
  const obsGroups = splitDailySegments(obs);
  const obsPath = obsGroups.map(line).join(" ");
  const forecastPath = line(last ? [last, ...fc] : fc);
  const pos =
    cursor === undefined
      ? inspection === null
        ? null
        : all[Math.min(inspection, all.length - 1)]
      : obs[Math.max(0, Math.min(cursor, obs.length - 1))];
  function inspect(event: React.PointerEvent<SVGSVGElement>) {
    if (cursor !== undefined) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * W;
    const time =
      minT + Math.max(0, Math.min(1, (svgX - L) / (W - L - R))) * (maxT - minT);
    let nearest = 0;
    all.forEach((p, i) => {
      if (
        Math.abs(parseTime(p.t) - time) <
        Math.abs(parseTime(all[nearest].t) - time)
      )
        nearest = i;
    });
    setInspection(nearest);
  }
  return (
    <div className="stage-chart" ref={chartRoot}>
      {floodStage != null && cursor === undefined && !compact && <div className="chart-tools">
        <span>CHART SCALE</span><div role="group" aria-label="Chart scale">
          <button aria-pressed={!focus} onClick={() => setFocus(false)}>Full context</button>
          <button aria-pressed={focus} onClick={() => setFocus(true)}>Reading detail</button>
        </div>
      </div>}
      {focus && floodStage != null && !thresholdVisible && <p className="offscale-threshold">Flood stage: {floodStage} ft · {floodStage > hi ? "above" : "below"} this chart view. Switch to Full context to see it.</p>}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        onPointerDown={inspect}
        className={cursor === undefined ? "inspectable-chart" : undefined}
        aria-label={`River timeline, ${unit}. ${last ? `Last plotted reading ${last.stageFt.toFixed(1)}.` : ""} ${floodStage ? `Official flood stage ${floodStage}.` : ""} ${reference !== null ? `Explored hypothetical level ${reference.toFixed(1)}.` : ""}`}
      >
        <defs>
          <pattern
            id={`hatch${id}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
          >
            <path d="M0 6L6 0" stroke="#ccdcec" strokeWidth=".6" />
          </pattern>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const v = lo + ((hi - lo) * i) / 3;
          return (
            <g key={i}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#dfe2d4" />
              <text
                x={L - 10}
                y={y(v) + 4}
                textAnchor="end"
                fill="#657184"
                fontSize="11"
              >
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}
        {last && fc.length > 0 && (
          <rect
            x={x(last.t)}
            y={T}
            width={W - R - x(last.t)}
            height={H - T - B}
            fill={`url(#hatch${id})`}
          />
        )}
        {obsGroups.map((group, i) =>
          group.length > 1 ? (
            <path
              key={i}
              d={`${line(group)} L${x(group.at(-1)!.t)},${H - B} L${x(group[0].t)},${H - B}Z`}
              fill="#e1e9db"
              opacity=".8"
            />
          ) : (
            <circle
              key={i}
              cx={x(group[0].t)}
              cy={y(group[0].stageFt)}
              r="2.5"
              fill="#285a48"
            />
          ),
        )}
        {thresholdVisible && floodStage != null && (
          <g>
            <line
              x1={L}
              x2={W - R}
              y1={y(floodStage)}
              y2={y(floodStage)}
              stroke="#c4792b"
              strokeDasharray="5 5"
            />
            <text
              x={W - R - 2}
              y={y(floodStage) - 7}
              textAnchor="end"
              fontSize="11"
              fill="#9b5818"
            >
              Flood stage · {floodStage} ft
            </text>
          </g>
        )}
        {reference !== null && (
          <g>
            <line
              x1={L}
              x2={W - R}
              y1={y(reference)}
              y2={y(reference)}
              stroke="#d16b20"
              strokeWidth="1.5"
              strokeDasharray="2 4"
            />
            <text x={L + 6} y={y(reference) + 15} fontSize="11" fill="#9b4813">
              {W < 400 ? "What-if" : "Explored level"} · {reference.toFixed(1)} ft{W < 400 ? "" : " · what-if"}
            </text>
          </g>
        )}
        <path
          d={obsPath}
          fill="none"
          stroke="#285a48"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {fc.length > 0 && (
          <path
            d={forecastPath}
            fill="none"
            stroke="#285a48"
            strokeWidth="2.5"
            strokeDasharray="5 5"
          />
        )}
        {last && cursor === undefined && (
          <circle
            cx={x(last.t)}
            cy={y(last.stageFt)}
            r="4.5"
            fill="#285a48"
            stroke="white"
            strokeWidth="2"
          />
        )}
        {pos && (
          <g>
            <line
              x1={x(pos.t)}
              x2={x(pos.t)}
              y1={T}
              y2={H - B}
              stroke="#a35e36"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(pos.t)}
              cy={y(pos.stageFt)}
              r="5"
              fill="#a35e36"
              stroke="#fff"
              strokeWidth="2"
            />
          </g>
        )}
        {(W < 400 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((i) => {
          const time = minT + (maxT - minT) * i;
          return (
            <text
              key={i}
              x={L + (W - L - R) * i}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === 1 ? "end" : "middle"}
              fontSize="11"
              fill="#657184"
            >
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "America/Chicago",
              }).format(time)}
            </text>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span>
          <i /> Observed
        </span>
        {fc.length > 0 && (
          <span>
            <i className="dashed" /> Forecast
          </span>
        )}
        {reference !== null && (
          <span>
            <i className="explored-line" /> Explored level
          </span>
        )}
        <span className="chart-unit">
          {unit}
          {issued ? " · NOAA / NWS" : ""}
        </span>
      </div>
      {cursor === undefined && (
        <ChartInspector
          samples={samples}
          index={
            inspection === null
              ? null
              : Math.min(inspection, samples.length - 1)
          }
          onChange={setInspection}
          unit={unit}
          issued={issued}
          sourceLabel={sourceLabel}
        />
      )}
    </div>
  );
}
