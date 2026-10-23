import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_USGS_TIMEOUT_MS,
  WATERDATA_FIRST_FROM,
  WATERDATA_TIMEOUT_MS,
  fetchGaugeBundle,
  fetchUsgsGaugeZero,
  fetchUsgsObserved,
  nwpsDetailUrl,
  nwpsListUrl,
  nwpsStageflowUrl,
  parseAltVa,
  parseWaterdataSeries,
  parseWaterdataSite,
  pickForecastGauge,
  usgsIvUrl,
  usgsSiteUrl,
  usgsSourceOrder,
  waterdataIvUrl,
  waterdataSiteUrl,
  type Fetchers,
} from "@/lib/gauges";
import { testFetchers } from "@/lib/test-fetchers";
import { MAX_GAUGE_ZERO_ACCURACY_FT } from "@/lib/config";
import { survey } from "@/lib/surveyor";

/**
 * #50: USGS is shutting down waterservices.usgs.gov (2 s delay from
 * 2026-11-16, 10 s from 2027-01-11, gone 2027-02-22). Gauge zero and the
 * 48 h series now come from either the legacy service or the new Water
 * Data API, in date order, each falling back to the other.
 */

const FIX = join(__dirname, "fixtures", "gauges");
const readJson = (f: string) =>
  JSON.parse(readFileSync(join(FIX, f), "utf8")) as unknown;
const readText = (f: string) => readFileSync(join(FIX, f), "utf8");

const BEFORE = () => Date.parse("2026-10-23T12:00:00Z"); // judging window
const LAST_LEGACY_MS = () => Date.parse(WATERDATA_FIRST_FROM) - 1;
const SWITCH = () => Date.parse(WATERDATA_FIRST_FROM); // 2027-01-11T00:00Z
const AFTER = () => Date.parse("2027-02-23T00:00:00Z"); // legacy gone

const SITE = "02486000"; // Pearl River at Jackson (FULL tier)

const HTML_PAGE =
  "<!DOCTYPE html><html><head><title>WDFN blog</title></head><body>WaterServices is unavailable.</body></html>";

type Behaviour = "ok" | "throw" | "html" | "empty";

interface Call {
  host: string;
  url: string;
  timeoutMs?: number;
}

/**
 * Fetchers that serve the recorded fixtures for both sources, with each
 * source's behaviour switchable, and a log of every call in order.
 */
function usgsFetchers(
  legacy: Behaviour = "ok",
  waterdata: Behaviour = "ok",
  site = SITE,
): { fetchers: Fetchers; calls: Call[] } {
  const calls: Call[] = [];
  const legacyIv = readJson(`usgs_iv_${site}.json`);
  const legacyRdb = readText(`usgs_site_${site}.rdb`);
  const wdIv = readJson(`waterdata_iv_${site}.json`);
  const wdSite = readJson(`waterdata_site_${site}.json`);

  const fail = (b: Behaviour, kind: "json" | "text") => {
    if (b === "throw") throw new Error("The operation was aborted due to timeout");
    // Real fetchJson throws on an HTML page; fetchText hands it back.
    if (b === "html" && kind === "json") {
      throw new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON");
    }
  };

  const fetchers: Fetchers = {
    json: async (url, opts) => {
      const host = new URL(url).hostname;
      calls.push({ host, url, timeoutMs: opts?.timeoutMs });
      if (url === usgsIvUrl(site)) {
        fail(legacy, "json");
        return legacy === "empty" ? { value: { timeSeries: [] } } : legacyIv;
      }
      if (url === waterdataIvUrl(site)) {
        fail(waterdata, "json");
        return waterdata === "empty" ? { type: "FeatureCollection", features: [] } : wdIv;
      }
      if (url === waterdataSiteUrl(site)) {
        fail(waterdata, "json");
        return waterdata === "empty" ? { type: "Feature", properties: { altitude: null } } : wdSite;
      }
      throw new Error(`no json fixture for ${url}`);
    },
    text: async (url, opts) => {
      const host = new URL(url).hostname;
      calls.push({ host, url, timeoutMs: opts?.timeoutMs });
      if (url === usgsSiteUrl(site)) {
        fail(legacy, "text");
        if (legacy === "html") return HTML_PAGE;
        return legacy === "empty" ? "# no sites found\n" : legacyRdb;
      }
      throw new Error(`no text fixture for ${url}`);
    },
  };
  return { fetchers, calls };
}

const hosts = (calls: Call[]) => calls.map((c) => c.host);
const LEGACY = "waterservices.usgs.gov";
const NEW = "api.waterdata.usgs.gov";

// The two recorded series differ (Aug 2026 legacy vs Oct 2026 new API),
// which tells us which source answered.
const LEGACY_LAST = { t: "2026-08-25T04:30:00.000Z", stageFt: 3.21 };
const NEW_LAST = { t: "2026-10-23T18:30:00.000Z", stageFt: 3.14 };

describe("source order follows USGS's published schedule", () => {
  it("legacy first before 2027-01-11T00:00:00Z, new API first on and after it", () => {
    expect(usgsSourceOrder(BEFORE())).toEqual(["legacy", "waterdata"]);
    expect(usgsSourceOrder(LAST_LEGACY_MS())).toEqual(["legacy", "waterdata"]);
    expect(usgsSourceOrder(SWITCH())).toEqual(["waterdata", "legacy"]);
    expect(usgsSourceOrder(AFTER())).toEqual(["waterdata", "legacy"]);
  });

  it("legacy-first: healthy legacy answers both calls, new API untouched", async () => {
    const { fetchers, calls } = usgsFetchers();
    const zero = await fetchUsgsGaugeZero(SITE, fetchers, { now: BEFORE });
    const obs = await fetchUsgsObserved(SITE, fetchers, { now: BEFORE });
    expect(zero).toEqual({ altVaFt: 233.39, datum: "NAVD88" });
    expect(obs?.at(-1)).toEqual(LEGACY_LAST);
    expect(hosts(calls)).toEqual([LEGACY, LEGACY]);
  });

  it("new-first: healthy new API answers both calls, legacy untouched", async () => {
    const { fetchers, calls } = usgsFetchers();
    const zero = await fetchUsgsGaugeZero(SITE, fetchers, { now: SWITCH });
    const obs = await fetchUsgsObserved(SITE, fetchers, { now: SWITCH });
    expect(zero).toEqual({ altVaFt: 233.39, datum: "NAVD88" });
    expect(obs?.at(-1)).toEqual(NEW_LAST);
    expect(hosts(calls)).toEqual([NEW, NEW]);
  });

  it("the clock is read per call, not frozen at import", async () => {
    let now = BEFORE();
    const { fetchers, calls } = usgsFetchers();
    await fetchUsgsGaugeZero(SITE, fetchers, { now: () => now });
    now = AFTER();
    await fetchUsgsGaugeZero(SITE, fetchers, { now: () => now });
    expect(hosts(calls)).toEqual([LEGACY, NEW]);
  });
});

describe("fallback in both directions", () => {
  it("legacy-first, legacy throws (timeout) → new API", async () => {
    const { fetchers, calls } = usgsFetchers("throw", "ok");
    const zero = await fetchUsgsGaugeZero(SITE, fetchers, { now: BEFORE });
    const obs = await fetchUsgsObserved(SITE, fetchers, { now: BEFORE });
    expect(zero).toEqual({ altVaFt: 233.39, datum: "NAVD88" });
    expect(obs?.at(-1)).toEqual(NEW_LAST);
    expect(hosts(calls)).toEqual([LEGACY, NEW, LEGACY, NEW]);
  });

  it("new-first, new API throws (429 / timeout) → legacy", async () => {
    const { fetchers, calls } = usgsFetchers("ok", "throw");
    const zero = await fetchUsgsGaugeZero(SITE, fetchers, { now: AFTER });
    const obs = await fetchUsgsObserved(SITE, fetchers, { now: AFTER });
    expect(zero).toEqual({ altVaFt: 233.39, datum: "NAVD88" });
    expect(obs?.at(-1)).toEqual(LEGACY_LAST);
    expect(hosts(calls)).toEqual([NEW, LEGACY, NEW, LEGACY]);
  });

  it("legacy outage page (HTML body, 200 after redirect) → new API", async () => {
    const { fetchers, calls } = usgsFetchers("html", "ok");
    const zero = await fetchUsgsGaugeZero(SITE, fetchers, { now: BEFORE });
    const obs = await fetchUsgsObserved(SITE, fetchers, { now: BEFORE });
    expect(zero).toEqual({ altVaFt: 233.39, datum: "NAVD88" });
    expect(obs?.at(-1)).toEqual(NEW_LAST);
    expect(hosts(calls)).toEqual([LEGACY, NEW, LEGACY, NEW]);
  });

  it("an HTML string handed back as 'json' is not data either", async () => {
    const calls: string[] = [];
    const fetchers: Fetchers = {
      json: async (url) => {
        calls.push(new URL(url).hostname);
        return url.includes(NEW) ? HTML_PAGE : readJson(`usgs_iv_${SITE}.json`);
      },
      text: async () => readText(`usgs_site_${SITE}.rdb`),
    };
    const obs = await fetchUsgsObserved(SITE, fetchers, { now: AFTER });
    expect(obs?.at(-1)).toEqual(LEGACY_LAST);
    expect(calls).toEqual([NEW, LEGACY]);
    const zero = await fetchUsgsGaugeZero(SITE, fetchers, { now: AFTER });
    expect(zero).toEqual({ altVaFt: 233.39, datum: "NAVD88" });
  });

  it("no usable value (empty series, no altitude) also moves on", async () => {
    const a = usgsFetchers("empty", "ok");
    expect((await fetchUsgsObserved(SITE, a.fetchers, { now: BEFORE }))?.at(-1)).toEqual(NEW_LAST);
    expect(await fetchUsgsGaugeZero(SITE, a.fetchers, { now: BEFORE })).toEqual({
      altVaFt: 233.39,
      datum: "NAVD88",
    });
    const b = usgsFetchers("ok", "empty");
    expect((await fetchUsgsObserved(SITE, b.fetchers, { now: AFTER }))?.at(-1)).toEqual(LEGACY_LAST);
    expect(await fetchUsgsGaugeZero(SITE, b.fetchers, { now: AFTER })).toEqual({
      altVaFt: 233.39,
      datum: "NAVD88",
    });
  });

  it("both down → null, and the bundle still stands (NWPS observed, CATEGORY)", async () => {
    const { fetchers } = usgsFetchers("throw", "throw");
    expect(await fetchUsgsGaugeZero(SITE, fetchers, { now: BEFORE })).toBeNull();
    expect(await fetchUsgsObserved(SITE, fetchers, { now: AFTER })).toBeNull();

    const nwps: Fetchers = {
      json: async (url, o) =>
        url === nwpsDetailUrl("JACM6")
          ? readJson("nwps_detail_JACM6.json")
          : url === nwpsStageflowUrl("JACM6")
            ? readJson("nwps_stageflow_JACM6.json")
            : fetchers.json(url, o),
      text: fetchers.text,
    };
    const b = await fetchGaugeBundle(
      { lid: "JACM6", name: "Pearl River at Jackson", lat: 32.28138889, lon: -90.1788889, distanceMi: 1 },
      nwps,
      { now: AFTER },
    );
    expect(b.gaugeZeroFt).toBeNull();
    expect(b.gaugeDatum).toBeNull();
    expect(b.observed.length).toBeGreaterThan(0);
  });
});

describe("bounded latency", () => {
  it("legacy gets the tight ~6 s timeout; the new API its own", async () => {
    const { fetchers, calls } = usgsFetchers("throw", "ok");
    await fetchUsgsGaugeZero(SITE, fetchers, { now: BEFORE });
    await fetchUsgsObserved(SITE, fetchers, { now: BEFORE });
    expect(LEGACY_USGS_TIMEOUT_MS).toBeLessThanOrEqual(6_000);
    for (const c of calls) {
      expect(c.timeoutMs).toBe(c.host === LEGACY ? LEGACY_USGS_TIMEOUT_MS : WATERDATA_TIMEOUT_MS);
    }
  });

  it("pickForecastGauge calls USGS only for the gauge it keeps", async () => {
    // Every candidate carries Jackson's USGS id; only the 3rd has a forecast.
    const YAZOO = { lat: 32.846783396348, lon: -90.412396914911 };
    const list = readJson("nwps_list_yazoo.json") as { gauges: Array<{ lid: string }> };
    const noForecast = JSON.parse(JSON.stringify(readJson("nwps_stageflow_JACM6.json")));
    noForecast.forecast.data = [];
    const { fetchers: usgs, calls } = usgsFetchers("throw", "throw");
    let probe = 0;
    const order: string[] = [];
    const fetchers: Fetchers = {
      json: async (url, o) => {
        if (url === nwpsListUrl(YAZOO.lat, YAZOO.lon, 25)) return list;
        const m = /\/gauges\/([A-Z0-9]+)(\/stageflow)?$/.exec(url);
        if (m && url.startsWith("https://api.water.noaa.gov")) {
          if (!m[2]) {
            order.push(m[1]);
            return readJson("nwps_detail_JACM6.json");
          }
          probe++;
          return probe === 3 ? readJson("nwps_stageflow_JACM6.json") : noForecast;
        }
        return usgs.json(url, o);
      },
      text: usgs.text,
    };
    const b = await pickForecastGauge(YAZOO.lat, YAZOO.lon, 25, fetchers, 6, { now: BEFORE });
    expect(b?.lid).toBe(order[2]);
    // One gauge kept → one datum chain + one series chain (2 sources each).
    expect(calls).toHaveLength(4);
  });
});

describe("new API parsing: values are STRINGS and order is not promised", () => {
  it("parses string values, sorts ascending, drops junk and duplicate times", () => {
    const series = parseWaterdataSeries({
      type: "FeatureCollection",
      features: [
        { properties: { time: "2026-10-23T18:30:00+00:00", value: "3.14" } },
        { properties: { time: "2026-10-23T18:00:00+00:00", value: "3.10" } },
        { properties: { time: "2026-10-23T18:15:00+00:00", value: "3.12" } },
        { properties: { time: "2026-10-23T18:15:00+00:00", value: "9.99" } }, // dup time
        { properties: { time: "2026-10-23T17:45:00+00:00", value: null } },
        { properties: { time: "2026-10-23T17:30:00+00:00", value: "Ice" } },
        { properties: { time: "2026-10-23T17:15:00+00:00", value: "-999999" } },
        { properties: { time: "not a time", value: "3.0" } },
        { properties: {} },
        {},
      ],
    });
    expect(series).toEqual([
      { t: "2026-10-23T18:00:00.000Z", stageFt: 3.1 },
      { t: "2026-10-23T18:15:00.000Z", stageFt: 3.12 },
      { t: "2026-10-23T18:30:00.000Z", stageFt: 3.14 },
    ]);
    for (const p of series) expect(typeof p.stageFt).toBe("number");
  });

  it("the recorded fixtures parse to the same shape legacy IV gives", async () => {
    const legacy = usgsFetchers();
    const fresh = usgsFetchers();
    const a = await fetchUsgsObserved(SITE, legacy.fetchers, { now: BEFORE });
    const b = await fetchUsgsObserved(SITE, fresh.fetchers, { now: AFTER });
    expect(a!.length).toBeGreaterThan(0);
    expect(b!.length).toBeGreaterThan(0);
    for (const p of [...a!, ...b!]) {
      expect(Object.keys(p).sort()).toEqual(["stageFt", "t"]);
      expect(p.t).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/);
      expect(Number.isFinite(p.stageFt)).toBe(true);
    }
    const ts = b!.map((p) => Date.parse(p.t));
    expect([...ts].sort((x, y) => x - y)).toEqual(ts);
  });

  it("monitoring-locations: altitude + vertical_datum, USGS only", () => {
    expect(parseWaterdataSite(readJson("waterdata_site_02486000.json"), "02486000")).toEqual({
      altVaFt: 233.39,
      datum: "NAVD88",
    });
    expect(parseWaterdataSite(readJson("waterdata_site_07289730.json"), "07289730")).toEqual({
      altVaFt: 130.18,
      datum: "NGVD29",
    });
    // Vicksburg on the new API is already the USGS record (no USCE row).
    expect(parseWaterdataSite(readJson("waterdata_site_07289000.json"), "07289000")).toEqual({
      altVaFt: 46.22,
      datum: "NGVD29",
    });
    expect(parseWaterdataSite({ properties: { agency_code: "USCE", altitude: 73 } })).toBeNull();
    expect(parseWaterdataSite({ properties: { agency_code: "USGS", altitude: null } })).toBeNull();
    expect(parseWaterdataSite({ properties: { altitude: "46.22", vertical_datum: "NGVD29" } })).toEqual({
      altVaFt: 46.22,
      datum: "NGVD29",
    });
    // 0.00 is real: reservoir gauges (Ross Barnett, Ratliff's Ferry) read in elevation.
    expect(parseWaterdataSite({ properties: { agency_code: "USGS", altitude: 0, vertical_datum: "NGVD29" } })).toEqual({
      altVaFt: 0,
      datum: "NGVD29",
    });
    expect(parseWaterdataSite(readJson("waterdata_site_02486000.json"), "99999999")).toBeNull();
    expect(parseWaterdataSite("<html>")).toBeNull();
    expect(parseWaterdataSite(null)).toBeNull();
  });
});

describe("whole bundles are the same shape from either source", () => {
  const candidate = {
    lid: "JACM6",
    name: "Pearl River at Jackson",
    lat: 32.28138889,
    lon: -90.1788889,
    distanceMi: 1.2,
  };

  it("Jackson FULL tier from legacy (before) and from the new API (after)", async () => {
    const before = await fetchGaugeBundle(candidate, testFetchers, { now: BEFORE });
    const after = await fetchGaugeBundle(candidate, testFetchers, { now: AFTER });
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const b of [before, after]) {
      expect(b.usgsId).toBe("02486000");
      expect(b.gaugeZeroFt).toBeCloseTo(233.39, 2);
      expect(b.gaugeDatum).toBe("NAVD88");
      expect(b.observed.length).toBeGreaterThan(0);
    }
    expect(before.observed.at(-1)).toEqual(LEGACY_LAST);
    expect(after.observed.at(-1)).toEqual(NEW_LAST);
  });

  it("CRESTWATCH_TEST fixtures cover the new API for every e2e USGS site", async () => {
    for (const site of ["02486000", "07289730"]) {
      expect(await testFetchers.json(waterdataSiteUrl(site))).toBeTruthy();
      expect(
        parseWaterdataSeries(await testFetchers.json(waterdataIvUrl(site))).length,
      ).toBeGreaterThan(0);
    }
    // Anything else on that host fails loudly rather than reaching the network.
    await expect(
      testFetchers.json("https://api.waterdata.usgs.gov/ogcapi/v1/collections/daily/items"),
    ).rejects.toThrow(/no fixture route/);
  });
});

/**
 * Gauge-zero accuracy guard. Greenville (GEEM6), Sarah (SARM6) and
 * Lambert (LMGM6) publish a gauge zero good only to ±10 ft, wider than
 * the BORDERLINE band. A gauge zero looser than MAX_GAUGE_ZERO_ACCURACY_FT
 * counts as missing (CATEGORY tier), the same way on both sources.
 */
describe("gauge-zero accuracy guard", () => {
  // GEEM6's real legacy USGS row, with alt_acy_va swapped in.
  const greenvilleRdb = (acy: string) =>
    [
      "agency_cd\tsite_no\tstation_nm\talt_va\talt_meth_cd\talt_acy_va\talt_datum_cd",
      "5s\t15s\t50s\t8s\t1s\t3s\t10s",
      `USGS\t07265455\tMISSISSIPPI RIVER NEAR GREENVILLE, MS\t 74.92\tU\t${acy}\tNGVD29`,
    ].join("\n");
  // GEEM6's new-API record, with altitude_accuracy swapped in.
  const greenvilleSite = (acy?: unknown) => ({
    type: "Feature",
    properties: {
      agency_code: "USGS",
      monitoring_location_number: "07265455",
      altitude: 74.92,
      altitude_method_code: "U",
      vertical_datum: "NGVD29",
      ...(acy === undefined ? {} : { altitude_accuracy: acy }),
    },
  });
  const GREENVILLE = { altVaFt: 74.92, datum: "NGVD29" };

  it("is a team-owned 1 ft", () => {
    expect(MAX_GAUGE_ZERO_ACCURACY_FT).toBe(1);
  });

  it("legacy alt_acy_va: 0.1 ok, 10 rejected, blank ok", () => {
    expect(parseAltVa(greenvilleRdb("0.1"), "07265455")).toEqual(GREENVILLE);
    expect(parseAltVa(greenvilleRdb(".1"), "07265455")).toEqual(GREENVILLE);
    expect(parseAltVa(greenvilleRdb("1"), "07265455")).toEqual(GREENVILLE); // the limit itself
    expect(parseAltVa(greenvilleRdb(" 10"), "07265455")).toBeNull();
    expect(parseAltVa(greenvilleRdb("1.6"), "07265455")).toBeNull();
    expect(parseAltVa(greenvilleRdb(""), "07265455")).toEqual(GREENVILLE);
    expect(parseAltVa(greenvilleRdb(" "), "07265455")).toEqual(GREENVILLE);
    // No accuracy column at all keeps today's behaviour too.
    const noColumn = [
      "agency_cd\tsite_no\talt_va\talt_datum_cd",
      "5s\t15s\t8s\t10s",
      "USGS\t07265455\t 74.92\tNGVD29",
    ].join("\n");
    expect(parseAltVa(noColumn, "07265455")).toEqual(GREENVILLE);
  });

  it("legacy: the USCE row at ±1 ft can't stand in for the USGS row at ±10 ft", () => {
    // GEEM6's real layout: the Army Corps row is listed first.
    const rdb = [
      "agency_cd\tsite_no\tstation_nm\talt_va\talt_meth_cd\talt_acy_va\talt_datum_cd",
      "5s\t15s\t50s\t8s\t1s\t3s\t10s",
      "USCE\t07265455\t(USACE) Mississippi River near Greenville, MS\t74.92\tR\t1\tNGVD29",
      "USGS\t07265455\tMISSISSIPPI RIVER NEAR GREENVILLE, MS\t 74.92\tU\t 10\tNGVD29",
    ].join("\n");
    expect(parseAltVa(rdb, "07265455")).toBeNull();
  });

  it("the recorded fixtures (±0.1 ft) still pass", () => {
    for (const site of ["02486000", "07289000", "07289730"]) {
      expect(parseAltVa(readText(`usgs_site_${site}.rdb`), site)).not.toBeNull();
      expect(parseWaterdataSite(readJson(`waterdata_site_${site}.json`), site)).not.toBeNull();
    }
  });

  it("new API altitude_accuracy: 0.1 ok, 10 rejected, blank ok", () => {
    expect(parseWaterdataSite(greenvilleSite(0.1), "07265455")).toEqual(GREENVILLE);
    expect(parseWaterdataSite(greenvilleSite(1), "07265455")).toEqual(GREENVILLE);
    expect(parseWaterdataSite(greenvilleSite(10), "07265455")).toBeNull();
    expect(parseWaterdataSite(greenvilleSite(10.0), "07265455")).toBeNull();
    expect(parseWaterdataSite(greenvilleSite("10"), "07265455")).toBeNull();
    expect(parseWaterdataSite(greenvilleSite(null), "07265455")).toEqual(GREENVILLE);
    expect(parseWaterdataSite(greenvilleSite(""), "07265455")).toEqual(GREENVILLE);
    expect(parseWaterdataSite(greenvilleSite(), "07265455")).toEqual(GREENVILLE);
  });

  /** Jackson's recorded fixtures with both sources' accuracy set to `acy`. */
  function looseJackson(acy: number) {
    const base = usgsFetchers();
    const rdb = readText(`usgs_site_${SITE}.rdb`);
    const header = rdb.split("\n").find((l) => l.startsWith("agency_cd"))!.split("\t");
    const iAcy = header.indexOf("alt_acy_va");
    const looseRdb = rdb
      .split("\n")
      .map((l) => {
        if (!l.startsWith("USGS\t")) return l;
        const cells = l.split("\t");
        cells[iAcy] = String(acy);
        return cells.join("\t");
      })
      .join("\n");
    const site = readJson(`waterdata_site_${SITE}.json`) as { properties: Record<string, unknown> };
    const looseSite = { ...site, properties: { ...site.properties, altitude_accuracy: acy } };
    const fetchers: Fetchers = {
      json: async (url, o) => {
        if (url === nwpsDetailUrl("JACM6")) return readJson("nwps_detail_JACM6.json");
        if (url === nwpsStageflowUrl("JACM6")) return readJson("nwps_stageflow_JACM6.json");
        const v = await base.fetchers.json(url, o);
        return url === waterdataSiteUrl(SITE) ? looseSite : v;
      },
      text: async (url, o) => {
        const v = await base.fetchers.text(url, o);
        return url === usgsSiteUrl(SITE) ? looseRdb : v;
      },
    };
    return { fetchers, calls: base.calls };
  }

  it("both sources, both dates: ±10 ft is null, so the 2027-01-11 switch can't flip a tier", async () => {
    const before = looseJackson(10);
    expect(await fetchUsgsGaugeZero(SITE, before.fetchers, { now: BEFORE })).toBeNull();
    // Rejected by legacy, then by the new API: same rule on both.
    expect(hosts(before.calls)).toEqual([LEGACY, NEW]);

    const after = looseJackson(10);
    expect(await fetchUsgsGaugeZero(SITE, after.fetchers, { now: AFTER })).toBeNull();
    expect(hosts(after.calls)).toEqual([NEW, LEGACY]);

    for (const now of [BEFORE, AFTER]) {
      const tight = looseJackson(0.1);
      expect(await fetchUsgsGaugeZero(SITE, tight.fetchers, { now })).toEqual({
        altVaFt: 233.39,
        datum: "NAVD88",
      });
    }
  });

  it("a ±10 ft gauge zero gives a CATEGORY verdict, not FULL", async () => {
    const candidate = {
      lid: "JACM6",
      name: "Pearl River at Jackson",
      lat: 32.28138889,
      lon: -90.1788889,
      distanceMi: 1.2,
    };
    const verdictTier = async (acy: number, now: () => number) => {
      const b = await fetchGaugeBundle(candidate, looseJackson(acy).fetchers, { now });
      return survey({ pinElevationFt: 275.5, gauge: b, now: "2026-08-25T05:00:00Z" }).tier;
    };
    for (const now of [BEFORE, AFTER]) {
      expect(await verdictTier(10, now)).toBe("CATEGORY");
      expect(await verdictTier(0.1, now)).toBe("FULL");
    }
  });
});
