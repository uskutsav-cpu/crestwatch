"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteLink as Link } from "@/components/experience/SiteLink";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  MapPin,
  ShieldCheck,
  History,
  Info,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { HistoryGallery } from "./HistoryGallery";
import { RiverVisual } from "./RiverVisual";
import { ImpactExplorer } from "./ImpactExplorer";
import type { RiverImpact } from "@/lib/impacts";
import { RiverMap } from "./RiverMap";
import { StageChart } from "./StageChart";
import { LocationSearch } from "./LocationSearch";
import { STATIONS, isFresh, timeLabel } from "@/lib/river-stations";
import { EXAMPLE_HREF } from "@/lib/example";
import type { RiverNow, RiversAnswer } from "@/lib/rivers";
import type { SeriesPoint, FloodCategories } from "@/lib/gauges";
export interface RiverDetail {
  ok: boolean;
  observed: SeriesPoint[];
  forecast: SeriesPoint[];
  forecastIssued: string | null;
  categories: FloodCategories;
  impacts: RiverImpact[];
  checkedAt: string;
}
export function Dashboard() {
  const searchParams = useSearchParams();
  const stationParam = searchParams.get("station");
  const levelParam = searchParams.get("level");
  const [rivers, setRivers] = useState<RiverNow[]>([]);
  const [selected, setSelected] = useState("VCKM6");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<RiverDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(true);
  const [detailError, setDetailError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [exploreStage, setExploreStage] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  function updateAddress(lid: string, level: number | null) {
    const url = new URL(window.location.href);
    url.searchParams.set("station", lid);
    if (level === null) url.searchParams.delete("level");
    else url.searchParams.set("level", level.toFixed(1));
    window.history.replaceState(null, "", url.toString());
  }
  const selectStation = (lid: string) => {
    setSelected(lid);
    setExploreStage(null);
    updateAddress(lid, null);
  };
  const selectLevel = (level: number | null) => {
    setExploreStage(level);
    updateAddress(selected, level);
  };
  useEffect(() => {
    const lid =
      stationParam && STATIONS.some((s) => s.lid === stationParam)
        ? stationParam
        : "VCKM6";
    setSelected(lid);
    const n =
      levelParam === null || levelParam.trim() === ""
        ? NaN
        : Number(levelParam);
    setExploreStage(
      stationParam &&
        STATIONS.some((s) => s.lid === stationParam) &&
        Number.isFinite(n) &&
        n >= -20 &&
        n <= 200
        ? n
        : null,
    );
  }, [stationParam, levelParam]);
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(clock);
  }, []);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/rivers");
      const data: RiversAnswer = await res.json();
      if (!res.ok || !data.ok) throw Error();
      setRivers(data.rivers);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
      setAttempt((a) => a + 1);
    }, 900000);
    const online = () => {
      void refresh();
      setAttempt((a) => a + 1);
    };
    window.addEventListener("online", online);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", online);
    };
  }, [refresh]);
  useEffect(() => {
    let dead = false;
    setDetail(null);
    setDetailBusy(true);
    setDetailError(false);
    fetch(`/api/river/${selected}`)
      .then((r) => r.json() as Promise<RiverDetail>)
      .then((d) => {
        if (!dead) {
          if (d.ok) setDetail(d);
          else setDetailError(true);
        }
      })
      .catch(() => {
        if (!dead) setDetailError(true);
      })
      .finally(() => {
        if (!dead) setDetailBusy(false);
      });
    return () => {
      dead = true;
    };
  }, [selected, attempt]);
  const anchored = useRef(false);
  useEffect(() => {
    if (
      detail?.impacts.length &&
      !anchored.current &&
      window.location.hash === "#impact-explorer"
    ) {
      anchored.current = true;
      const frame = requestAnimationFrame(() =>
        document
          .getElementById("impact-explorer")
          ?.scrollIntoView({ block: "start" }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [detail]);
  const station = STATIONS.find((s) => s.lid === selected)!;
  const river = rivers.find((r) => r.lid === selected);
  const fresh = river && isFresh(river.observedAt, 2, now) && !error;
  const forecastFresh =
    river && isFresh(river.forecastIssued, 24, now) && !error;
  return (
    <div className="overview page-enter">
      <section className="river-hero">
        <RiverVisual />
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> A FIELD GUIDE TO MISSISSIPPI RIVERS
          </div>
          <h1>
            Life along<br />the river.<br />
            <em>A little clearer.</em>
          </h1>
          <p>
            Follow the water. Understand the forecast. Get a clearer
            picture of the places you call home.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#rivers">
              Explore the rivers <ArrowRight size={18} />
            </a>
            <Link className="hero-secondary" href="/replay">
              Replay a flood <ArrowUpRight size={17} />
            </Link>
          </div>
          <a className="hero-live-reading" href="#river-timeline">
            <div>
              <span className="eyebrow">
                {station.city.toUpperCase()} · NOAA / NWS
              </span>
              <span className={`hero-fresh ${fresh ? "" : "older"}`}>
                <i />
                {fresh
                  ? "Recent reading"
                  : river
                    ? "Older reading"
                    : busy
                      ? "Connecting"
                      : "Unavailable"}
              </span>
            </div>
            <div>
              <strong>
                {river ? river.stageFt.toFixed(1) : "—"}
                <small> ft</small>
              </strong>
              <p>
                {river ? (
                  <>
                    Observed <time dateTime={river.observedAt}>{timeLabel(river.observedAt)}</time>
                    <br />
                    {fresh && river.category === "none"
                      ? "Below flood stage at this gauge"
                      : fresh && river.category
                        ? `${river.category} stage at this gauge`
                        : "Check the latest official source"}
                  </>
                ) : (
                  "Official readings appear here when available."
                )}
              </p>
              <ArrowUpRight size={20} />
            </div>
          </a>
        </div>
        <a href="#rivers" className="hero-scroll">
          SCROLL TO EXPLORE <ArrowDown size={15} />
        </a>
      </section>
      <nav className="chapter-nav" aria-label="Explore CrestWatch">
        <a href="#rivers"><span>01</span> The live picture <ArrowDownRight size={17}/></a>
        <a href="#river-timeline"><span>02</span> Read the forecast <ArrowDownRight size={17}/></a>
        <a href="#river-memory"><span>03</span> The river’s memory <ArrowDownRight size={17}/></a>
        <Link href="/places"><span>04</span> Your places <ArrowUpRight size={17}/></Link>
      </nav>
      <section className="find-place" id="find-place">
        <div className="find-place-label">
          <MapPin size={19} />
          <strong>Where does your river story begin?</strong>
        </div>
        <LocationSearch />
        <div className="search-privacy">
          <ShieldCheck size={13} /> Saved on your device. No account needed.
        </div>
      </section>
      <section className="river-section" id="rivers">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / THE LIVE PICTURE</span>
            <h2>Your rivers, right now.</h2>
          </div>
          <button
            className="text-button"
            onClick={() => {
              void refresh();
              setAttempt((a) => a + 1);
            }}
            disabled={busy}
          >
            <RefreshCw size={13} className={busy ? "spin" : ""} />{" "}
            {busy ? "Checking rivers" : "Refresh readings"}
          </button>
        </div>
        <div className="river-board">
          <div className="river-list">
            <div className="river-list-label">
              <span>MONITORING STATIONS</span>
              <span>STAGE</span>
            </div>
            {STATIONS.map((s) => {
              const r = rivers.find((x) => x.lid === s.lid);
              const current = r && isFresh(r.observedAt, 2, now) && !error;
              const status = !r
                ? "Reading unavailable"
                : !current
                  ? "Older reading"
                  : r.category === "none"
                    ? "Below flood stage"
                    : r.category === null
                      ? "Flood stage unknown"
                      : `${r.category} stage`;
              return (
                <button
                  key={s.lid}
                  className={`river-row ${selected === s.lid ? "selected" : ""}`}
                  onClick={() => selectStation(s.lid)}
                  aria-pressed={selected === s.lid}
                >
                  <span className="station-number">{s.label}</span>
                  <div className="river-row-name">
                    <strong>{s.name}</strong>
                    <span>at {s.city}</span>
                    <span
                      className={`mini-status ${current && r.category === "none" ? "calm" : "caution"}`}
                    >
                      <i />
                      {busy && !r ? "Connecting to NOAA" : status}
                    </span>
                  </div>
                  <div className="river-row-value">
                    {r ? (
                      <>
                        <strong>
                          {r.stageFt.toFixed(1)}
                          <small>ft</small>
                        </strong>
                        <span>
                          {r.trend === "rising" ? (
                            <ArrowUpRight size={14} />
                          ) : r.trend === "falling" ? (
                            <ArrowDownRight size={14} />
                          ) : (
                            <Minus size={14} />
                          )}{" "}
                          {r.trend ?? "Unknown"}
                        </span>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </button>
              );
            })}
            <div className="river-list-footer">
              <span className="live-dot" /> NOAA / NATIONAL WEATHER SERVICE
            </div>
            {error && (
              <p className="inline-warning" role="status">
                Latest check failed. Previous readings are older.{" "}
                <button onClick={() => void refresh()}>Try again</button>
              </p>
            )}
          </div>
          <RiverMap active={selected} onSelect={selectStation} />
        </div>
      </section>
      <section className="briefing-panel" id="river-timeline">
        <div className="briefing-heading">
          <div>
            <div className="eyebrow">
              STATION {station.label} <span className="eyebrow-divider">/</span>{" "}
              {selected}
            </div>
            <h2>
              {station.name} <span>at {station.city}</span>
            </h2>
          </div>
          <span className={`status-label ${fresh ? "" : "warning"}`}>
            <i />
            {fresh
              ? "Recent observation"
              : river
                ? "Older observation"
                : "Awaiting observation"}
          </span>
        </div>
        <div className="briefing-content">
          <div className="reading-summary">
            <span className="small-label">LATEST RIVER STAGE</span>
            <div className="big-reading">
              {river ? river.stageFt.toFixed(1) : "—"}
              <span>ft</span>
            </div>
            <p>
              {river?.trend === "rising" ? (
                <ArrowUp size={15} />
              ) : river?.trend === "falling" ? (
                <ArrowDown size={15} />
              ) : (
                <Minus size={15} />
              )}{" "}
              {river?.trend ? `River ${river.trend}` : "Trend unavailable"}
            </p>
            <div className="reading-divider" />
            <dl>
              <div>
                <dt>Flood stage</dt>
                <dd>
                  {river?.floodStageFt != null
                    ? `${river.floodStageFt} ft`
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Forecast high</dt>
                <dd>
                  {forecastFresh && river?.forecastHigh
                    ? `${river.forecastHigh.stageFt.toFixed(1)} ft`
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Reading taken</dt>
                <dd className="observation-date">{river?.observedAt ? <time dateTime={river.observedAt}>{timeLabel(river.observedAt)}</time> : "Time unavailable"}</dd>
              </div>
            </dl>
          </div>
          <div className="timeline">
            <div className="timeline-title">
              <strong>Reading the river ahead</strong>
              <span>OBSERVATIONS + OFFICIAL FORECAST</span>
            </div>
            {detailBusy ? (
              <div className="chart-loading">
                <span className="live-dot" /> Bringing in the official timeline…
              </div>
            ) : detailError ? (
              <div className="chart-empty" role="status">
                The timeline feed didn’t respond.{" "}
                <button
                  className="text-button"
                  onClick={() => setAttempt((a) => a + 1)}
                >
                  Try again
                </button>
              </div>
            ) : detail ? (
              <>
                <StageChart
                  observed={detail.observed.slice(-100)}
                  forecast={detail.forecast}
                  floodStage={detail.categories.minor}
                  issued={detail.forecastIssued}
                  referenceStage={exploreStage}
                  sourceLabel={`${selected} · ${station.city}`}
                />
                {!isFresh(detail.forecastIssued, 24) && (
                  <p className="inline-warning">
                    Older forecast · issued {timeLabel(detail.forecastIssued)}.
                    Check the official source.
                  </p>
                )}
              </>
            ) : null}
            <p className="chart-context">
              <Info size={13} /> Gauge feet measure the river at this station.
              They are not the depth of water at your home.
            </p>
          </div>
        </div>
        <a
          className="panel-source"
          href={`https://water.noaa.gov/gauges/${selected}`}
          target="_blank"
          rel="noreferrer"
        >
          Explore the official {station.city} forecast{" "}
          <ArrowUpRight size={14} />
        </a>
      </section>
      {detail?.impacts?.length ? (
        <ImpactExplorer
          key={selected}
          notes={detail.impacts}
          lid={selected}
          city={station.city}
          forecast={detail.forecast}
          issued={detail.forecastIssued}
          observed={fresh && river ? river.stageFt : null}
          observedAt={river?.observedAt ?? null}
          value={exploreStage}
          onChange={selectLevel}
          now={now}
        />
      ) : null}
      <HistoryGallery />
      <section className="judge-invitation">
        <div>
          <span className="eyebrow">BUILT TO BE UNDERSTOOD</span>
          <h2>One river. A three-minute walkthrough.</h2>
          <p>
            Try the live forecast, explore a published impact, and replay a real
            flood. See the engineering and evidence behind each step.
          </p>
        </div>
        <Link className="primary-button" href="/project">
          Explore the project <ArrowRight size={17} />
        </Link>
      </section>
      <section className="bottom-grid">
        <Link href={EXAMPLE_HREF} className="example-panel">
          <span className="eyebrow">MAKE IT PERSONAL</span>
          <h2>
            Same river.
            <br />
            <em>Different ground.</em>
          </h2>
          <p>
            Explore two places in Vicksburg and see why a river reading needs
            local context.
          </p>
          <span className="inline-link">
            Explore a live example <ArrowRight size={17} />
          </span>
          <div className="example-line-art" aria-hidden="true">
            <svg viewBox="0 0 260 130">
              <path
                d="M0 112H65V78H110L155 42H220V112H260M0 120H260M60 70L86 51L112 70M160 35L188 16L216 35M74 78V65H99V78M175 42V31H201V42"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M0 95Q15 89 30 95T60 95T90 95T120 95T150 95T180 95T210 95T240 95T270 95"
                fill="none"
                stroke="#8aa69d"
                strokeDasharray="4 3"
              />
            </svg>
          </div>
        </Link>
        <div className="field-notes">
          <div className="eyebrow">KNOW WHAT YOU’RE SEEING</div>
          <h2>Informed. Not overwhelmed.</h2>
          <p>
            CrestWatch helps you understand river data. Local officials and the
            National Weather Service remain your source for emergency
            instructions.
          </p>
          <div className="field-note-links">
            <Link href="/methodology">
              <BookOpen size={16} /> Understand the numbers{" "}
              <ArrowUpRight size={14} />
            </Link>
            <Link href="/replay">
              <History size={16} /> Look back at past floods{" "}
              <ArrowUpRight size={14} />
            </Link>
            <a
              href="https://www.weather.gov/jan/"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Check official weather alerts{" "}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </section>
      <div className="data-credit">
        <span>GROUNDED IN PUBLIC DATA</span>
        <strong>
          NOAA <span>/</span> USGS <span>/</span> U.S. CENSUS
        </strong>
        <Link href="/methodology">
          Meet the sources <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
