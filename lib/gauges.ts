/**
 * Gauge client (T03, Appendix D3–D5). All NWPS/USGS parsing lives here —
 * field names drift, so every adapter is fixture-tested against recorded
 * responses. Injectable fetchers; no other file touches these APIs.
 */

import { MAX_GAUGE_ZERO_ACCURACY_FT } from "@/lib/config";
import { fetchJson, fetchText, type FetchJson, type FetchText } from "@/lib/net";

export interface Fetchers {
  json: FetchJson;
  text: FetchText;
}

export const defaultFetchers: Fetchers = { json: fetchJson, text: fetchText };

export interface SeriesPoint {
  /** ISO timestamp (UTC). */
  t: string;
  stageFt: number;
}

export interface FloodCategories {
  action?: number;
  minor?: number;
  moderate?: number;
  major?: number;
}

export interface HistoricCrest {
  stageFt: number;
  time: string;
}

export interface GaugeCandidate {
  lid: string;
  name: string;
  lat: number;
  lon: number;
  distanceMi: number;
}

export interface GaugeBundle {
  lid: string;
  name: string;
  usgsId: string | null;
  lat: number;
  lon: number;
  distanceMi: number;
  /** Observed stage series, oldest → newest (USGS IV preferred). */
  observed: SeriesPoint[];
  /** NWS forecast stage series, oldest → newest. */
  forecast: SeriesPoint[];
  forecastIssued: string | null;
  categories: FloodCategories;
  /** Gauge-zero elevation (alt_va) — the key that unlocks FULL tier. */
  gaugeZeroFt: number | null;
  /** Vertical datum of gaugeZeroFt (NAVD88, or NGVD29 ≈ NAVD88 ± <0.5 ft here). */
  gaugeDatum: string | null;
  historicCrests: HistoricCrest[];
}

/* ---------------------------------------------------------------- */
/* Geometry                                                          */
/* ---------------------------------------------------------------- */

export function haversineMi(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ---------------------------------------------------------------- */
/* URLs                                                              */
/* ---------------------------------------------------------------- */

const NWPS = "https://api.water.noaa.gov/nwps/v1";

export function nwpsListUrl(lat: number, lon: number, radiusMi: number): string {
  const latDeg = radiusMi / 69;
  const lonDeg = radiusMi / (69 * Math.cos((lat * Math.PI) / 180));
  const u = new URL(`${NWPS}/gauges`);
  u.searchParams.set("bbox.xmin", (lon - lonDeg).toFixed(4));
  u.searchParams.set("bbox.ymin", (lat - latDeg).toFixed(4));
  u.searchParams.set("bbox.xmax", (lon + lonDeg).toFixed(4));
  u.searchParams.set("bbox.ymax", (lat + latDeg).toFixed(4));
  u.searchParams.set("srid", "EPSG_4326");
  return u.toString();
}

export const nwpsDetailUrl = (lid: string) => `${NWPS}/gauges/${lid}`;
export const nwpsStageflowUrl = (lid: string) => `${NWPS}/gauges/${lid}/stageflow`;

/* Legacy USGS WaterServices: slowed from 2026-11-16, shut 2027-02-22. */
export const usgsSiteUrl = (site: string) =>
  `https://waterservices.usgs.gov/nwis/site/?sites=${site}&siteOutput=expanded&format=rdb`;

export const usgsIvUrl = (site: string, hours = 48) =>
  `https://waterservices.usgs.gov/nwis/iv/?sites=${site}&parameterCd=00065&format=json&period=PT${hours}H`;

/* Its replacement, the USGS Water Data OGC API (keyless; key optional). */
const WATERDATA = "https://api.waterdata.usgs.gov/ogcapi/v1/collections";

export const waterdataSiteUrl = (site: string) =>
  `${WATERDATA}/monitoring-locations/items/USGS-${encodeURIComponent(site)}?f=json`;

export const waterdataIvUrl = (site: string, hours = 48) =>
  `${WATERDATA}/continuous/items?monitoring_location_id=USGS-${encodeURIComponent(site)}` +
  `&parameter_code=00065&time=PT${hours}H&properties=time,value&skipGeometry=true&limit=10000&f=json`;

/* ---------------------------------------------------------------- */
/* USGS source order                                                 */
/* ---------------------------------------------------------------- */

/**
 * USGS's published schedule adds 10 s to every legacy call from this
 * instant (2 s from 2026-11-16, gone for good 2027-02-22). Before it the
 * legacy service is still the better first try: no anonymous rate limit
 * and fast enough. From it on, the new API goes first.
 */
export const WATERDATA_FIRST_FROM = "2027-01-11T00:00:00Z";
const WATERDATA_FIRST_FROM_MS = Date.parse(WATERDATA_FIRST_FROM);

/**
 * Legacy gets a tight timeout: pickForecastGauge walks up to 6 gauges, so
 * a hung legacy service must cost seconds, not 6 x the 10 s default.
 * +2 s of scheduled delay still fits comfortably.
 */
export const LEGACY_USGS_TIMEOUT_MS = 6_000;
/** The new API answers in under a second; this only bounds a hang. */
export const WATERDATA_TIMEOUT_MS = 8_000;

export type UsgsSource = "legacy" | "waterdata";

export interface UsgsOptions {
  /** Clock (ms since epoch) that picks the source order. Tests inject it. */
  now?: () => number;
}

export function usgsSourceOrder(nowMs: number): UsgsSource[] {
  return nowMs < WATERDATA_FIRST_FROM_MS
    ? ["legacy", "waterdata"]
    : ["waterdata", "legacy"];
}

/* ---------------------------------------------------------------- */
/* Adapters (one per drifting upstream shape)                        */
/* ---------------------------------------------------------------- */

export async function findNearbyGauges(
  lat: number,
  lon: number,
  radiusMi: number,
  json: FetchJson = fetchJson,
): Promise<GaugeCandidate[]> {
  const data = (await json(nwpsListUrl(lat, lon, radiusMi))) as {
    gauges?: Array<{
      lid?: string;
      name?: string;
      latitude?: number;
      longitude?: number;
    }>;
  };
  const out: GaugeCandidate[] = [];
  for (const g of data?.gauges ?? []) {
    if (!g.lid || typeof g.latitude !== "number" || typeof g.longitude !== "number") {
      continue;
    }
    const d = haversineMi(lat, lon, g.latitude, g.longitude);
    if (d <= radiusMi) {
      out.push({
        lid: g.lid,
        name: g.name ?? g.lid,
        lat: g.latitude,
        lon: g.longitude,
        distanceMi: d,
      });
    }
  }
  return out.sort((a, b) => a.distanceMi - b.distanceMi);
}

interface StageflowSeries {
  issuedTime?: string;
  primaryUnits?: string;
  data?: Array<{ validTime?: string; primary?: number }>;
}

export function parseStageflowSeries(s: StageflowSeries | undefined | null): SeriesPoint[] {
  // A "primary" that isn't stage-in-feet (some gauges lead with flow in
  // kcfs) must not masquerade as feet — the tier ladder handles absence.
  if (s?.primaryUnits && s.primaryUnits !== "ft") return [];
  const out: SeriesPoint[] = [];
  for (const p of s?.data ?? []) {
    if (
      typeof p.primary === "number" &&
      Number.isFinite(p.primary) &&
      p.primary > -100 &&
      typeof p.validTime === "string" &&
      Number.isFinite(Date.parse(p.validTime))
    ) {
      out.push({ t: p.validTime, stageFt: p.primary });
    }
  }
  return out;
}

export function parseIvSeries(data: unknown): SeriesPoint[] {
  const ts = (
    data as {
      value?: { timeSeries?: Array<{ values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }> }> };
    }
  )?.value?.timeSeries?.[0];
  const raw = ts?.values?.[0]?.value ?? [];
  const out: SeriesPoint[] = [];
  for (const p of raw) {
    const v = parseFloat(p.value ?? "");
    if (Number.isFinite(v) && v > -100 && p.dateTime) {
      out.push({ t: new Date(p.dateTime).toISOString(), stageFt: v });
    }
  }
  return out;
}

/**
 * Series from the new USGS continuous collection. Values arrive as
 * STRINGS ("3.14") and the order is not promised, so parse and sort here.
 * Yields exactly the shape parseIvSeries does.
 */
export function parseWaterdataSeries(data: unknown): SeriesPoint[] {
  const features = (
    data as { features?: Array<{ properties?: { time?: unknown; value?: unknown } }> }
  )?.features;
  if (!Array.isArray(features)) return [];
  const byTime = new Map<string, number>();
  for (const f of features) {
    const time = f?.properties?.time;
    const raw = f?.properties?.value;
    if (typeof time !== "string" || raw === null || raw === undefined) continue;
    const v = parseFloat(String(raw));
    const ms = Date.parse(time);
    if (!Number.isFinite(v) || v <= -100 || !Number.isFinite(ms)) continue;
    const t = new Date(ms).toISOString();
    if (!byTime.has(t)) byTime.set(t, v);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([t, stageFt]) => ({ t, stageFt }));
}

export interface GaugeZero {
  altVaFt: number;
  datum: string | null;
}

/**
 * True when USGS states the gauge zero's accuracy and it is looser than
 * MAX_GAUGE_ZERO_ACCURACY_FT (Greenville, Sarah and Lambert say ±10 ft).
 * Both sources go through this one rule, so the 2027-01-11 source switch
 * can't move a gauge between tiers. Blank, missing or unreadable keeps
 * today's behaviour: the gauge zero stands.
 */
function accuracyTooLoose(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const ft = typeof raw === "number" ? raw : parseFloat(String(raw).trim());
  return Number.isFinite(ft) && ft > MAX_GAUGE_ZERO_ACCURACY_FT;
}

/**
 * Parse gauge-zero elevation + vertical datum from USGS site RDB text.
 * Robust to multi-row responses: matches the requested site number when
 * given, and always skips the RDB format row ("5s\t15s\t…") wherever it
 * falls rather than assuming a fixed line index.
 *
 * Only a USGS row counts. Vicksburg (07289000) lists an Army Corps row
 * first ("73", NAVD88) and the USGS gauge zero second (46.22, NGVD29);
 * the first-row answer put the river ~27 ft too high. Another agency's
 * alt_va can be a different reference entirely, so when rows match the
 * site but none is USGS this returns null and the gauge drops to the
 * CATEGORY tier instead of risking a wrong FULL verdict. So does a USGS
 * gauge zero whose alt_acy_va is looser than MAX_GAUGE_ZERO_ACCURACY_FT.
 */
export function parseAltVa(rdb: string, site?: string): GaugeZero | null {
  const lines = rdb.split("\n").filter((l) => l && !l.startsWith("#"));
  if (lines.length < 3) return null;
  const cols = lines[0].split("\t");
  const iAlt = cols.indexOf("alt_va");
  const iAcy = cols.indexOf("alt_acy_va");
  const iDatum = cols.indexOf("alt_datum_cd");
  const iSite = cols.indexOf("site_no");
  const iAgency = cols.indexOf("agency_cd");
  if (iAlt < 0) return null;

  const isFormatRow = (cells: string[]) =>
    cells.every((c) => /^\d+[sdn]$/.test(c.trim()));

  for (const line of lines.slice(1)) {
    const row = line.split("\t");
    if (isFormatRow(row)) continue;
    if (site && iSite >= 0 && (row[iSite] ?? "").trim() !== site) continue;
    // No agency column at all (never seen live) keeps the old behaviour.
    if (iAgency >= 0 && (row[iAgency] ?? "").trim() !== "USGS") continue;
    const altVaFt = parseFloat((row[iAlt] ?? "").trim());
    if (!Number.isFinite(altVaFt)) continue;
    if (iAcy >= 0 && accuracyTooLoose(row[iAcy])) return null;
    const datum = (row[iDatum] ?? "").trim();
    return { altVaFt, datum: datum || null };
  }
  return null;
}

/**
 * Gauge zero from the new monitoring-locations record. `altitude` is a
 * number there (233.39) but is read leniently; 0 is a real value (some
 * reservoir gauges publish stage as elevation). Same USGS-only rule and
 * same accuracy rule (altitude_accuracy here) as parseAltVa.
 */
export function parseWaterdataSite(data: unknown, site?: string): GaugeZero | null {
  const p = (data as { properties?: Record<string, unknown> })?.properties;
  if (!p || typeof p !== "object") return null;
  if (p.agency_code !== undefined && p.agency_code !== "USGS") return null;
  if (
    site &&
    typeof p.monitoring_location_number === "string" &&
    p.monitoring_location_number.trim() !== site
  ) {
    return null;
  }
  const alt = p.altitude;
  if (alt === null || alt === undefined || alt === "") return null;
  const altVaFt = typeof alt === "number" ? alt : parseFloat(String(alt));
  if (!Number.isFinite(altVaFt)) return null;
  if (accuracyTooLoose(p.altitude_accuracy)) return null;
  const datum = typeof p.vertical_datum === "string" ? p.vertical_datum.trim() : "";
  return { altVaFt, datum: datum || null };
}

interface NwpsDetail {
  lid?: string;
  usgsId?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  flood?: {
    categories?: Record<string, { stage?: number }>;
    crests?: { historic?: Array<{ stage?: number; occurredTime?: string }> };
  };
}

export function parseCategories(detail: NwpsDetail): FloodCategories {
  const out: FloodCategories = {};
  const cats = detail.flood?.categories ?? {};
  for (const key of ["action", "minor", "moderate", "major"] as const) {
    const stage = cats[key]?.stage;
    if (typeof stage === "number" && Number.isFinite(stage) && stage > -100) {
      out[key] = stage;
    }
  }
  return out;
}

export function parseHistoricCrests(detail: NwpsDetail): HistoricCrest[] {
  const out: HistoricCrest[] = [];
  for (const c of detail.flood?.crests?.historic ?? []) {
    if (
      typeof c.stage === "number" &&
      Number.isFinite(c.stage) &&
      c.occurredTime
    ) {
      out.push({ stageFt: c.stage, time: c.occurredTime });
    }
  }
  return out.sort((a, b) => b.stageFt - a.stageFt);
}

/**
 * Datum sanity (Appendix D note): a gauge zero that puts current water
 * >200 ft away from the pin's ground elevation is suspect — fall to
 * CATEGORY tier rather than publish absurd house-level math.
 */
export function datumLooksSane(
  gaugeZeroFt: number,
  latestStageFt: number,
  pinElevationFt: number,
): boolean {
  return Math.abs(gaugeZeroFt + latestStageFt - pinElevationFt) <= 200;
}

/* ---------------------------------------------------------------- */
/* Composition                                                       */
/* ---------------------------------------------------------------- */

/** An HTML body is an outage page (USGS redirects to its blog), not data. */
function looksLikeHtml(body: unknown): boolean {
  return typeof body === "string" && /^\s*</.test(body);
}

/**
 * Ask each source in order. A throw (timeout, non-2xx, HTML that fails
 * JSON parsing) or a null (no usable value) moves on to the next one.
 */
async function firstUsable<T>(
  order: UsgsSource[],
  tries: Record<UsgsSource, () => Promise<T | null>>,
): Promise<T | null> {
  for (const source of order) {
    try {
      const value = await tries[source]();
      if (value !== null) return value;
    } catch {
      // fall through to the other source
    }
  }
  return null;
}

/**
 * Gauge zero + datum: the FULL-tier key. Null when neither source has a
 * usable one (missing, not USGS, or too loose to trust).
 */
export async function fetchUsgsGaugeZero(
  site: string,
  fetchers: Fetchers = defaultFetchers,
  { now = Date.now }: UsgsOptions = {},
): Promise<GaugeZero | null> {
  return firstUsable(usgsSourceOrder(now()), {
    legacy: async () => {
      const rdb = await fetchers.text(usgsSiteUrl(site), {
        timeoutMs: LEGACY_USGS_TIMEOUT_MS,
      });
      if (typeof rdb !== "string" || looksLikeHtml(rdb)) return null;
      return parseAltVa(rdb, site);
    },
    waterdata: async () => {
      const data = await fetchers.json(waterdataSiteUrl(site), {
        timeoutMs: WATERDATA_TIMEOUT_MS,
      });
      return looksLikeHtml(data) ? null : parseWaterdataSite(data, site);
    },
  });
}

/** 48 h gage-height series, oldest → newest. Null when neither source has one. */
export async function fetchUsgsObserved(
  site: string,
  fetchers: Fetchers = defaultFetchers,
  { now = Date.now }: UsgsOptions = {},
): Promise<SeriesPoint[] | null> {
  const nonEmpty = (s: SeriesPoint[]) => (s.length > 0 ? s : null);
  return firstUsable(usgsSourceOrder(now()), {
    legacy: async () => {
      const data = await fetchers.json(usgsIvUrl(site), {
        timeoutMs: LEGACY_USGS_TIMEOUT_MS,
      });
      return looksLikeHtml(data) ? null : nonEmpty(parseIvSeries(data));
    },
    waterdata: async () => {
      const data = await fetchers.json(waterdataIvUrl(site), {
        timeoutMs: WATERDATA_TIMEOUT_MS,
      });
      return looksLikeHtml(data) ? null : nonEmpty(parseWaterdataSeries(data));
    },
  });
}

/** NWPS half of a bundle: detail + stageflow. No USGS calls. */
async function fetchNwpsBundle(
  candidate: GaugeCandidate,
  fetchers: Fetchers,
): Promise<GaugeBundle> {
  const [detailRaw, stageflowRaw] = await Promise.all([
    fetchers.json(nwpsDetailUrl(candidate.lid)),
    fetchers.json(nwpsStageflowUrl(candidate.lid)),
  ]);
  const detail = detailRaw as NwpsDetail;
  const stageflow = stageflowRaw as {
    observed?: StageflowSeries;
    forecast?: StageflowSeries;
  };

  const usgsId = detail.usgsId?.trim() ? detail.usgsId.trim() : null;

  return {
    lid: candidate.lid,
    name: detail.name ?? candidate.name,
    usgsId,
    lat: candidate.lat,
    lon: candidate.lon,
    distanceMi: candidate.distanceMi,
    observed: parseStageflowSeries(stageflow.observed),
    forecast: parseStageflowSeries(stageflow.forecast),
    forecastIssued: stageflow.forecast?.issuedTime ?? null,
    categories: parseCategories(detail),
    gaugeZeroFt: null,
    gaugeDatum: null,
    historicCrests: parseHistoricCrests(detail),
  };
}

/**
 * USGS half: the finer observed series and the gauge zero, each from the
 * legacy service or the new API (whichever answers first in date order).
 * Best-effort: neither failing may sink the bundle. The NWPS observed
 * series stays when USGS has none; no gauge zero means CATEGORY tier.
 */
async function withUsgs(
  bundle: GaugeBundle,
  fetchers: Fetchers,
  opts: UsgsOptions,
): Promise<GaugeBundle> {
  if (!bundle.usgsId) return bundle;
  const [observed, zero] = await Promise.all([
    fetchUsgsObserved(bundle.usgsId, fetchers, opts),
    fetchUsgsGaugeZero(bundle.usgsId, fetchers, opts),
  ]);
  return {
    ...bundle,
    observed: observed ?? bundle.observed,
    gaugeZeroFt: zero ? zero.altVaFt : null,
    gaugeDatum: zero ? zero.datum : null,
  };
}

export async function fetchGaugeBundle(
  candidate: GaugeCandidate,
  fetchers: Fetchers = defaultFetchers,
  opts: UsgsOptions = {},
): Promise<GaugeBundle> {
  return withUsgs(await fetchNwpsBundle(candidate, fetchers), fetchers, opts);
}

/**
 * Nearest forecast-capable gauge within the radius: probe candidates
 * nearest-first (bounded) and return the first with a usable forecast.
 *
 * KNOWN DEVIATION from Appendix A3: the spec prefers the nearest gauge on
 * the SAME waterbody "when resolvable". A pin's waterbody isn't resolvable
 * from any of our keyless sources (it would need NHD flowline queries), so
 * CrestWatch uses straight distance. The Why screen always names the gauge
 * and its river so a mismatch is visible, and docs/SUBMISSION.md flags
 * this for the validation pass.
 */
export async function pickForecastGauge(
  lat: number,
  lon: number,
  radiusMi: number,
  fetchers: Fetchers = defaultFetchers,
  maxProbe = 6,
  opts: UsgsOptions = {},
): Promise<GaugeBundle | null> {
  const candidates = await findNearbyGauges(lat, lon, radiusMi, fetchers.json);
  for (const c of candidates.slice(0, maxProbe)) {
    try {
      // USGS only for the gauge we keep: a probe that has no forecast is
      // thrown away, so it must not pay for (or wait on) USGS calls.
      const nwps = await fetchNwpsBundle(c, fetchers);
      if (nwps.forecast.length >= 2) return await withUsgs(nwps, fetchers, opts);
    } catch {
      // one broken gauge must not sink the search
    }
  }
  return null;
}
