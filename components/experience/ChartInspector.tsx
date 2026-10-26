"use client";
import { Download } from "lucide-react";
import type { SeriesPoint } from "@/lib/gauges";
import { makeCsv } from "@/lib/csv";
import { downloadText } from "@/lib/download";
export interface ChartSample extends SeriesPoint {
  kind: "Observed" | "Forecast";
}
export function ChartInspector({
  samples,
  index,
  onChange,
  unit,
  issued,
  sourceLabel,
}: {
  samples: ChartSample[];
  index: number | null;
  onChange: (n: number | null) => void;
  unit: string;
  issued?: string | null;
  sourceLabel: string;
}) {
  const selected = samples[Math.min(index ?? 0, samples.length - 1)];
  const label = (t: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(t)
      ? new Intl.DateTimeFormat("en-US", {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(new Date(t + "T12:00:00Z"))
      : new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Chicago",
          timeZoneName: "short",
        }).format(new Date(t));
  function download() {
    downloadText(
      "crestwatch-plotted-readings.csv",
      makeCsv(
        [
          "gauge",
          "series",
          "timestamp_or_date",
          "stage_ft",
          "unit",
          "forecast_issued_utc",
        ],
        samples.map((p) => [
          sourceLabel,
          p.kind,
          p.t,
          p.stageFt,
          unit,
          p.kind === "Forecast" ? (issued ?? "") : "",
        ]),
      ),
      "text/csv",
    );
  }
  return (
    <details
      className="chart-inspector"
      open={index !== null}
      onToggle={(e) => {
        if (!e.currentTarget.open) onChange(null);
        else if (index === null)
          onChange(
            Math.max(
              0,
              samples.findLastIndex((p) => p.kind === "Observed"),
            ),
          );
      }}
    >
      <summary>
        Inspect readings & download data
        <span>Tap the chart or use the slider</span>
      </summary>
      <div className="inspector-body">
        <div className="inspector-reading">
          <span className={`sample-kind ${selected.kind.toLowerCase()}`}>
            {selected.kind}
          </span>
          <strong>
            {selected.stageFt.toFixed(2)} <small>{unit}</small>
          </strong>
          <time>{label(selected.t)}</time>
        </div>
        <input
          aria-label="Inspect timeline samples"
          aria-valuetext={`${selected.kind}, ${label(selected.t)}, ${selected.stageFt.toFixed(2)} ${unit}`}
          type="range"
          min="0"
          max={samples.length - 1}
          value={index ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="inspector-footer">
          <span>
            Sample {(index ?? 0) + 1} of {samples.length} · {sourceLabel} ·
            original timestamps retained
          </span>
          <button className="text-button" onClick={download}>
            <Download size={13} /> Download plotted data
          </button>
        </div>
        <p>
          These values describe the gauge. Forecast samples are predictions;
          they are not measurements or property flood depths.
        </p>
      </div>
    </details>
  );
}
