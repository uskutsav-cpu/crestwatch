import { describe, expect, it } from "vitest";
import { survey } from "@/lib/surveyor";
import { verdictSentence, statusLine } from "@/lib/sentences";

const NOW = "2026-03-01T00:00:00Z";
const N = Date.parse(NOW);
const s = (p: [number, number][]) =>
  p.map(([h, v]) => ({ t: new Date(N + h * 3.6e6).toISOString(), stageFt: v }));

describe("regression: stale obs + rising forecast", () => {
  it("must NOT say the river has peaked while the forecast climbs", () => {
    const v = survey({
      pinElevationFt: 117.5,
      gauge: {
        observed: s([[-6, 28.5]]),            // 6h stale, high (gauge went quiet)
        forecast: s([[-1, 22.0], [6, 25.0], [18, 28.0]]), // RISING
        forecastIssued: new Date(N - 3.6e6).toISOString(),
        categories: { action: 28, minor: 29, moderate: 36, major: 43 },
        gaugeZeroFt: 90,
        gaugeDatum: "NAVD88",
      },
      now: NOW,
    });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    const sentence = verdictSentence({
      pinName: "your house", verdict: v,
      gauge: { name: "Pearl River at Jackson", forecastIssued: null }, now: NOW,
    });
    console.log("pastPeak:", v.pastPeak, "| crossing:", v.crossing?.hoursFromNow);
    console.log("sentence:", sentence);
    // A future rising crossing and "coming down" cannot both be true.
    if (v.crossing) expect(v.pastPeak).toBe(false);
    expect(sentence).not.toContain("has peaked and is coming down");
  });

  it("garbage forecast timestamps must not read as a confident recession", () => {
    const v = survey({
      pinElevationFt: 100,
      gauge: {
        observed: s([[-1, 9]]),
        forecast: [
          { t: "not-a-date", stageFt: 12 },
          { t: "also-garbage", stageFt: 13 },
        ],
        forecastIssued: new Date(N - 3.6e6).toISOString(),
        categories: {},
        gaugeZeroFt: 90,
        gaugeDatum: "NAVD88",
      },
      now: NOW,
    });
    console.log("garbage-ts tier:", v.tier, "pastPeak:", v.tier === "FULL" ? v.pastPeak : "n/a");
    // Unusable forecast must degrade, not assert a falling river.
    if (v.tier === "FULL") expect(v.pastPeak).toBe(false);
  });
});

const NOW2 = "2026-03-02T15:00:00Z";
const N2 = Date.parse(NOW2);
const s2 = (p: Array<[number, number]>) =>
  p.map(([h, v]) => ({ t: new Date(N2 + h * 3.6e6).toISOString(), stageFt: v }));
const G = (
  o: Array<[number, number]>,
  f: Array<[number, number]>,
  zero: number | null,
  cats: Record<string, number> = { action: 28, minor: 29, moderate: 36, major: 43 },
) => ({
  observed: s2(o),
  forecast: s2(f),
  forecastIssued: new Date(N2 - 3.6e6).toISOString(),
  categories: cats,
  gaugeZeroFt: zero,
  gaugeDatum: "NAVD88",
});
const gaugeMeta = { name: "Yazoo River at Yazoo City", forecastIssued: null };

describe("finding 3: CATEGORY tier must not call an in-progress flood 'passable'", () => {
  it("reports the flooding the gauge is reading right now", () => {
    const v = survey({
      pinElevationFt: 100,
      gauge: G([[-3, 15.0], [-0.5, 14.5]], [[-3, 15.0], [3, 7.5], [9, 6.0], [21, 5.5]], null,
        { action: 8, minor: 10, moderate: 13, major: 16 }),
      now: NOW2,
    });
    expect(v.tier).toBe("CATEGORY");
    if (v.tier !== "CATEGORY") return;
    console.log("category:", v.category, "| peakStage:", v.peakStageFt);
    expect(v.category).toBe("moderate");
    const sent = verdictSentence({ pinName: "Home", verdict: v, gauge: gaugeMeta, now: NOW2 });
    expect(sent).not.toContain("stay passable");
  });
});

describe("finding 4: stale observation must not lose the crossing", () => {
  it("anchors on the last past forecast point", () => {
    const v = survey({
      pinElevationFt: 106,
      gauge: G([[-8, 105]], [[-6, 103], [-3, 101], [3, 107], [9, 110]], 0),
      now: NOW2,
    });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("crossing:", v.crossing?.hoursFromNow);
    expect(v.crossing).not.toBeNull();
    expect(v.crossing!.hoursFromNow).toBe(2);
  });
});

describe("finding 6: no observed data + one future point still finds a crossing", () => {
  it("uses the past forecast point as the lower bracket", () => {
    const v = survey({
      pinElevationFt: 103,
      gauge: G([], [[-2, 100], [6, 105]], 0),
      now: NOW2,
    });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    console.log("crossing:", v.crossing?.hoursFromNow);
    expect(v.crossing).not.toBeNull();
    expect(v.crossing!.hoursFromNow).toBe(3);
  });
});

describe("finding 7: an underwater pin is never told it stays dry", () => {
  it("scores against water already here, not the receding tail", () => {
    const v = survey({
      pinElevationFt: 100,
      gauge: G([[0, 11]], [[6, 13], [12, 11.5], [24, 5], [36, 4]], 90),
      now: NOW2,
    });
    expect(v.tier).toBe("FULL");
    if (v.tier !== "FULL") return;
    const sent = verdictSentence({ pinName: "Home", verdict: v, gauge: gaugeMeta, now: NOW2 });
    console.log("band:", v.band, "| margin:", v.marginFt.toFixed(1), "| currentlyAbove:", v.currentlyAbove);
    console.log("sentence:", sent);
    expect(v.currentlyAbove).toBe(true);
    expect(v.band).toBe("LIKELY");
    expect(sent).not.toContain("stays dry");
    expect(statusLine(v)).not.toContain("stays dry");
  });
});
