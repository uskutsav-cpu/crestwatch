import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { survey, type SurveyGauge, type Verdict } from "@/lib/surveyor";
import type { SeriesPoint } from "@/lib/gauges";

const NOW = "2026-03-01T00:00:00Z";
const NOW_MS = Date.parse(NOW);

interface YamlCase {
  name: string;
  pinElev: number;
  gaugeZero?: number | null;
  datum?: string;
  observed?: Array<[number, number]>;
  forecast?: Array<[number, number]>;
  forecastIssuedH?: number | null;
  categories?: Record<string, number>;
  noGauge?: boolean;
  expect: {
    tier: string;
    band?: string;
    margin?: number;
    crossingH?: number | null;
    pastPeak?: boolean;
    currentlyAbove?: boolean;
    staleObserved?: boolean;
    staleForecast?: boolean;
    category?: string | null;
    aboveFlood?: number | null;
    peakStage?: number;
  };
}

const STD = {
  gaugeZero: 90,
  observed: [
    [-4, 8.0],
    [-2, 8.5],
    [0, 9.0],
  ] as Array<[number, number]>,
  forecast: [
    [6, 9.5],
    [12, 10.2],
    [24, 10.8],
    [36, 10.0],
  ] as Array<[number, number]>,
};

function toSeries(pairs: Array<[number, number]>): SeriesPoint[] {
  return pairs.map(([h, stageFt]) => ({
    t: new Date(NOW_MS + h * 3_600_000).toISOString(),
    stageFt,
  }));
}

function buildGauge(c: YamlCase): SurveyGauge | null {
  if (c.noGauge) return null;
  const issuedH = "forecastIssuedH" in c ? c.forecastIssuedH : -1;
  return {
    observed: toSeries(c.observed ?? STD.observed),
    forecast: toSeries(c.forecast ?? STD.forecast),
    forecastIssued:
      issuedH === null || issuedH === undefined
        ? null
        : new Date(NOW_MS + issuedH * 3_600_000).toISOString(),
    categories: c.categories ?? { action: 28, minor: 29, moderate: 36, major: 43 },
    gaugeZeroFt: "gaugeZero" in c ? (c.gaugeZero ?? null) : STD.gaugeZero,
    gaugeDatum: c.datum ?? "NAVD88",
  };
}

function check(v: Verdict, e: YamlCase["expect"]) {
  expect(v.tier).toBe(e.tier);
  if (v.tier === "FULL") {
    if (e.band !== undefined) expect(v.band).toBe(e.band);
    if (e.margin !== undefined) expect(v.marginFt).toBeCloseTo(e.margin, 1);
    if (e.crossingH !== undefined) {
      if (e.crossingH === null) expect(v.crossing).toBeNull();
      else expect(v.crossing?.hoursFromNow).toBe(e.crossingH);
    }
    if (e.pastPeak !== undefined) expect(v.pastPeak).toBe(e.pastPeak);
    if (e.currentlyAbove !== undefined) {
      expect(v.currentlyAbove).toBe(e.currentlyAbove);
    }
    if (e.staleObserved !== undefined) {
      expect(v.stale.staleObserved).toBe(e.staleObserved);
    }
    if (e.staleForecast !== undefined) {
      expect(v.stale.staleForecast).toBe(e.staleForecast);
    }
  }
  if (v.tier === "CATEGORY") {
    if (e.category !== undefined) expect(v.category).toBe(e.category);
    if (e.aboveFlood !== undefined) {
      if (e.aboveFlood === null) expect(v.aboveFloodFt).toBeNull();
      else expect(v.aboveFloodFt).toBeCloseTo(e.aboveFlood, 1);
    }
    if (e.peakStage !== undefined) {
      expect(v.peakStageFt).toBeCloseTo(e.peakStage, 1);
    }
    if (e.staleForecast !== undefined) {
      expect(v.stale.staleForecast).toBe(e.staleForecast);
    }
  }
}

const doc = parse(
  readFileSync(join(__dirname, "fixtures", "surveyor_cases.yaml"), "utf8"),
) as { cases: YamlCase[] };

describe("Surveyor golden file (40 cases)", () => {
  it("has exactly 42 cases", () => {
    expect(doc.cases).toHaveLength(42);
  });

  it("unparseable timestamps read as stale, never fresh", () => {
    const verdict = survey({
      pinElevationFt: 105,
      gauge: {
        observed: [{ t: "not-a-date", stageFt: 9 }],
        forecast: [
          { t: new Date(NOW_MS + 6 * 3_600_000).toISOString(), stageFt: 9.5 },
          { t: new Date(NOW_MS + 24 * 3_600_000).toISOString(), stageFt: 10.8 },
        ],
        forecastIssued: "garbage-timestamp",
        categories: {},
        gaugeZeroFt: 90,
        gaugeDatum: "NAVD88",
      },
      now: NOW,
    });
    expect(verdict.tier).toBe("FULL");
    if (verdict.tier !== "FULL") return;
    expect(verdict.stale.staleObserved).toBe(true);
    expect(verdict.stale.staleForecast).toBe(true);
  });

  for (const c of doc.cases) {
    it(c.name, () => {
      const verdict = survey({
        pinElevationFt: c.pinElev,
        gauge: buildGauge(c),
        now: NOW,
      });
      check(verdict, c.expect);
    });
  }
});
