"use client";
import { useSearchParams } from "next/navigation";
import { historyPoints, replayEventId } from "@/lib/history-records";
import { useEffect, useMemo, useState } from "react";
import {
  History,
  Play,
  Pause,
  ArrowUpRight,
  SkipForward,
  Info,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { SiteLink as Link } from "@/components/experience/SiteLink";
import { StageChart } from "./StageChart";
import { REPLAY_EVENTS } from "@/lib/config";
import { replaySummary } from "@/lib/replay-summary";
import { downloadText } from "@/lib/download";
import { makeCsv } from "@/lib/csv";
export function RiverReplay() {
  const search = useSearchParams();
  const eventParam = search.get("event");
  const [eventId, setEventId] = useState(replayEventId(eventParam));
  useEffect(() => { setEventId(replayEventId(eventParam)); setIdx(0); setPlaying(false); }, [eventParam]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const event = REPLAY_EVENTS.find((e) => e.id === eventId)!;
  const points = useMemo(() => historyPoints(eventId), [eventId]);
  const max = points.reduce((a, b) => (a.stageFt > b.stageFt ? a : b));
  const peakIdx = points.indexOf(max);
  const point = points[Math.min(idx, points.length - 1)];
  const pearl = eventId !== "backwater2019";
  const floodStage = pearl ? 28 : null;
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(point.t + "T12:00:00Z"));
  const summary = replaySummary(points, floodStage);
  const daysAbove = summary.samplesAbove;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () =>
        setIdx((i) => {
          if (i >= points.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      500,
    );
    return () => clearInterval(id);
  }, [playing, points.length]);
  function change(id: string) {
    setPlaying(false);
    setEventId(id);
    setIdx(0);
    const url = new URL(window.location.href);
    url.searchParams.set("event", id);
    window.history.replaceState(null, "", url.toString());
  }
  return (
    <div className="replay-page page-enter">
      <div className="page-title">
        <div className="eyebrow">THE RIVER HAS A MEMORY</div>
        <h1>
          Look back.
          <br />
          <em>Understand what’s ahead.</em>
        </h1>
        <p>
          Follow real, recorded USGS river readings through three Mississippi
          floods. A way to understand the river’s behavior, one day at a time.
        </p>
      </div>
      <div
        className="event-tabs"
        role="group"
        aria-label="Choose a historical flood"
      >
        {REPLAY_EVENTS.map((e) => (
          <button
            onClick={() => change(e.id)}
            className={e.id === eventId ? "active" : ""}
            aria-pressed={e.id === eventId}
            key={e.id}
          >
            <span>
              {e.id === "backwater2019"
                ? "2019"
                : e.id === "pearl2020"
                  ? "2020"
                  : "2022"}
            </span>
            {e.id === "backwater2019"
              ? "Yazoo Backwater"
              : e.id === "pearl2020"
                ? "Pearl River · February"
                : "Pearl River · August"}
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
      <section className="replay-stage">
        <div className="replay-top">
          <span className="eyebrow">
            <History size={14} /> HISTORICAL RECORD · NOT A LIVE FORECAST
          </span>
          <span>{event.gaugeName}</span>
        </div>
        <div className="replay-numbers">
          <div>
            <span className="eyebrow">{date.toUpperCase()}</span>
            <div className="replay-big">
              {point.stageFt.toFixed(1)}
              <span>ft</span>
            </div>
            <p>
              {pearl
                ? "Stage on the Jackson gauge"
                : "Gauge reading referenced to NGVD29"}
            </p>
          </div>
          <div className="replay-high">
            <span>HIGHEST DAILY MEAN IN THIS RECORD</span>
            <strong>
              {max.stageFt.toFixed(2)} <small>ft</small>
            </strong>
            <p>
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date(max.t + "T12:00:00Z"))}
              {pearl ? " · flood stage 28 ft" : ""}
            </p>
          </div>
        </div>
        <StageChart
          observed={points}
          floodStage={floodStage}
          cursor={idx}
          unit={
            pearl ? "feet on gauge · daily means" : "NGVD29 feet · daily means"
          }
        />
        <div className="replay-controls">
          <button
            className="primary-button"
            onClick={() => {
              if (
                !playing &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ) {
                setIdx(peakIdx);
                return;
              }
              if (idx === points.length - 1) setIdx(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
            {playing ? "Pause" : "Play the record"}
          </button>
          <input
            aria-label="Historical river timeline"
            aria-valuetext={`${date}, ${point.stageFt.toFixed(1)} feet`}
            type="range"
            min="0"
            max={points.length - 1}
            value={idx}
            onChange={(e) => {
              setPlaying(false);
              setIdx(Number(e.target.value));
            }}
          />
          <button
            className="secondary-button"
            onClick={() => {
              setPlaying(false);
              setIdx(peakIdx);
            }}
          >
            <SkipForward size={15} /> Jump to high point
          </button>
        </div>
        <div className="replay-day-controls">
          <button
            className="text-button"
            disabled={idx === 0}
            onClick={() => {
              setPlaying(false);
              setIdx((i) => Math.max(0, i - 1));
            }}
          >
            <ChevronLeft size={16} /> Previous reading
          </button>
          <span>
            Reading {idx + 1} of {points.length}
          </span>
          <button
            className="text-button"
            disabled={idx === points.length - 1}
            onClick={() => {
              setPlaying(false);
              setIdx((i) => Math.min(points.length - 1, i + 1));
            }}
          >
            Next reading <ChevronRight size={16} />
          </button>
        </div>
        <div className="replay-milestones">
          {summary.firstAbove && (
            <button
              onClick={() => {
                setPlaying(false);
                setIdx(points.findIndex((p) => p.t === summary.firstAbove!.t));
              }}
            >
              <span>FIRST DAILY MEAN ≥ {floodStage} FT</span>
              <strong>{summary.firstAbove.t}</strong>
            </button>
          )}
          <button
            onClick={() => {
              setPlaying(false);
              setIdx(peakIdx);
            }}
          >
            <span>HIGHEST DAILY MEAN</span>
            <strong>{max.t}</strong>
          </button>
          {summary.lastAbove && (
            <button
              onClick={() => {
                setPlaying(false);
                setIdx(points.findIndex((p) => p.t === summary.lastAbove!.t));
              }}
            >
              <span>LAST DAILY MEAN ≥ {floodStage} FT</span>
              <strong>{summary.lastAbove.t}</strong>
            </button>
          )}
        </div>
        <p className="replay-record-quality">
          {summary.samples} dated observations · {summary.missingDays} missing
          calendar day{summary.missingDays === 1 ? "" : "s"} within this
          record’s span. Missing dates are shown as gaps.
        </p>
        <button
          className="text-button"
          onClick={() =>
            downloadText(
              `crestwatch-${eventId}-daily-means.csv`,
              makeCsv(
                ["usgs_station", "date", "daily_mean_ft", "reference"],
                points.map((p) => [
                  event.usgsSite,
                  p.t,
                  p.stageFt,
                  pearl ? "feet on Jackson gauge" : "NGVD29 feet",
                ]),
              ),
              "text/csv",
            )
          }
        >
          <Download size={14} /> Download this historical record
        </button>
        <div className="timeline-dates">
          <span>{points[0].t}</span>
          <span>{points.at(-1)!.t}</span>
        </div>
      </section>
      <div className="replay-facts">
        <div>
          <span className="eyebrow">
            {pearl
              ? "READINGS AT OR ABOVE FLOOD STAGE"
              : "DAYS OF OBSERVATIONS"}
          </span>
          <strong>
            {daysAbove ?? points.length}
            <small> daily readings</small>
          </strong>
          <p>
            {pearl
              ? "Daily mean readings at or above 28 ft at the Jackson gauge."
              : "A record of a slow, prolonged flood season."}
          </p>
        </div>
        <div>
          <span className="eyebrow">READ THE WHOLE STORY</span>
          <h2>A flood is more than its crest.</h2>
          <p>
            How long the river stays high matters, too. Scrub the timeline to
            see the rise, the high point, and the slow return. Daily means
            smooth short-lived peaks, so this chart’s high may differ from the
            official instantaneous crest.
          </p>
        </div>
      </div>
      <div className="notice">
        <Info size={18} />
        <p>
          <strong>This record describes the gauge, not a property.</strong> It
          does not reconstruct which buildings or roads flooded. Levees,
          backwater, drainage, and local terrain affect actual inundation.
          Elevations from different gauges or vertical references cannot be
          compared directly.
        </p>
      </div>
      <div className="action-row">
        <a
          href={`https://waterdata.usgs.gov/monitoring-location/${event.usgsSite}/`}
          target="_blank"
          rel="noreferrer"
          className="secondary-button"
        >
          Explore the USGS station <ArrowUpRight size={14} />
        </a>
        <Link href="/methodology" className="text-button">
          How to read this record <ArrowRight size={14} />
        </Link>
      </div>
      <Link className="return-live" href="/">
        <span className="live-dot" /> Ready for today’s picture?{" "}
        <strong>Back to live rivers</strong>
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
