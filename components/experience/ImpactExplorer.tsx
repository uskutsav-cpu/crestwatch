"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Info,
  RotateCcw,
  ArrowRight,
  Check,
  Link as LinkIcon,
} from "lucide-react";
import { impactContext, type RiverImpact } from "@/lib/impacts";
import { thresholdForecast, nearestImpact } from "@/lib/threshold-forecast";
import type { SeriesPoint } from "@/lib/gauges";
import { STATIONS, isFresh } from "@/lib/river-stations";
const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(iso));
export function ImpactExplorer({
  notes,
  lid,
  city,
  forecast,
  issued,
  observed,
  observedAt,
  value: onLevel,
  onChange,
  now,
}: {
  notes: RiverImpact[];
  lid: string;
  city: string;
  forecast: SeriesPoint[];
  issued: string | null;
  observed: number | null;
  observedAt: string | null;
  value: number | null;
  onChange: (value: number | null) => void;
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  if (!notes.length) return null;
  const official = thresholdForecast(forecast, issued, notes[0].stage, now);
  const base = official.high?.stageFt ?? notes[0].stage;
  const value = onLevel ?? base;
  const hypothetical = onLevel !== null || !official.high;
  const context = impactContext(value, notes);
  const note = nearestImpact(value, notes)!;
  const comparison = thresholdForecast(forecast, issued, note.stage, now);
  const filtered = notes.filter((n) =>
    n.statement.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const max = Math.ceil(
    Math.max(...notes.map((n) => n.stage), base, value, observed ?? 0) + 2,
  );
  const min = Math.min(0, Math.floor(Math.min(base, value, observed ?? 0)));
  const percent = (n: number) => ((n - min) / (max - min)) * 100;
  const recentObserved = observed !== null && isFresh(observedAt, 2, now);
  const shown = query.trim() ? filtered : expanded ? notes : [note];
  function choose(n: number) {
    onChange(n);
    setCopied(false);
  }
  async function share() {
    const url = new URL("/", window.location.origin);
    url.search = "";
    url.searchParams.set("station", lid);
    url.searchParams.set("level", value.toFixed(1));
    url.hash = "impact-explorer";
    if (window.location.pathname === "/")
      window.history.replaceState(null, "", url.toString());
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <section
      className="impact-explorer connected-explorer"
      id="impact-explorer"
      aria-labelledby="impact-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE LEVEL → THE LOCAL CONTEXT</span>
          <h2 id="impact-title">Put a river level in perspective.</h2>
        </div>
        <span className="workbench-station">
          {city} <span>{lid}</span>
        </span>
      </div>
      <p className="impact-intro">
        Compare the official forecast with the Weather Service’s published
        impact thresholds. Choose a level to see the documented context near
        this gauge.
      </p>
      <div className="impact-workbench">
        <div className="level-study">
          <div className="level-study-top">
            <span className="small-label">FEET ON THIS GAUGE</span>
            <span className="small-label">
              {min}–{max} FT
            </span>
          </div>
          <div
            className="level-columns"
            role="img"
            aria-label={`Gauge level comparison. ${recentObserved ? `Observed ${observed?.toFixed(1)} feet.` : "Recent observation unavailable."} ${official.high ? `Forecast high ${official.high.stageFt.toFixed(1)} feet.` : "Current forecast high unavailable."} Explored level ${value.toFixed(1)} feet. This diagram shows gauge stage, not water depth at a property.`}
          >
            {[0.25, 0.5, 0.75, 1].map((t) => (
              <div
                className="level-grid"
                key={t}
                style={{ bottom: `${t * 100}%` }}
              >
                <span>{Math.round(min + (max - min) * t)}</span>
              </div>
            ))}
            {notes.map((n, i) => (
              <div
                key={i}
                className="level-threshold"
                style={{ bottom: `${percent(n.stage)}%` }}
              />
            ))}
            <div
              className="level-bar observed"
              style={{
                height: recentObserved
                  ? `${Math.max(1, percent(observed!))}%`
                  : "0%",
              }}
            >
              <span>{recentObserved ? observed!.toFixed(1) : "—"}</span>
            </div>
            <div
              className="level-bar forecast"
              style={{
                height: official.high
                  ? `${Math.max(1, percent(official.high.stageFt))}%`
                  : "0%",
              }}
            >
              <span>
                {official.high ? official.high.stageFt.toFixed(1) : "—"}
              </span>
            </div>
            <div
              className="level-bar explored"
              style={{ height: `${Math.max(1, percent(value))}%` }}
            >
              <span>{value.toFixed(1)}</span>
            </div>
          </div>
          <div className="level-bar-labels">
            <span>
              Observed
              <small>
                {recentObserved ? "Recent reading" : "Unavailable / older"}
              </small>
            </span>
            <span>
              Forecast high
              <small>
                {official.high ? "Official NOAA" : "Unavailable / older"}
              </small>
            </span>
            <span>
              Explore
              <small>{hypothetical ? "What-if level" : "Forecast level"}</small>
            </span>
          </div>
          <p className="level-diagram-note">
            Horizontal marks are published impact thresholds.
            <br />
            Gauge stage is not flood depth at a home.
          </p>
        </div>
        <div className="threshold-story">
          <span className={`status-label ${hypothetical ? "warning" : ""}`}>
            {hypothetical
              ? "WHAT-IF · NOT A FORECAST"
              : "OFFICIAL FORECAST HIGH"}
          </span>
          <div className="explore-reading">
            {value.toFixed(1)}
            <span>ft</span>
          </div>
          <label htmlFor={`impact-slider-${lid}`}>Explore a river level</label>
          <input
            id={`impact-slider-${lid}`}
            aria-label="Explore official impact thresholds"
            aria-valuetext={`${value.toFixed(1)} feet on ${city} gauge, ${hypothetical ? "hypothetical level" : "official forecast high"}`}
            type="range"
            min={min}
            max={max}
            step=".1"
            value={value}
            onChange={(e) => choose(Number(e.target.value))}
          />
          <div className="impact-range">
            <span>{min} ft</span>
            <span>{max} ft</span>
          </div>
          <div className="threshold-verdict" aria-live="polite">
            <strong>
              {context.reached.length
                ? `${context.reached.length} published threshold${context.reached.length === 1 ? "" : "s"} at or below this level`
                : "Below the first published impact threshold"}
            </strong>
            <p>
              {context.next
                ? `Next published threshold: ${context.next.stage} ft, ${(context.next.stage - value).toFixed(1)} ft above this level.`
                : "This reaches the highest published threshold in this list."}{" "}
              Missing notes do not mean no flooding.
            </p>
          </div>
          <div className="forecast-comparison">
            <span className="small-label">
              FORECAST VS. {note.stage} FT THRESHOLD
            </span>
            <p>
              {comparison.status === "reached" ? (
                <>
                  First future forecast sample at or above this threshold:{" "}
                  <strong>{dateLabel(comparison.first!.t)}</strong>.
                </>
              ) : comparison.status === "below" ? (
                <>
                  The official forecast stays below this threshold through{" "}
                  <strong>{dateLabel(comparison.end!)}</strong>.
                </>
              ) : comparison.status === "older" ? (
                "The forecast issue time is older or unavailable. A current comparison cannot be made."
              ) : (
                "No future forecast samples are available for this comparison."
              )}
            </p>
            {comparison.status === "reached" && (
              <small>
                Sample timing is not the onset time of local flooding.
              </small>
            )}
          </div>
          <div className="explore-actions">
            <button
              className="secondary-button"
              onClick={() => {
                onChange(null);
                setQuery("");
                setCopied(false);
              }}
            >
              <RotateCcw size={14} /> Reset to forecast
            </button>
            {STATIONS.some((s) => s.lid === lid) && (
              <button className="text-button" onClick={share}>
                {copied ? <Check size={14} /> : <LinkIcon size={14} />}{" "}
                {copied ? "Link copied" : "Share this level"}
              </button>
            )}
          </div>
          {copyError && (
            <p className="inline-warning" role="status">
              Clipboard unavailable. Open the live Rivers page to share a level
              from its address bar.
            </p>
          )}
          <a className="timeline-jump" href="#river-timeline">
            See this level on the forecast timeline <ArrowRight size={15} />
          </a>
        </div>
      </div>
      <div className="threshold-browser">
        <div className="threshold-browser-heading">
          <div>
            <span className="eyebrow">
              PUBLISHED IMPACTS · {notes.length} THRESHOLDS
            </span>
            <h3>Choose a threshold. Read the local story.</h3>
          </div>
          <a
            href={`https://water.noaa.gov/gauges/${lid}`}
            target="_blank"
            rel="noreferrer"
          >
            NOAA / NWS source <ArrowUpRight size={14} />
          </a>
        </div>
        <div
          className="threshold-chips"
          role="group"
          aria-label="Choose an official impact threshold"
        >
          {notes.map((n, i) => (
            <button
              key={i}
              onClick={() => choose(n.stage)}
              aria-pressed={n === note}
              className={n === note ? "selected" : ""}
            >
              {n.stage}
              <small>ft</small>
            </button>
          ))}
        </div>
        <div className="impact-search">
          <input
            type="search"
            aria-label="Search official impact notes"
            placeholder="Search a road, neighborhood, or landmark"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="text-button" onClick={() => setQuery("")}>
              Clear search
            </button>
          )}
        </div>
        <div className="impact-notes">
          {shown.length ? (
            shown.map((n, i) => (
              <div
                className={`impact-note ${n.stage <= value ? "threshold-reached" : ""}`}
                key={`${n.stage}-${i}`}
              >
                <button
                  className="impact-note-stage"
                  onClick={() => choose(n.stage)}
                  aria-label={`Explore ${n.stage} foot threshold`}
                >
                  {n.stage}
                  <small> ft</small>
                  <i>{n.stage <= value ? "AT OR BELOW" : "ABOVE LEVEL"}</i>
                </button>
                <p>{n.statement}</p>
              </div>
            ))
          ) : (
            <p className="muted small">
              No published impact note matches that search.
            </p>
          )}
        </div>
        {!query && (
          <button
            className="text-button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? "Show selected threshold"
              : `Explore all ${notes.length} official notes`}
          </button>
        )}
      </div>
      <p className="chart-context">
        <Info size={14} /> These are official descriptions near the gauge, not a
        live road-closure feed or a prediction for a specific property.
        Forecasts change; check the source before acting.
      </p>
    </section>
  );
}
