"use client";
import { useSearchParams } from "next/navigation";
import { historyPoints, replayEventId } from "@/lib/history-records";
import { useEffect, useMemo, useState } from "react";
import { Play, Pause, ArrowUpRight, SkipForward, ArrowRight, ChevronLeft, ChevronRight, Download, RotateCcw, Waves, ChartNoAxesCombined } from "lucide-react";
import { SiteLink as Link } from "./SiteLink";
import { StageChart } from "./StageChart";
import { ReplayWaterScene } from "./ReplayWaterScene";
import { REPLAY_EVENTS } from "@/lib/config";
import { replaySummary } from "@/lib/replay-summary";
import { downloadText } from "@/lib/download";
import { makeCsv } from "@/lib/csv";

const formatDate = (date: string, short = false) => new Intl.DateTimeFormat("en-US", {
  month: short ? "short" : "long", day: "numeric", year: "numeric", timeZone: "UTC",
}).format(new Date(date + "T12:00:00Z"));

export function RiverReplay() {
  const search = useSearchParams();
  const eventParam = search.get("event");
  const [eventId, setEventId] = useState(replayEventId(eventParam));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState("scene");
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { setEventId(replayEventId(eventParam)); setIdx(0); setPlaying(false); }, [eventParam]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
    update(); media.addEventListener("change", update);
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", hide);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", hide); };
  }, []);
  const event = REPLAY_EVENTS.find(e => e.id === eventId)!;
  const points = useMemo(() => historyPoints(eventId), [eventId]);
  const summary = useMemo(() => replaySummary(points, eventId === "backwater2019" ? null : 28), [points, eventId]);
  const peak = summary.peak!;
  const peakIdx = points.findIndex(p => p.t === peak.t);
  const at = Math.min(idx, points.length - 1);
  const point = points[at];
  const pearl = eventId !== "backwater2019";
  const floodStage = pearl ? 28 : null;
  const isPlaying = playing && at < points.length - 1 && !reducedMotion;
  const low = Math.floor((Math.min(...points.map(p => p.stageFt), floodStage ?? Infinity) - 2) / 5) * 5;
  const high = Math.ceil((peak.stageFt + 3) / 5) * 5;
  const phase = at === peakIdx ? "Highest daily mean" : at < peakIdx ? "Before the high point" : "After the high point";
  useEffect(() => {
    if (!isPlaying) return;
    // Each full record takes about 16 seconds at 1×; every recorded sample is visited.
    const timer = window.setInterval(() => setIdx(i => Math.min(i + 1, points.length - 1)), Math.max(20, 16000 / (points.length - 1) / speed));
    return () => window.clearInterval(timer);
  }, [isPlaying, points.length, speed]);
  function seek(index: number) { setPlaying(false); setIdx(index); }
  function change(id: string) {
    seek(0); setEventId(id);
    const url = new URL(window.location.href); url.searchParams.set("event", id);
    window.history.replaceState(null, "", url.toString());
  }
  function togglePlay() {
    if (reducedMotion) { seek(peakIdx); return; }
    if (isPlaying) setPlaying(false);
    else { if (at === points.length - 1) setIdx(0); setPlaying(true); }
  }
  return <div className="replay-page page-enter">
    <div className="page-title replay-title"><div className="eyebrow">THE HISTORICAL RECORD</div>
      <h1>Replay a real flood.<br/><em>Watch the river rise.</em></h1>
      <p>Three Mississippi floods. Recorded USGS daily readings. Play the sequence or explore it one reading at a time.</p>
    </div>
    <div className="event-tabs" role="group" aria-label="Choose a historical flood">{REPLAY_EVENTS.map(e => <button onClick={() => change(e.id)} className={e.id === eventId ? "active" : ""} aria-pressed={e.id === eventId} key={e.id}>
      <span>{e.startDT.slice(0,4)}</span>{e.id === "backwater2019" ? "Yazoo Backwater" : e.id === "pearl2020" ? "Pearl River · February" : "Pearl River · August"}<ArrowUpRight size={15}/>
    </button>)}</div>
    <section className="replay-stage" aria-label="Historical river playback">
      <div className="replay-top"><span className="eyebrow">USGS {event.usgsSite} · HISTORICAL DAILY MEANS</span><span>{event.gaugeName}</span></div>
      <div className="replay-numbers"><div><time className="eyebrow" dateTime={point.t}>{formatDate(point.t)}</time><div className="replay-big">{point.stageFt.toFixed(2)}<span>ft</span></div><p>{pearl ? "Stage on the Jackson gauge" : "Elevation referenced to NGVD29"}</p></div>
        <div className="replay-high"><span>RECORD HIGH · DAILY MEAN</span><strong>{peak.stageFt.toFixed(2)} <small>ft</small></strong><p>{formatDate(peak.t,true)}</p></div></div>
      <div className="replay-view-bar"><span className="replay-phase"><i/>{phase}</span><div className="replay-view-switch" role="group" aria-label="Replay view"><button aria-pressed={view === "scene"} onClick={() => setView("scene")}><Waves size={15}/>River view</button><button aria-pressed={view === "chart"} onClick={() => setView("chart")}><ChartNoAxesCombined size={15}/>Chart view</button></div></div>
      {view === "scene" ? <ReplayWaterScene level={point.stageFt} low={low} high={high} peak={peak.stageFt} floodStage={floodStage} playing={isPlaying}/> : <StageChart observed={points} floodStage={floodStage} cursor={at} unit={pearl ? "feet on gauge · daily means" : "NGVD29 feet · daily means"}/>}
      <div className="replay-transport"><button className="primary-button" onClick={togglePlay}>{isPlaying ? <Pause size={16}/> : <Play size={16}/>} {reducedMotion ? "Show high point" : isPlaying ? "Pause" : at === points.length - 1 ? "Play again" : "Play the flood"}</button>
        <button className="replay-restart" aria-label="Restart record" onClick={() => seek(0)}><RotateCcw size={16}/></button>
        <label className="replay-speed">Speed<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))} disabled={reducedMotion}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
        <button className="text-button replay-peak" onClick={() => seek(peakIdx)}><SkipForward size={15}/>Jump to high point</button>
      </div>
      <div className="replay-scrubber"><input aria-label="Historical river timeline" aria-valuetext={`${formatDate(point.t)}, ${point.stageFt.toFixed(2)} feet`} type="range" min="0" max={points.length-1} value={at} onChange={e => seek(Number(e.target.value))}/><div className="timeline-dates"><span>{formatDate(points[0].t,true)}</span><span>{formatDate(points.at(-1)!.t,true)}</span></div></div>
      <div className="replay-day-controls"><button className="text-button" disabled={at === 0} onClick={() => seek(at-1)}><ChevronLeft size={16}/>Previous reading</button><span>Reading {at+1} of {points.length}</span><button className="text-button" disabled={at === points.length-1} onClick={() => seek(at+1)}>Next reading<ChevronRight size={16}/></button></div>
      {reducedMotion && <p className="replay-record-quality">Reduced motion is on. Use the timeline, reading buttons, or milestones to explore.</p>}
      <div className="replay-milestones">{summary.firstAbove && <button onClick={() => seek(points.findIndex(p => p.t === summary.firstAbove!.t))}><span>FIRST DAILY MEAN ≥ {floodStage} FT</span><strong>{formatDate(summary.firstAbove.t,true)}</strong></button>}<button onClick={() => seek(peakIdx)}><span>HIGHEST DAILY MEAN</span><strong>{formatDate(peak.t,true)}</strong></button>{summary.lastAbove && <button onClick={() => seek(points.findIndex(p => p.t === summary.lastAbove!.t))}><span>LAST DAILY MEAN ≥ {floodStage} FT</span><strong>{formatDate(summary.lastAbove.t,true)}</strong></button>}</div>
    </section>
    <div className="replay-summary-strip"><div><strong>{summary.samples}</strong><span>recorded daily readings</span></div><div><strong>{summary.missingDays}</strong><span>missing calendar {summary.missingDays === 1 ? "day" : "days"}</span></div><div><strong>{summary.samplesAbove ?? "NGVD29"}</strong><span>{pearl ? "readings at or above 28 ft" : "vertical reference · feet"}</span></div></div>
    <details className="replay-source-details"><summary>About this record & downloads <Download size={16}/></summary><div>
      <p>Daily means smooth short peaks; the highest daily mean can differ from the official instantaneous crest. Missing dates are skipped during playback and appear as gaps in the chart.</p>
      <p>The river view illustrates the gauge scale. It does not show actual terrain, water depth at a home, or which roads flooded. Readings from different gauges or vertical references cannot be compared directly.</p>
      <div className="action-row"><a href={`https://waterdata.usgs.gov/monitoring-location/${event.usgsSite}/`} target="_blank" rel="noreferrer" className="secondary-button">USGS station<ArrowUpRight size={14}/></a><button className="text-button" onClick={() => downloadText(`crestwatch-${eventId}-daily-means.csv`,makeCsv(["usgs_station","date","daily_mean_ft","reference"],points.map(p => [event.usgsSite,p.t,p.stageFt,pearl ? "feet on Jackson gauge" : "NGVD29 feet"])),"text/csv")}><Download size={14}/>Download daily readings</button><Link href="/methodology" className="text-button">Sources & methods<ArrowRight size={14}/></Link></div>
    </div></details>
    <Link className="return-live" href="/"><span className="live-dot"/><strong>Back to live rivers</strong><ArrowRight size={16}/></Link>
  </div>;
}
