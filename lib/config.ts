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
  "CrestWatch/1.0 (Congressional App Challenge entry; github.com/crestwatch)";

export interface ReplayEvent {
  id: string;
  label: string;
  /** USGS site number for daily values (D7). TEAM: confirm period of record. */
  usgsSite: string;
  /** NWPS lid for gauge metadata. */
  lid: string;
  startDT: string;
  endDT: string;
  blurb: string;
}

/** TEAM: verify gauge ids + date ranges against USGS before shipping. */
export const REPLAY_EVENTS: ReplayEvent[] = [
  {
    id: "backwater2019",
    label: "2019 Yazoo Backwater flood",
    usgsSite: "07288955",
    lid: "GCVM6",
    startDT: "2019-01-01",
    endDT: "2019-08-31",
    blurb:
      "The south Delta stayed underwater for about six months. The slowest flood in district memory.",
  },
  {
    id: "pearl2020",
    label: "February 2020 · Pearl River at Jackson",
    usgsSite: "02486000",
    lid: "JACM6",
    startDT: "2020-02-01",
    endDT: "2020-03-05",
    blurb:
      "The Pearl crested near 36.7 ft — the third-highest on record at Jackson.",
  },
  {
    id: "pearl2022",
    label: "August 2022 · Pearl River at Jackson",
    usgsSite: "02486000",
    lid: "JACM6",
    startDT: "2022-08-15",
    endDT: "2022-09-15",
    blurb:
      "The flood that helped knock out Jackson's water plant.",
  },
];

/** localStorage keys — pins never leave the visitor's browser. */
export const STORAGE_KEYS = {
  theme: "crestwatch.theme",
  pins: "crestwatch.pins",
} as const;
