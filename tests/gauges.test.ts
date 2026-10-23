import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  datumLooksSane,
  fetchGaugeBundle,
  findNearbyGauges,
  haversineMi,
  nwpsDetailUrl,
  nwpsListUrl,
  nwpsStageflowUrl,
  parseAltVa,
  pickForecastGauge,
  usgsIvUrl,
  usgsSiteUrl,
  type Fetchers,
} from "@/lib/gauges";

const FIX = join(__dirname, "fixtures", "gauges");
const readJson = (f: string) =>
  JSON.parse(readFileSync(join(FIX, f), "utf8")) as unknown;
const readText = (f: string) => readFileSync(join(FIX, f), "utf8");

/** Fixture-backed fetchers keyed by exact URL. */
function fixtureFetchers(
  jsonMap: Record<string, unknown>,
  textMap: Record<string, string> = {},
): Fetchers {
  return {
    json: async (url) => {
      if (url in jsonMap) return jsonMap[url];
      throw new Error(`no json fixture for ${url}`);
    },
    text: async (url) => {
      if (url in textMap) return textMap[url];
      throw new Error(`no text fixture for ${url}`);
    },
  };
}

// Yazoo City coordinates (fixture bbox center).
const YAZOO = { lat: 32.846783396348, lon: -90.412396914911 };

function yazooCityFetchers(): Fetchers {
  return fixtureFetchers(
    {
      [nwpsListUrl(YAZOO.lat, YAZOO.lon, 25)]: readJson("nwps_list_yazoo.json"),
      [nwpsDetailUrl("YZOM6")]: readJson("nwps_detail_YZOM6.json"),
      [nwpsStageflowUrl("YZOM6")]: readJson("nwps_stageflow_YZOM6.json"),
    },
    {},
  );
}

describe("gauge discovery (NWPS list)", () => {
  it("finds gauges near Yazoo City sorted by distance", async () => {
    const f = yazooCityFetchers();
    const candidates = await findNearbyGauges(YAZOO.lat, YAZOO.lon, 25, f.json);
    expect(candidates.length).toBeGreaterThanOrEqual(5);
    expect(candidates[0].lid).toBe("YZOM6"); // the town's own gauge is nearest
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].distanceMi).toBeGreaterThanOrEqual(
        candidates[i - 1].distanceMi,
      );
    }
  });

  it("haversine sanity: Yazoo City → Jackson ≈ 40 mi straight-line", () => {
    const d = haversineMi(32.8468, -90.4124, 32.3004, -90.1884);
    expect(d).toBeGreaterThan(35);
    expect(d).toBeLessThan(45);
  });
});

describe("GaugeBundle — Yazoo River at Yazoo City (CATEGORY-tier gauge)", () => {
  it("normalizes detail + stageflow; empty usgsId → null gauge zero", async () => {
    const f = yazooCityFetchers();
    const [c] = await findNearbyGauges(YAZOO.lat, YAZOO.lon, 25, f.json);
    const b = await fetchGaugeBundle(c, f);
    expect(b.lid).toBe("YZOM6");
    expect(b.name).toBe("Yazoo River at Yazoo City");
    expect(b.usgsId).toBeNull();
    expect(b.gaugeZeroFt).toBeNull();
    expect(b.observed.length).toBeGreaterThan(0);
    expect(b.forecast.length).toBeGreaterThanOrEqual(2);
    expect(b.forecastIssued).toBeTruthy();
    expect(b.categories).toMatchObject({
      action: 28,
      minor: 29,
      moderate: 36,
      major: 43,
    });
  });
});

describe("GaugeBundle — Pearl River at Jackson (FULL-tier gauge)", () => {
  const candidate = {
    lid: "JACM6",
    name: "Pearl River at Jackson",
    lat: 32.28138889,
    lon: -90.1788889,
    distanceMi: 1.2,
  };

  function jacksonFetchers(): Fetchers {
    return fixtureFetchers(
      {
        [nwpsDetailUrl("JACM6")]: readJson("nwps_detail_JACM6.json"),
        [nwpsStageflowUrl("JACM6")]: readJson("nwps_stageflow_JACM6.json"),
        [usgsIvUrl("02486000")]: readJson("usgs_iv_02486000.json"),
      },
      { [usgsSiteUrl("02486000")]: readText("usgs_site_02486000.rdb") },
    );
  }

  it("unlocks FULL tier: alt_va 233.39 ft NAVD88, IV observed preferred", async () => {
    const b = await fetchGaugeBundle(candidate, jacksonFetchers());
    expect(b.usgsId).toBe("02486000");
    expect(b.gaugeZeroFt).toBeCloseTo(233.39, 2);
    expect(b.gaugeDatum).toBe("NAVD88");
    // IV series (15-min) replaces the NWPS observed series.
    expect(b.observed.length).toBeGreaterThan(0);
    expect(b.observed.at(-1)!.stageFt).toBeGreaterThan(0);
    expect(b.forecast.length).toBeGreaterThanOrEqual(2);
    expect(b.historicCrests.length).toBeGreaterThan(0);
    // 1979 Easter flood is the flood of record at Jackson.
    expect(b.historicCrests[0].stageFt).toBeCloseTo(43.28, 2);
  });

  it("still produces a bundle when the USGS side is down (datum lost → CATEGORY)", async () => {
    const f = fixtureFetchers(
      {
        [nwpsDetailUrl("JACM6")]: readJson("nwps_detail_JACM6.json"),
        [nwpsStageflowUrl("JACM6")]: readJson("nwps_stageflow_JACM6.json"),
        // no IV fixture — the USGS json fetch will throw
      },
      {}, // no site fixture — the text fetch will throw
    );
    const b = await fetchGaugeBundle(candidate, f);
    expect(b.gaugeZeroFt).toBeNull();
    expect(b.observed.length).toBeGreaterThan(0); // NWPS observed fallback
  });
});

describe("GaugeBundle — Big Black near Bentonia (NGVD29 datum)", () => {
  it("carries the non-NAVD88 datum code through", async () => {
    const candidate = {
      lid: "BTAM6",
      name: "Big Black River near Bentonia",
      lat: 32.603055,
      lon: -90.36388,
      distanceMi: 9,
    };
    const f = fixtureFetchers(
      {
        [nwpsDetailUrl("BTAM6")]: readJson("nwps_detail_BTAM6.json"),
        [nwpsStageflowUrl("BTAM6")]: readJson("nwps_stageflow_BTAM6.json"),
        [usgsIvUrl("07289730")]: readJson("usgs_iv_07289730.json"),
      },
      { [usgsSiteUrl("07289730")]: readText("usgs_site_07289730.rdb") },
    );
    const b = await fetchGaugeBundle(candidate, f);
    expect(b.gaugeZeroFt).toBeCloseTo(130.18, 2);
    expect(b.gaugeDatum).toBe("NGVD29");
  });
});

describe("pickForecastGauge", () => {
  it("returns the nearest forecast-capable gauge", async () => {
    const b = await pickForecastGauge(YAZOO.lat, YAZOO.lon, 25, yazooCityFetchers());
    expect(b?.lid).toBe("YZOM6");
  });

  it("returns null when no gauge has a forecast (ALERT-ONLY path)", async () => {
    const list = readJson("nwps_list_yazoo.json") as {
      gauges: Array<Record<string, unknown>>;
    };
    const noForecast = JSON.parse(
      JSON.stringify(readJson("nwps_stageflow_YZOM6.json")),
    ) as { forecast?: { data?: unknown[] } };
    if (noForecast.forecast) noForecast.forecast.data = [];
    const jsonMap: Record<string, unknown> = {
      [nwpsListUrl(YAZOO.lat, YAZOO.lon, 25)]: list,
    };
    for (const g of list.gauges) {
      jsonMap[nwpsDetailUrl(g.lid as string)] = readJson("nwps_detail_YZOM6.json");
      jsonMap[nwpsStageflowUrl(g.lid as string)] = noForecast;
    }
    const b = await pickForecastGauge(
      YAZOO.lat,
      YAZOO.lon,
      25,
      fixtureFetchers(jsonMap, {}),
    );
    expect(b).toBeNull();
  });
});

describe("parseAltVa + datum sanity", () => {
  it("parses alt_va and datum from RDB", () => {
    const parsed = parseAltVa(readText("usgs_site_02486000.rdb"));
    expect(parsed).toEqual({ altVaFt: 233.39, datum: "NAVD88" });
  });

  it("returns null for malformed RDB", () => {
    expect(parseAltVa("# only comments\n")).toBeNull();
  });

  it("picks the requested site from a multi-row RDB", () => {
    const rdb = [
      "agency_cd\tsite_no\talt_va\talt_datum_cd",
      "5s\t15s\t8s\t10s",
      "USGS\t11111111\t 99.99\tNAVD88",
      "USGS\t02486000\t 233.39\tNAVD88",
    ].join("\n");
    expect(parseAltVa(rdb, "02486000")).toEqual({
      altVaFt: 233.39,
      datum: "NAVD88",
    });
    // Without a site hint it takes the first real data row, not the
    // format row.
    expect(parseAltVa(rdb)).toEqual({ altVaFt: 99.99, datum: "NAVD88" });
  });

  it("Vicksburg: the USGS row (46.22 NGVD29), not the Army Corps row listed first (73 NAVD88)", () => {
    const rdb = [
      "agency_cd\tsite_no\tstation_nm\talt_va\talt_meth_cd\talt_acy_va\talt_datum_cd",
      "5s\t15s\t50s\t8s\t1s\t3s\t10s",
      "USCE\t07289000\t(USACE) Mississippi River at Vicksburg, MS\t73\tN\t1.6\tNAVD88",
      "USGS\t07289000\tMISSISSIPPI RIVER AT VICKSBURG, MS\t 46.22\tL\t0.1\tNGVD29",
    ].join("\n");
    expect(parseAltVa(rdb, "07289000")).toEqual({ altVaFt: 46.22, datum: "NGVD29" });
    // Same answer with no site hint.
    expect(parseAltVa(rdb)).toEqual({ altVaFt: 46.22, datum: "NGVD29" });
  });

  it("Vicksburg: the live RDB recorded 2026-10-23 gives 46.22 NGVD29", () => {
    expect(parseAltVa(readText("usgs_site_07289000.rdb"), "07289000")).toEqual({
      altVaFt: 46.22,
      datum: "NGVD29",
    });
  });

  it("rows for the site but none from USGS → null (CATEGORY, not a wrong FULL)", () => {
    const rdb = [
      "agency_cd\tsite_no\talt_va\talt_datum_cd",
      "5s\t15s\t8s\t10s",
      "USCE\t07289000\t73\tNAVD88",
    ].join("\n");
    expect(parseAltVa(rdb, "07289000")).toBeNull();
    expect(parseAltVa(rdb)).toBeNull();
  });

  it("a USGS row with no alt_va doesn't let another agency's row through", () => {
    const rdb = [
      "agency_cd\tsite_no\talt_va\talt_datum_cd",
      "5s\t15s\t8s\t10s",
      "USGS\t07275950\t\t",
      "USCE\t07275950\t140.5\tNGVD29",
    ].join("\n");
    expect(parseAltVa(rdb, "07275950")).toBeNull();
  });

  it("Vicksburg end to end: FULL-tier bundle carries 46.22 NGVD29", async () => {
    const candidate = {
      lid: "VCKM6",
      name: "Mississippi River at Vicksburg",
      lat: 32.315,
      lon: -90.905833,
      distanceMi: 2.7,
    };
    const detail = {
      ...(readJson("nwps_detail_JACM6.json") as object),
      lid: "VCKM6",
      usgsId: "07289000",
      name: "Mississippi River at Vicksburg",
    };
    const f = fixtureFetchers(
      {
        [nwpsDetailUrl("VCKM6")]: detail,
        [nwpsStageflowUrl("VCKM6")]: readJson("nwps_stageflow_JACM6.json"),
      },
      { [usgsSiteUrl("07289000")]: readText("usgs_site_07289000.rdb") },
    );
    const b = await fetchGaugeBundle(candidate, f, {
      now: () => Date.parse("2026-10-23T12:00:00Z"),
    });
    expect(b.gaugeZeroFt).toBeCloseTo(46.22, 2);
    expect(b.gaugeDatum).toBe("NGVD29");
  });

  it("skips rows whose alt_va is blank", () => {
    const rdb = [
      "agency_cd\tsite_no\talt_va\talt_datum_cd",
      "5s\t15s\t8s\t10s",
      "USGS\t11111111\t\t",
      "USGS\t22222222\t 55.50\tNGVD29",
    ].join("\n");
    expect(parseAltVa(rdb)).toEqual({ altVaFt: 55.5, datum: "NGVD29" });
  });

  it("flags an absurd gauge-zero as insane", () => {
    // Pearl at Jackson: 233.39 + ~3 ft stage vs a ~276 ft pin → sane.
    expect(datumLooksSane(233.39, 3.2, 275.5)).toBe(true);
    // A datum error of hundreds of feet → suspect.
    expect(datumLooksSane(30, 3.2, 275.5)).toBe(false);
  });
});
