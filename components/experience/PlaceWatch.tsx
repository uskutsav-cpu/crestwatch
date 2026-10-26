"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteLink as Link } from "@/components/experience/SiteLink";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  RefreshCw,
  Info,
  ShieldCheck,
  Share2,
  Volume2,
  VolumeX,
  Bookmark,
  Check,
  ExternalLink,
} from "lucide-react";
import { decodeWatchLink, encodeWatchLink } from "@/lib/watch-link";
import { useWatches } from "@/lib/use-watch";
import { addPin, newPinId, loadPins } from "@/lib/pin-store";
import type { Pin } from "@/lib/pins";
import { STATIONS, isFresh, timeLabel } from "@/lib/river-stations";
import { ImpactExplorer } from "./ImpactExplorer";
import { StageChart } from "./StageChart";
import { RiverMap } from "./RiverMap";
const EMPTY: Pin[] = [];
export function PlaceWatch() {
  const params = useSearchParams();
  const wl = params.get("wl");
  const linked = useMemo(
    () => (wl === null ? null : (decodeWatchLink(wl) ?? EMPTY)),
    [wl],
  );
  const broken = wl !== null && linked === EMPTY;
  const { pins, watches, loading, error, refresh, fromSaved, updatedAt } =
    useWatches(linked);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    setCanSpeak("speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  const [whatIf, setWhatIf] = useState<number | null>(null);
  const pin =
    pins.find((p) => p.id === (selected ?? params.get("pin"))) ?? pins[0];
  const w = watches.find((w) => w.pinId === pin?.id);
  const g = w?.gauge;
  const [impactLevel, setImpactLevel] = useState<number | null>(null);
  useEffect(() => setImpactLevel(null), [g?.lid]);
  const observed =
    g?.observed.slice().sort((a, b) => Date.parse(a.t) - Date.parse(b.t)) ?? [];
  const last = observed.at(-1);
  const fresh = !!last && isFresh(last.t) && !error;
  const fcFresh = isFresh(g?.forecastIssued, 24) && !error;
  const future = g?.forecast.filter((p) => Date.parse(p.t) > Date.now()) ?? [];
  const peak = future.length
    ? future.reduce((a, b) => (a.stageFt >= b.stageFt ? a : b))
    : null;
  const stage = g?.categories.minor;
  const sameDatum =
    g?.gaugeDatum?.toUpperCase().replace(/\s/g, "") === "NAVD88";
  const canCompare =
    sameDatum &&
    g?.gaugeZeroFt != null &&
    pin &&
    pin.elevationFt !== null &&
    !pin.approximate &&
    fcFresh &&
    peak;
  const margin =
    canCompare && pin.elevationFt !== null
      ? pin.elevationFt - (g!.gaugeZeroFt! + (whatIf ?? peak!.stageFt))
      : null;
  const category =
    !peak || !fcFresh
      ? "Forecast unavailable"
      : stage == null
        ? "Flood stage unknown"
        : peak.stageFt < stage
          ? "Below flood stage"
          : "Flood stage reached";
  const brief = pin
    ? `${g?.name ?? "Nearby river"}: ${last ? `the latest reading is ${last.stageFt.toFixed(1)} feet on the gauge` : "no recent reading is available"}. ${fcFresh && peak ? `The official forecast high is ${peak.stageFt.toFixed(1)} feet.` : "The forecast is unavailable or older."} This is river context for ${pin.name}, not a prediction of flooding at this property. ${error ? "The latest refresh failed." : ""}`
    : "";
  async function share() {
    const text = `${brief}\n${window.location.origin}/watch?wl=${encodeWatchLink(pins)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this briefing and link", text);
    }
  }
  function speak() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(brief);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }
  if (broken)
    return (
      <div className="empty-state">
        <Info size={32} />
        <h2>This link needs another look.</h2>
        <p>The shared location data could not be read.</p>
        <Link href="/" className="primary-button">
          Check your own place <ArrowRight size={16} />
        </Link>
      </div>
    );
  if (!loading && !pin)
    return (
      <div className="empty-state">
        <MapPin size={35} />
        <h2>Your places start here.</h2>
        <p>
          Add a home, a school, or a place you care about to keep nearby river
          information close.
        </p>
        <Link href="/#find-place" className="primary-button">
          Find a place <ArrowRight size={16} />
        </Link>
      </div>
    );
  if (!pin || (!w && loading))
    return (
      <div className="loading-brief">
        <span className="live-dot" />
        <h2>Getting your river briefing.</h2>
        <p>Checking the official forecast, river readings, and local alerts.</p>
      </div>
    );
  return (
    <div className="place-watch page-enter">
      <Link href="/places" className="back-link">
        <ArrowLeft size={14} /> My places
      </Link>
      <div className="page-title">
        <div className="eyebrow">YOUR PLACE, IN CONTEXT</div>
        <h1>{pin.name}</h1>
        <p>
          <MapPin size={14} />
          {pin.matchedAddress}
        </p>
        {pin.approximate && (
          <span className="status-label warning">Approximate location</span>
        )}
      </div>
      {pins.length > 1 && (
        <div className="place-tabs" role="group" aria-label="Choose a place">
          {pins.map((p) => (
            <button
              key={p.id}
              className={pin.id === p.id ? "active" : ""}
              onClick={() => {
                setSelected(p.id);
                setWhatIf(null);
              }}
            >
              <MapPin size={13} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      {params.get("ex") === "1" && (
        <div className="example-banner">
          <span className="status-label">LIVE EXAMPLE</span>
          <p>
            Two public places in Vicksburg. Actual river data, no locations
            saved.
          </p>
          <Link href="/#find-place">
            Try your place <ArrowRight size={13} />
          </Link>
        </div>
      )}
      {(error || fromSaved) && (
        <div className="notice amber" role="status">
          <Info size={18} />
          <p>
            The latest check failed.{" "}
            {updatedAt
              ? `Showing the saved answer from ${timeLabel(new Date(updatedAt).toISOString())}.`
              : "No current answer is available."}{" "}
            Treat the information below as older.
          </p>
        </div>
      )}
      {pin.elevationFt === null && (
        <div className="notice amber">
          <Info size={18} />
          <p>
            Ground height is unavailable for this saved point. The nearby river
            forecast and official alerts can still be read. No ground estimate
            or elevation comparison is shown.
          </p>
        </div>
      )}
      <div className="place-lead-grid">
        <div className="place-lead">
          <span className="eyebrow">NEARBY RIVER BRIEFING</span>
          <h2>{g?.name ?? "No forecast gauge found nearby"}</h2>
          <div className="place-stage">
            {last ? last.stageFt.toFixed(1) : "—"}
            <span>ft on the gauge</span>
          </div>
          <span className={`status-label ${fresh ? "" : "warning"}`}>
            <i />
            {fresh ? "Recent reading" : "Current reading unavailable"}
            {last ? ` · ${timeLabel(last.t)}` : ""}
          </span>
          <div className="place-stat-row">
            <div>
              <span>OFFICIAL FORECAST HIGH</span>
              <strong>
                {fcFresh && peak
                  ? `${peak.stageFt.toFixed(1)} ft`
                  : "Unavailable"}
              </strong>
            </div>
            <div>
              <span>OFFICIAL FLOOD STAGE</span>
              <strong>{stage != null ? `${stage} ft` : "Unpublished"}</strong>
            </div>
          </div>
          <p className="plain-brief">
            {fcFresh && peak && stage != null
              ? `The forecast ${peak.stageFt < stage ? "stays below" : "reaches or exceeds"} flood stage at this gauge. This does not establish whether your property or local roads will flood.`
              : "There isn’t enough current forecast information to describe the river outlook. Check the official forecast and local alerts."}
          </p>
          <div className="action-row">
            <button
              className="secondary-button"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              {loading ? "Checking" : "Check again"}
            </button>
            {g && (
              <a
                className="text-button"
                href={`https://water.noaa.gov/gauges/${g.lid}`}
                target="_blank"
                rel="noreferrer"
              >
                Official forecast <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </div>
        <RiverMap point={{ lat: pin.lat, lon: pin.lon }} compact />
      </div>
      <div className="notice">
        <Info size={18} />
        <p>
          <strong>Nearby does not mean connected.</strong>{" "}
          {g
            ? `This gauge is ${g.distanceMi.toFixed(1)} miles away, selected by distance. `
            : ""}
          CrestWatch has not verified the waterway connection, levees,
          floodwalls, or local drainage for this location. It does not issue
          property flood predictions or background alerts.
        </p>
      </div>
      {w?.alerts?.length ? (
        <section className="alerts-section">
          <span className="eyebrow">OFFICIAL WEATHER ALERTS</span>
          {w.alerts.map((a, i) => (
            <div className="notice amber" key={i}>
              <Info size={17} />
              <div>
                <strong>{a.event}</strong>
                <p>{a.headline}</p>
                <a
                  href="https://www.weather.gov/jan/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read official instructions →
                </a>
              </div>
            </div>
          ))}
        </section>
      ) : w?.alertsOk ? (
        <p className="alert-check">
          <ShieldCheck size={15} /> No active flood alerts returned for this
          point during the last successful check. This is not an all-clear.
        </p>
      ) : (
        <div className="notice amber">
          <Info size={17} />
          <p>
            The weather alert service could not be reached.{" "}
            <a
              href="https://www.weather.gov/jan/"
              target="_blank"
              rel="noreferrer"
            >
              Check official alerts directly →
            </a>
          </p>
        </div>
      )}
      {g && (
        <section className="briefing-panel" id="river-timeline">
          <div className="briefing-heading">
            <div>
              <span className="eyebrow">THE RIVER TIMELINE</span>
              <h2>What the gauge sees</h2>
            </div>
            <span
              className={`status-label ${fcFresh && peak && stage != null && peak.stageFt < stage ? "" : "warning"}`}
            >
              {category}
            </span>
          </div>
          <div className="wide-chart">
            <StageChart
              observed={observed.slice(-100)}
              forecast={g.forecast}
              floodStage={stage}
              issued={g.forecastIssued}
              referenceStage={impactLevel}
              sourceLabel={`${g.lid} · ${g.name}`}
            />
            <p className="chart-context">
              <Info size={13} /> Forecast issued {timeLabel(g.forecastIssued)}.
              Shaded region shows forecast data; it is not a confidence
              interval.
            </p>
          </div>
        </section>
      )}
      {g?.impacts?.length ? (
        <ImpactExplorer
          key={g.lid}
          notes={g.impacts}
          lid={g.lid}
          city={STATIONS.find((s) => s.lid === g.lid)?.city ?? "Nearby gauge"}
          forecast={g.forecast}
          issued={error ? null : (g.forecastIssued ?? null)}
          observed={fresh ? last!.stageFt : null}
          observedAt={last?.t ?? null}
          value={impactLevel}
          onChange={setImpactLevel}
          now={Date.now()}
        />
      ) : null}
      <section className="ground-section">
        <div>
          <span className="eyebrow">GROUND, NOT YOUR DOORSTEP</span>
          <h2>A different kind of height.</h2>
          <p>
            River stage starts at the gauge’s zero mark. Ground elevation uses a
            national vertical reference. These are different numbers.
          </p>
          <div className="ground-readings">
            {pins.map((p, i) => (
              <div key={p.id} className={pin.id === p.id ? "active" : ""}>
                <span>
                  {String(i + 1).padStart(2, "0")} / {p.name}
                </span>
                <strong>
                  {p.elevationFt === null ? "—" : p.elevationFt.toFixed(0)}
                  {p.elevationFt !== null && <small> ft</small>}
                </strong>
                <p>
                  {p.elevationFt === null
                    ? "ground height unavailable"
                    : "estimated ground elevation"}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="ground-explanation">
          <div className="eyebrow">WHY THE DISTINCTION MATTERS</div>
          <h3>
            {pins.length > 1 &&
            pins[0].elevationFt !== null &&
            pins[1].elevationFt !== null
              ? `These points sit about ${Math.round(Math.abs(pins[0].elevationFt - pins[1].elevationFt))} feet apart in elevation.`
              : "A street can sit lower than the house beside it."}
          </h3>
          <p>
            A ground model is not a floor survey. An address match can land near
            the road. Even accurate elevations cannot tell us how water moves
            around a levee.
          </p>
          <p>
            {sameDatum
              ? "This gauge uses NAVD88, the same reference as the ground model."
              : "The gauge and ground may use different vertical references. CrestWatch does not subtract them without a verified conversion."}
          </p>
          <Link href="/methodology" className="inline-link">
            See how the data fits together <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      {canCompare && (
        <section className="comparison-tool">
          <span className="eyebrow">EDUCATIONAL ELEVATION COMPARISON</span>
          <h2>Try a river reading</h2>
          <p>
            Ground minus gauge zero minus river stage. This is arithmetic, not a
            flood simulation.
          </p>
          <label>
            Gauge reading: {(whatIf ?? peak!.stageFt).toFixed(1)} ft
            <input
              aria-label="Hypothetical gauge reading"
              type="range"
              min="0"
              max={Math.max(60, (stage ?? 40) + 15)}
              step=".5"
              value={whatIf ?? peak!.stageFt}
              onChange={(e) => setWhatIf(Number(e.target.value))}
            />
          </label>
          <p className="comparison-answer">
            The hypothetical water elevation is about{" "}
            {Math.round(Math.abs(margin ?? 0))} ft{" "}
            {margin! >= 0 ? "below" : "above"} the estimated ground.
          </p>
          <button className="text-button" onClick={() => setWhatIf(null)}>
            Reset to official forecast
          </button>
        </section>
      )}
      <div className="share-bar">
        <span>
          <ShieldCheck size={15} /> Your places stay in this browser.
        </span>
        <div>
          <button onClick={share} className="secondary-button">
            {copied ? <Check size={14} /> : <Share2 size={14} />}{" "}
            {copied ? "Briefing copied" : "Copy briefing & link"}
          </button>
          <button
            onClick={speak}
            className="secondary-button"
            disabled={!canSpeak}
            title={
              canSpeak
                ? "Read the briefing aloud"
                : "Read-aloud is not supported in this browser"
            }
          >
            {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}{" "}
            {speaking ? "Stop reading" : "Read aloud"}
          </button>
          {linked && (
            <button
              className="primary-button"
              onClick={() => {
                let count = 0;
                let full = false;
                let storage = false;
                for (const p of pins) {
                  if (
                    loadPins().some(
                      (e) =>
                        Math.abs(e.lat - p.lat) < 0.00001 &&
                        Math.abs(e.lon - p.lon) < 0.00001,
                    )
                  )
                    continue;
                  const r = addPin({ ...p, id: newPinId() });
                  if (r.ok) count++;
                  else if (r.reason === "full") full = true;
                  else storage = true;
                }
                setSaved(
                  `${count} ${count === 1 ? "place" : "places"} saved.${full ? " Your five-place board is full." : ""}${storage ? " Browser storage is unavailable." : ""}`,
                );
              }}
            >
              <Bookmark size={14} /> Save these places
            </button>
          )}
        </div>
        <p role="status">{saved}</p>
      </div>
      <section className="next-steps">
        <span className="eyebrow">KEEP YOUR NEXT STEP SIMPLE</span>
        <h2>Stay connected to the official word.</h2>
        <p>
          Keep emergency alerts enabled. Never drive or walk into floodwater.
          Follow local officials’ instructions.
        </p>
        <div className="action-row">
          <a
            href="https://www.weather.gov/jan/"
            target="_blank"
            rel="noreferrer"
            className="secondary-button"
          >
            National Weather Service <ExternalLink size={13} />
          </a>
          <a
            href="https://www.msema.org/"
            target="_blank"
            rel="noreferrer"
            className="secondary-button"
          >
            Mississippi emergency information <ExternalLink size={13} />
          </a>
        </div>
        <p className="small muted">
          Refreshes every 15 minutes while this page is open. No monitoring
          happens after you close it.
        </p>
      </section>
    </div>
  );
}
