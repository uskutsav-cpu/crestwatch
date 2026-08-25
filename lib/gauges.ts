/**
 * Gauge client (T03, Appendix D3–D5). All NWPS/USGS parsing lives here —
 * field names drift, so every adapter is fixture-tested against recorded
 * responses. Injectable fetchers; no other file touches these APIs.
 */

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

export const usgsSiteUrl = (site: string) =>
  `https://waterservices.usgs.gov/nwis/site/?sites=${site}&siteOutput=expanded&format=rdb`;

export const usgsIvUrl = (site: string, hours = 48) =>
  `https://waterservices.usgs.gov/nwis/iv/?sites=${site}&parameterCd=00065&format=json&period=PT${hours}H`;

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
      typeof p.validTime === "string"
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
 * Parse gauge-zero elevation + vertical datum from USGS site RDB text.
 * Robust to multi-row responses: matches the requested site number when
 * given, and always skips the RDB format row ("5s\t15s\t…") wherever it
 * falls rather than assuming a fixed line index.
 */
export function parseAltVa(
  rdb: string,
  site?: string,
): { altVaFt: number; datum: string | null } | null {
  const lines = rdb.split("\n").filter((l) => l && !l.startsWith("#"));
  if (lines.length < 3) return null;
  const cols = lines[0].split("\t");
  const iAlt = cols.indexOf("alt_va");
  const iDatum = cols.indexOf("alt_datum_cd");
  const iSite = cols.indexOf("site_no");
  if (iAlt < 0) return null;

  const isFormatRow = (cells: string[]) =>
    cells.every((c) => /^\d+[sdn]$/.test(c.trim()));

  for (const line of lines.slice(1)) {
    const row = line.split("\t");
    if (isFormatRow(row)) continue;
    if (site && iSite >= 0 && (row[iSite] ?? "").trim() !== site) continue;
    const altVaFt = parseFloat((row[iAlt] ?? "").trim());
    if (!Number.isFinite(altVaFt)) continue;
    const datum = (row[iDatum] ?? "").trim();
    return { altVaFt, datum: datum || null };
  }
  return null;
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

export async function fetchGaugeBundle(
  candidate: GaugeCandidate,
  fetchers: Fetchers = defaultFetchers,
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

  let observed = parseStageflowSeries(stageflow.observed);
  let gaugeZeroFt: number | null = null;
  let gaugeDatum: string | null = null;

  if (usgsId) {
    // USGS side is best-effort: IV gives finer observed data; site info
    // gives the FULL-tier key. Either failing must not sink the bundle.
    const [ivRes, siteRes] = await Promise.allSettled([
      fetchers.json(usgsIvUrl(usgsId)),
      fetchers.text(usgsSiteUrl(usgsId)),
    ]);
    if (ivRes.status === "fulfilled") {
      const iv = parseIvSeries(ivRes.value);
      if (iv.length > 0) observed = iv;
    }
    if (siteRes.status === "fulfilled") {
      const alt = parseAltVa(siteRes.value, usgsId);
      if (alt) {
        gaugeZeroFt = alt.altVaFt;
        gaugeDatum = alt.datum ?? null;
      }
    }
  }

  return {
    lid: candidate.lid,
    name: detail.name ?? candidate.name,
    usgsId,
    lat: candidate.lat,
    lon: candidate.lon,
    distanceMi: candidate.distanceMi,
    observed,
    forecast: parseStageflowSeries(stageflow.forecast),
    forecastIssued: stageflow.forecast?.issuedTime ?? null,
    categories: parseCategories(detail),
    gaugeZeroFt,
    gaugeDatum,
    historicCrests: parseHistoricCrests(detail),
  };
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
): Promise<GaugeBundle | null> {
  const candidates = await findNearbyGauges(lat, lon, radiusMi, fetchers.json);
  for (const c of candidates.slice(0, maxProbe)) {
    try {
      const bundle = await fetchGaugeBundle(c, fetchers);
      if (bundle.forecast.length >= 2) return bundle;
    } catch {
      // one broken gauge must not sink the search
    }
  }
  return null;
}
