/**
 * App-wide configuration (Appendix A4). No secrets — CrestWatch has none.
 */

/** Use verbatim everywhere: About page, demo video, submission form. */
export const PURPOSE_SENTENCE =
  "CrestWatch turns the government's river forecasts — written for engineers — into one plain sentence about your own house: when the water is coming, how high, and whether it reaches your door, in a district that once stayed flooded for six months while the forecasts sat unread.";

export const MAX_PINS = 5;
export const GAUGE_RADIUS_MI = 25;

/**
 * Verdict bands (Appendix A2), in feet of margin above forecast peak.
 * TEAM: hand-tune after the Appendix H validation pass — own this math.
 */
export const BANDS = {
  likely: 0.5, // margin ≤ this → LIKELY
  borderline: 3.5, // margin ≤ this → BORDERLINE; above → UNLIKELY
} as const;

export const OBS_STALE_H = 2;
export const FCST_STALE_H = 24;
export const RATE_LIMIT_PER_HOUR = 120;

/** Descriptive UA — api.weather.gov requires one; the others appreciate it. */
export const FETCH_USER_AGENT =
  "CrestWatch/1.0 (Congressional App Challenge entry; https://github.com/shashankmadala/crestwatch)";

export interface ReplayEvent {
  id: string;
  label: string;
  /** USGS site number for daily values (D7) — verified to hold this event. */
  usgsSite: string;
  gaugeName: string;
  startDT: string;
  endDT: string;
  /**
   * How a stage reading becomes a water-surface elevation:
   * "direct" — the published gage height is already an elevation (the
   * Redwood backwater gauge reads in NGVD29 feet); or add gauge zero.
   * TEAM: re-verify both modes against the official gauge pages.
   */
  toElevation: { mode: "direct" } | { mode: "addGaugeZero"; gaugeZeroFt: number };
  blurb: string;
}

/** Recorded crests check out against history: 100.19 (Redwood 2019),
 *  36.62 (Pearl Feb 2020), 35.19 (Pearl Aug 2022). */
export const REPLAY_EVENTS: ReplayEvent[] = [
  {
    id: "backwater2019",
    label: "2019 Yazoo Backwater flood",
    usgsSite: "07288800",
    gaugeName: "Yazoo River at Redwood",
    startDT: "2019-01-01",
    endDT: "2019-08-31",
    toElevation: { mode: "direct" },
    blurb:
      "The south Delta stayed underwater for about six months. The slowest flood in district memory.",
  },
  {
    id: "pearl2020",
    label: "February 2020 · Pearl River at Jackson",
    usgsSite: "02486000",
    gaugeName: "Pearl River at Jackson",
    startDT: "2020-02-01",
    endDT: "2020-03-05",
    toElevation: { mode: "addGaugeZero", gaugeZeroFt: 233.39 },
    blurb:
      "The Pearl crested at 36.6 ft — the third-highest on record at Jackson.",
  },
  {
    id: "pearl2022",
    label: "August 2022 · Pearl River at Jackson",
    usgsSite: "02486000",
    gaugeName: "Pearl River at Jackson",
    startDT: "2022-08-15",
    endDT: "2022-09-15",
    toElevation: { mode: "addGaugeZero", gaugeZeroFt: 233.39 },
    blurb: "The flood that helped knock out Jackson's water plant.",
  },
];

/** localStorage keys — pins never leave the visitor's browser. */
export const STORAGE_KEYS = {
  theme: "crestwatch.theme",
  pins: "crestwatch.pins",
} as const;
