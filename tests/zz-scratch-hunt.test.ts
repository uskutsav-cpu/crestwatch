/* SCRATCH — delete after the hunt. Probes commit 446f012 in lib/surveyor.ts */
import { describe, expect, it } from "vitest";
import { survey, risingCrossing, type SurveyGauge, type SeriesPoint } from "@/lib/surveyor";
import { verdictSentence } from "@/lib/sentences";

const NOW = "2026-03-01T00:00:00Z";
const NOW_MS = Date.parse(NOW);
const H = 3_600_000;
const at = (h: number, stageFt: number): SeriesPoint => ({
  t: new Date(NOW_MS + h * H).toISOString(),
  stageFt,
});

function g(p: Partial<SurveyGauge>): SurveyGauge {
  return {
    observed: [],
    forecast: [],
    forecastIssued: new Date(NOW_MS - 1 * H).toISOString(),
    categories: {},
    gaugeZeroFt: 0,
    gaugeDatum: "NAVD88",
    ...p,
  };
}

/* ---- PRE-446f012 reference implementation, for A/B comparison ---- */
function oldSurvey(pinElevationFt: number, gauge: SurveyGauge, nowMs: number) {
  const sort = (s: SeriesPoint[]) => [...s].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const forecast = sort(gauge.forecast);
  let peakIdx = 0;
  for (let i = 1; i < forecast.length; i++) {
    if (forecast[i].stageFt > forecast[peakIdx].stageFt) peakIdx = i;
  }
  const peakStage = forecast[peakIdx];
  const observed = sort(gauge.observed);
  const lastObs = observed.at(-1) ?? null;
  const zero = gauge.gaugeZeroFt!;
  const peakWaterElev = zero + peakStage.stageFt;
  const currentWaterElevFt = lastObs === null ? null : zero + lastObs.stageFt;
  const path: Array<{ tMs: number; elev: number }> = [];
  if (lastObs) path.push({ tMs: Date.parse(lastObs.t), elev: zero + lastObs.stageFt });
  for (const p of forecast) path.push({ tMs: Date.parse(p.t), elev: zero + p.stageFt });
  const cross = risingCrossing(path, pinElevationFt, nowMs);
  const pastPeak =
    Date.parse(peakStage.t) <= nowMs ||
    (peakIdx === 0 && currentWaterElevFt !== null && currentWaterElevFt >= peakWaterElev);
  return {
    marginFt: pinElevationFt - peakWaterElev,
    crossingH: cross === null ? null : Math.round((cross.tMs - nowMs) / H),
    pastPeak,
  };
}

const say = (v: ReturnType<typeof survey>) =>
  verdictSentence({ pinName: "your house", verdict: v, gauge: null, now: NOW });

describe("446f012 hunt", () => {
  it("T1 (c): no observed + exactly ONE future point => crossing is LOST", () => {
    const gauge = g({
      observed: [],
      forecast: [at(-2, 100), at(6, 105)],
      gaugeZeroFt: 0,
    });
    const v = survey({ pinElevationFt: 103, gauge, now: NOW });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("T1 new:", { crossing: v.crossing, margin: v.marginFt, pastPeak: v.pastPeak });
    console.log("T1 old:", oldSurvey(103, gauge, NOW_MS));
    console.log("T1 sentence:", say(v));
    expect(v.crossing).toBeNull(); // NEW behaviour
    expect(oldSurvey(103, gauge, NOW_MS).crossingH).toBe(3); // OLD found it
  });

  it("T2 (c): lastObs OLDER than the past forecast points => crossing is LOST", () => {
    const gauge = g({
      observed: [at(-8, 105)], // stale (OBS_STALE_H = 2)
      forecast: [at(-6, 103), at(-3, 101), at(3, 107), at(9, 110)],
      gaugeZeroFt: 0,
    });
    const v = survey({ pinElevationFt: 106, gauge, now: NOW });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("T2 new:", {
      crossing: v.crossing,
      margin: v.marginFt,
      band: v.band,
      pastPeak: v.pastPeak,
      currentlyAbove: v.currentlyAbove,
      staleObserved: v.stale.staleObserved,
    });
    console.log("T2 old:", oldSurvey(106, gauge, NOW_MS));
    console.log("T2 sentence:", say(v));
    expect(v.band).toBe("LIKELY");
    expect(v.crossing).toBeNull(); // NEW: arrival time gone
    expect(oldSurvey(106, gauge, NOW_MS).crossingH).toBe(2); // OLD: "in 2 hours"
  });

  it("T3 (d): no observed + clearly FALLING forecast => pastPeak flips to false", () => {
    const gauge = g({
      observed: [],
      forecast: [at(-2, 105), at(1, 102), at(4, 100), at(7, 98)],
      gaugeZeroFt: 0,
    });
    const v = survey({ pinElevationFt: 102.2, gauge, now: NOW });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("T3 new:", {
      pastPeak: v.pastPeak,
      band: v.band,
      margin: v.marginFt,
      peak: v.peak,
      current: v.currentWaterElevFt,
    });
    console.log("T3 old:", oldSurvey(102.2, gauge, NOW_MS));
    console.log("T3 sentence NEW:", say(v));
    console.log(
      "T3 sentence OLD-equiv:",
      say({ ...v, pastPeak: true } as typeof v),
    );
    expect(v.pastPeak).toBe(false); // NEW
    expect(oldSurvey(102.2, gauge, NOW_MS).pastPeak).toBe(true); // OLD
  });

  it("T4: STALE high observation + RISING forecast => pastPeak flips to true", () => {
    const gauge = g({
      observed: [at(-10, 110)], // 10 h old; OBS_STALE_H = 2
      forecast: [at(-1, 90), at(3, 100), at(9, 105)], // rising all the way
      gaugeZeroFt: 0,
    });
    const v = survey({ pinElevationFt: 105.2, gauge, now: NOW });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("T4 new:", {
      pastPeak: v.pastPeak,
      band: v.band,
      currentlyAbove: v.currentlyAbove,
      peak: v.peak,
      current: v.currentWaterElevFt,
      staleObserved: v.stale.staleObserved,
    });
    console.log("T4 old:", oldSurvey(105.2, gauge, NOW_MS));
    console.log("T4 sentence NEW:", say(v));
    console.log("T4 sentence OLD-equiv:", say({ ...v, pastPeak: false } as typeof v));
    expect(v.pastPeak).toBe(true); // NEW: "has peaked and is coming down"
    expect(oldSurvey(105.2, gauge, NOW_MS).pastPeak).toBe(false); // OLD: "still up"
  });

  it("T5: UNPARSEABLE forecast valid-times => confident pastPeak + FRESH flags", () => {
    const gauge = g({
      observed: [at(-1, 99)],
      forecast: [
        { t: "2026-03-01T06:00:00-06", stageFt: 100.5 },
        { t: "unknown", stageFt: 101.8 },
      ],
      gaugeZeroFt: 0,
    });
    const v = survey({ pinElevationFt: 100, gauge, now: NOW });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("T5 new:", {
      pastPeak: v.pastPeak,
      band: v.band,
      peak: v.peak,
      staleObserved: v.stale.staleObserved,
      staleForecast: v.stale.staleForecast,
    });
    console.log("T5 old:", oldSurvey(100, gauge, NOW_MS));
    console.log("T5 sentence:", say(v));
    expect(v.pastPeak).toBe(true);
    expect(v.stale.staleForecast).toBe(false); // reads FRESH
    expect(oldSurvey(100, gauge, NOW_MS).pastPeak).toBe(false);
  });

  it("T6: unparseable `now` => pastPeak true, crossing null", () => {
    const gauge = g({
      observed: [at(-1, 99)],
      forecast: [at(6, 100.5), at(24, 101.8)],
      gaugeZeroFt: 0,
    });
    const v = survey({ pinElevationFt: 100, gauge, now: "tomorrow" });
    if (v.tier !== "FULL") return;
    console.log("T6:", { pastPeak: v.pastPeak, crossing: v.crossing, peak: v.peak });
  });

  it("T7 (b): peakPool can never be empty (forecast.length >= 2 gate)", () => {
    // all points at/before now, incl. one exactly AT now
    const gauge = g({
      observed: [at(-1, 99)],
      forecast: [at(-6, 101.8), at(0, 100.5)],
      gaugeZeroFt: 0,
    });
    const v = survey({ pinElevationFt: 100, gauge, now: NOW });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("T7 all-past:", { peak: v.peak, pastPeak: v.pastPeak, crossing: v.crossing });
    expect(Number.isFinite(v.peak.stageFt)).toBe(true);

    // all points strictly future
    const gauge2 = g({
      observed: [at(-1, 99)],
      forecast: [at(6, 100.5), at(24, 101.8)],
      gaugeZeroFt: 0,
    });
    const v2 = survey({ pinElevationFt: 100, gauge: gauge2, now: NOW });
    if (v2.tier !== "FULL") return;
    console.log("T7 all-future:", { peak: v2.peak, pastPeak: v2.pastPeak, crossing: v2.crossing });
  });

  it("T8: CATEGORY tier also silently drops a bygone major crest", () => {
    const gauge = g({
      gaugeZeroFt: null,
      observed: [at(-1, 44)],
      forecast: [at(-6, 45), at(6, 12), at(24, 10)],
      categories: { action: 28, minor: 29, moderate: 36, major: 43 },
    });
    const v = survey({ pinElevationFt: 100, gauge, now: NOW });
    console.log("T8:", v);
  });

  it("T9 (e): does the new golden fixture even exercise the T2 path?", () => {
    // fixture full-double-crest-*: lastObs (-1h) is NEWER than every past
    // forecast point and sits exactly on the 0h forecast value (22.0), so
    // dropping the past points changes the path by nothing.
    const gauge = g({
      gaugeZeroFt: 90,
      observed: [at(-1, 22.0)],
      forecast: [at(-12, 30.0), at(-6, 25.0), at(0, 22.0), at(12, 24.0), at(24, 28.0), at(36, 26.0)],
    });
    const v = survey({ pinElevationFt: 117, gauge, now: NOW });
    if (v.tier !== "FULL") return;
    console.log("T9 fixture-as-written:", {
      margin: v.marginFt,
      crossing: v.crossing?.hoursFromNow,
      pastPeak: v.pastPeak,
    });
    // Same data, but the observation is stale (older than the past forecast
    // points) — the shape the fixture never tries.
    const gauge2 = g({
      gaugeZeroFt: 90,
      observed: [at(-14, 22.0)],
      forecast: [at(-12, 30.0), at(-6, 25.0), at(0, 22.0), at(12, 24.0), at(24, 28.0), at(36, 26.0)],
    });
    const v2 = survey({ pinElevationFt: 117, gauge: gauge2, now: NOW });
    if (v2.tier !== "FULL") return;
    console.log("T9 stale-obs variant NEW:", {
      margin: v2.marginFt,
      crossing: v2.crossing?.hoursFromNow ?? null,
      pastPeak: v2.pastPeak,
    });
    console.log("T9 stale-obs variant OLD:", oldSurvey(117, gauge2, NOW_MS));
  });
});
