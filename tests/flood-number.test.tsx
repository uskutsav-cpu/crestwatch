/**
 * Package floodnumber: "Your flood number" and the what-if slider.
 * Pure math in lib/flood-number.ts; the card rendered to static HTML and
 * its stateless panel called as a plain function to poke its handlers.
 */

import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { bandFor, survey } from "@/lib/surveyor";
import { clearCache } from "@/lib/cache";
import { testFetchers } from "@/lib/test-fetchers";
import { watchPins, type PinWatch } from "@/lib/watch-service";
import {
  contextLines,
  floodNumberFt,
  floodNumberInputFor,
  floodNumberShort,
  floodNumberView,
  fmtRounded,
  fmtStage,
  gaugePhrase,
  recordCrest,
  roundTo,
  snapWhatIf,
  whatIfHandlers,
  whatIfMarks,
  whatIfRange,
  whatIfReadout,
  type FloodNumberCrest,
  type FloodNumberInput,
} from "@/lib/flood-number";
import { FloodNumber, FloodNumberPanel } from "@/components/watch/FloodNumber";
import type { Pin } from "@/lib/pins";
import type { GaugeSummary } from "@/lib/watch-service";

/* ------------------------------------------------------------------ */
/* Fixtures: the Vicksburg example place on the Mississippi            */
/* ------------------------------------------------------------------ */

// Levee St (lib/example.ts) and the USGS Vicksburg gauge zero (NGVD29).
const PIN_ELEV = 92.7;
const ZERO = 46.22;

const CRESTS: FloodNumberCrest[] = [
  { stageFt: 57.1, time: "2011-05-19T00:00:00Z", oldDatum: false },
  { stageFt: 56.2, time: "1927-05-04T00:00:00Z", oldDatum: false },
  { stageFt: 52.0, time: "2019-03-15T00:00:00Z", oldDatum: false },
];

function input(over: Partial<FloodNumberInput> = {}): FloodNumberInput {
  return {
    pinName: "Levee St",
    approximate: false,
    pinElevationFt: PIN_ELEV,
    gaugeZeroFt: ZERO,
    gaugeName: "Mississippi River at Vicksburg",
    currentStageFt: 15.0,
    currentStale: false,
    forecastPeakStageFt: 17.2,
    categories: { action: 35, minor: 43, moderate: 46, major: 50 },
    historicCrests: CRESTS,
    ...over,
  };
}

/** renderToStaticMarkup escapes quotes; compare against plain text. */
const unescape = (html: string) =>
  html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const render = (el: ReactElement) => unescape(renderToStaticMarkup(el));

/** Depth-first walk of a host-element tree (no function components in it). */
function findAll(
  node: ReactNode,
  test: (el: ReactElement<Record<string, unknown>>) => boolean,
): Array<ReactElement<Record<string, unknown>>> {
  const out: Array<ReactElement<Record<string, unknown>>> = [];
  const visit = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== "object" || !("props" in n)) return;
    const el = n as ReactElement<Record<string, unknown>>;
    if (test(el)) out.push(el);
    visit(el.props.children as ReactNode);
  };
  visit(node);
  return out;
}

/* ------------------------------------------------------------------ */
/* The number                                                          */
/* ------------------------------------------------------------------ */

describe("floodNumberFt", () => {
  it("is pin elevation minus gauge zero, unrounded", () => {
    expect(floodNumberFt(PIN_ELEV, ZERO)).toBeCloseTo(46.48, 6);
    expect(floodNumberFt(117.0, ZERO)).toBeCloseTo(70.78, 6);
  });

  it("is null with no gauge zero, bad inputs, or ground below the gauge's 0 ft", () => {
    expect(floodNumberFt(PIN_ELEV, null)).toBeNull();
    expect(floodNumberFt(Number.NaN, ZERO)).toBeNull();
    expect(floodNumberFt(PIN_ELEV, Number.POSITIVE_INFINITY)).toBeNull();
    expect(floodNumberFt(40, ZERO)).toBeNull();
    expect(floodNumberFt(46.22, ZERO)).toBe(0);
  });
});

describe("rounding and formatting", () => {
  it("rounds to the nearest half foot (or whole foot)", () => {
    expect(roundTo(46.48, 0.5)).toBe(46.5);
    expect(roundTo(46.24, 0.5)).toBe(46);
    expect(roundTo(46.25, 0.5)).toBe(46.5);
    expect(roundTo(46.74, 0.5)).toBe(46.5);
    expect(roundTo(46.75, 0.5)).toBe(47);
    expect(roundTo(46.48, 1)).toBe(46);
    expect(roundTo(46.5, 1)).toBe(47);
  });

  it("never shows a negative zero", () => {
    expect(Object.is(roundTo(-0.2, 0.5), 0)).toBe(true);
    expect(fmtStage(-0.04)).toBe("0.0");
  });

  it("drops .0 from a rounded number and keeps one decimal on a stage", () => {
    expect(fmtRounded(46)).toBe("46");
    expect(fmtRounded(46.5)).toBe("46.5");
    expect(fmtStage(15)).toBe("15.0");
    expect(fmtStage(57.14)).toBe("57.1");
  });
});

describe("gaugePhrase", () => {
  it("puts 'gauge' between the river and the place", () => {
    expect(gaugePhrase("Mississippi River at Vicksburg")).toBe(
      "the Mississippi River gauge at Vicksburg",
    );
    expect(gaugePhrase("Big Black River near Bentonia")).toBe(
      "the Big Black River gauge near Bentonia",
    );
    expect(gaugePhrase("Pearl River AT Jackson")).toBe("the Pearl River gauge at Jackson");
  });

  it("falls back for odd or missing names", () => {
    expect(gaugePhrase("Yazoo City")).toBe("the Yazoo City gauge");
    expect(gaugePhrase("  ")).toBe(copy.verdictGaugeFallback);
  });
});

/* ------------------------------------------------------------------ */
/* The card's words                                                    */
/* ------------------------------------------------------------------ */

describe("floodNumberView: the headline and explainer", () => {
  it("names the number to the half foot, with 'about', on the gauge", () => {
    const v = floodNumberView(input())!;
    expect(v.shownFt).toBe(46.5);
    expect(v.rough).toBe(false);
    expect(v.headline).toBe(
      "Your flood number: about 46.5 ft on the Mississippi River gauge at Vicksburg.",
    );
    expect(v.value).toBe("about 46.5 ft");
    expect(v.onGauge).toBe("on the Mississippi River gauge at Vicksburg.");
    expect(v.explainer).toBe(
      "When the river reads about 46.5 ft on that gauge, water reaches the ground at Levee St.",
    );
    expect(v.levees).toBe("CrestWatch doesn't count levees or floodwalls.");
  });

  it("shows a whole number without a decimal", () => {
    const v = floodNumberView(input({ pinElevationFt: ZERO + 46.1 }))!;
    expect(v.value).toBe("about 46 ft");
  });

  it("renders nothing for a negative flood number or a missing gauge zero", () => {
    expect(floodNumberView(input({ pinElevationFt: 40 }))).toBeNull();
    expect(floodNumberView(input({ gaugeZeroFt: null }))).toBeNull();
    expect(whatIfRange(input({ pinElevationFt: 40 }))).toBeNull();
    expect(contextLines(input({ gaugeZeroFt: null }))).toEqual([]);
  });

  it("calls an approximate place a rough number, in whole feet", () => {
    const v = floodNumberView(input({ approximate: true }))!;
    expect(v.rough).toBe(true);
    expect(v.title).toBe("Your rough flood number");
    expect(v.headline).toBe(
      "Your rough flood number: about 46 ft on the Mississippi River gauge at Vicksburg.",
    );
    expect(v.explainer).toContain("the approximate spot for Levee St");
    expect(v.explainer).not.toMatch(/reaches the ground at Levee St/);
    expect(v.context).toContain("Your number is about 3 ft above flood stage, 43.0 ft.");
    expect(v.marks.find((m) => m.kind === "yours")?.value).toBe("about 46 ft");
  });
});

describe("contextLines", () => {
  it("gives the reading, flood stage and record, in that order", () => {
    expect(contextLines(input())).toEqual([
      "The river reads 15.0 ft now, about 31 ft below your number.",
      "Your number is about 3.5 ft above flood stage, 43.0 ft.",
      "The highest crest on record here was 57.1 ft, in May 2011.",
    ]);
  });

  it("never says 'now' about an old reading", () => {
    const [line] = contextLines(input({ currentStale: true }));
    expect(line).toBe("The last reading was 15.0 ft, about 31 ft below your number.");
    expect(line).not.toMatch(/\bnow\b/);
  });

  it("says less than a foot for a small gap", () => {
    const [line] = contextLines(input({ currentStageFt: 46.0 }));
    expect(line).toBe("The river reads 46.0 ft now, less than a foot below your number.");
  });

  it("says when the river is already above the number (fresh and stale)", () => {
    expect(contextLines(input({ currentStageFt: 47 }))[0]).toBe(
      "The river is already above your flood number.",
    );
    expect(contextLines(input({ currentStageFt: 47, currentStale: true }))[0]).toBe(
      "The last reading was already above your flood number.",
    );
  });

  it("matches the Surveyor's currentlyAbove right at the line", () => {
    // Water exactly at the ground counts as over it in the Surveyor too.
    const pin = 50 + 10;
    const lines = contextLines(input({ pinElevationFt: pin, gaugeZeroFt: 50, currentStageFt: 10 }));
    expect(lines[0]).toBe(copy.floodNumberAlreadyAbove);
  });

  it("leaves the reading out when there isn't one", () => {
    const lines = contextLines(input({ currentStageFt: null }));
    expect(lines.some((l) => /reads|reading/.test(l))).toBe(false);
    expect(lines).toHaveLength(2);
  });

  it("warns when water reaches here before flood stage", () => {
    const lines = contextLines(input({ categories: { minor: 50 } }));
    expect(lines).toContain(
      "Your number is below flood stage, 50.0 ft. Water can reach here before the Weather Service calls it a flood.",
    );
  });

  it("calls a near-equal number about the same as flood stage", () => {
    const lines = contextLines(input({ categories: { minor: 46.4 } }));
    expect(lines).toContain("Your number is about the same as flood stage, 46.4 ft.");
  });

  it("says nothing about flood stage when none is published", () => {
    const lines = contextLines(input({ categories: { moderate: 46, major: 50 } }));
    expect(lines.some((l) => /flood stage/.test(l))).toBe(false);
  });

  it("leaves the record out when there are no crests", () => {
    const lines = contextLines(input({ historicCrests: [] }));
    expect(lines.some((l) => /record/.test(l))).toBe(false);
  });
});

describe("recordCrest", () => {
  it("is the highest crest on today's zero mark", () => {
    const r = recordCrest(CRESTS)!;
    expect(r.stageFt).toBe(57.1);
    expect(r.when).toBe("May 2011");
    expect(r.partial).toBe(false);
  });

  it("skips a crest read from an older zero mark, and says so", () => {
    const r = recordCrest([
      { stageFt: 60.0, time: "1927-05-04T00:00:00Z", oldDatum: true },
      ...CRESTS,
    ])!;
    expect(r.stageFt).toBe(57.1);
    expect(r.partial).toBe(true);
    expect(copy.floodNumberRecord(fmtStage(r.stageFt), r.when, r.partial)).toBe(
      "The highest crest on record here, measured from today's zero mark, was 57.1 ft, in May 2011.",
    );
  });

  it("never guesses: crests with no datum flag don't count", () => {
    expect(recordCrest([{ stageFt: 57.1, time: "2011-05-19T00:00:00Z" }])).toBeNull();
    expect(recordCrest([])).toBeNull();
    expect(recordCrest(null)).toBeNull();
    const lines = contextLines(
      input({ historicCrests: [{ stageFt: 57.1, time: "2011-05-19T00:00:00Z" }] }),
    );
    expect(lines.some((l) => /record/.test(l))).toBe(false);
  });

  it("reads the month in UTC (a June 1 crest is June, not May 31 in CT)", () => {
    expect(
      recordCrest([{ stageFt: 50, time: "2011-06-01T00:00:00Z", oldDatum: false }])!.when,
    ).toBe("June 2011");
  });

  it("drops the date when it doesn't parse", () => {
    const r = recordCrest([{ stageFt: 57.1, time: "not a date", oldDatum: false }])!;
    expect(r.when).toBeNull();
    expect(copy.floodNumberRecord("57.1", r.when, r.partial)).toBe(
      "The highest crest on record here was 57.1 ft.",
    );
  });

  it("ignores a crest with no usable stage", () => {
    const r = recordCrest([
      { stageFt: Number.NaN, time: "2020-01-01T00:00:00Z", oldDatum: false },
      { stageFt: 40, time: "2020-01-01T00:00:00Z", oldDatum: false },
    ])!;
    expect(r.stageFt).toBe(40);
  });
});

/* ------------------------------------------------------------------ */
/* The slider                                                          */
/* ------------------------------------------------------------------ */

describe("whatIfRange", () => {
  it("runs from 5 ft under the lowest mark to 5 ft over the highest", () => {
    // lowest: reading 15.0 -> floor(10) = 10. highest: record 57.1 -> ceil(62.1) = 63.
    expect(whatIfRange(input())).toEqual({ min: 10, max: 63, step: 0.5, start: 17.2 });
  });

  it("never goes below 0", () => {
    expect(whatIfRange(input({ currentStageFt: 3 }))!.min).toBe(0);
  });

  it("works without a reading, flood stage or record", () => {
    const r = whatIfRange(
      input({ currentStageFt: null, categories: {}, historicCrests: [], forecastPeakStageFt: 30 }),
    )!;
    // lowest: peak 30 -> 25; highest: number 46.48 -> ceil(51.48) = 52.
    expect(r).toEqual({ min: 25, max: 52, step: 0.5, start: 30 });
  });

  it("keeps every mark and the start on the slider", () => {
    // Flood stage far above everything else still fits.
    const i = input({
      pinElevationFt: ZERO + 20,
      currentStageFt: 12,
      forecastPeakStageFt: 15,
      categories: { minor: 43 },
      historicCrests: [],
    });
    const r = whatIfRange(i)!;
    expect(r.min).toBe(7);
    expect(r.max).toBe(48);
    const marks = whatIfMarks(i, r);
    expect(marks.map((m) => m.kind)).toEqual(["forecast", "yours", "floodStage"]);
    for (const m of marks) {
      expect(m.frac).toBeGreaterThanOrEqual(0);
      expect(m.frac).toBeLessThanOrEqual(1);
    }
    expect(r.start).toBeGreaterThanOrEqual(r.min);
    expect(r.start).toBeLessThanOrEqual(r.max);
  });

  it("starts at the forecast crest, exactly as the verdict states it", () => {
    expect(whatIfRange(input({ forecastPeakStageFt: 47.3 }))!.start).toBe(47.3);
  });

  it("starts at the reading (then the number) when the crest is missing", () => {
    expect(whatIfRange(input({ forecastPeakStageFt: Number.NaN }))!.start).toBe(15);
    expect(
      whatIfRange(input({ forecastPeakStageFt: Number.NaN, currentStageFt: null }))!.start,
    ).toBeCloseTo(46.48, 6);
  });

  it("snaps a value to the step and keeps it in range", () => {
    const r = whatIfRange(input())!;
    expect(snapWhatIf(48.3, r)).toBe(48.5);
    expect(snapWhatIf(48.2, r)).toBe(48);
    expect(snapWhatIf(500, r)).toBe(63);
    expect(snapWhatIf(-5, r)).toBe(10);
  });
});

describe("whatIfReadout", () => {
  const at = (stage: number, over: Partial<FloodNumberInput> = {}) =>
    whatIfReadout(stage, input(over));

  it("gives a depth in whole feet when water is over the ground", () => {
    expect(at(50)).toBe(
      "If the river reaches 50.0 ft on the gauge, water would be about 4 ft deep at Levee St.",
    );
    expect(at(57.1)).toBe(
      "If the river reaches 57.1 ft on the gauge, water would be about 11 ft deep at Levee St.",
    );
  });

  it("says less than a foot for shallow water", () => {
    expect(at(46.5)).toBe(
      "If the river reaches 46.5 ft on the gauge, water would be less than a foot deep at Levee St.",
    );
  });

  it("says likely reaches the ground within the LIKELY band", () => {
    // margin 0.48 ft
    expect(at(46)).toBe(
      "If the river reaches 46.0 ft on the gauge, water would likely reach the ground at Levee St.",
    );
  });

  it("calls a near miss too close to call, never dry", () => {
    expect(at(45.5)).toBe(
      "If the river reaches 45.5 ft on the gauge, water would come within a foot of the ground at Levee St. That's too close to call.",
    );
    expect(at(44)).toBe(
      "If the river reaches 44.0 ft on the gauge, water would come within about 2 ft of the ground at Levee St. That's too close to call.",
    );
    expect(at(43)).toMatch(/within about 3 ft .* too close to call/);
  });

  it("says stays dry only beyond the BORDERLINE band", () => {
    expect(at(40)).toBe(
      "If the river reaches 40.0 ft on the gauge, Levee St stays dry by about 6 ft.",
    );
  });

  it("names the approximate spot for an approximate place", () => {
    expect(at(40, { approximate: true, pinName: "Home" })).toBe(
      "If the river reaches 40.0 ft on the gauge, the approximate spot for Home stays dry by about 6 ft.",
    );
    expect(at(50, { approximate: true, pinName: "Home" })).toBe(
      "If the river reaches 50.0 ft on the gauge, water would be about 4 ft deep at the approximate spot for Home.",
    );
  });

  it("agrees with the verdict band at every stage (no false all-clear)", () => {
    for (let s = 30; s <= 60; s += 0.1) {
      const band = bandFor(PIN_ELEV - (ZERO + s));
      const text = at(s);
      if (band === "UNLIKELY") expect(text, String(s)).toMatch(/stays dry/);
      else expect(text, String(s)).not.toMatch(/stays dry/);
      if (band === "BORDERLINE") expect(text, String(s)).toMatch(/too close to call/);
      if (band === "LIKELY") expect(text, String(s)).toMatch(/deep|likely reach/);
    }
  });

  it("agrees with the Surveyor's verdict at the forecast crest", () => {
    const now = "2026-10-23T19:00:00Z";
    // A crest 3 ft under the ground: BORDERLINE, "too close to call".
    const peak = PIN_ELEV - ZERO - 3;
    const verdict = survey({
      pinElevationFt: PIN_ELEV,
      now,
      gauge: {
        observed: [{ t: "2026-10-23T18:45:00Z", stageFt: 40 }],
        forecast: [
          { t: "2026-10-24T12:00:00Z", stageFt: 42 },
          { t: "2026-10-25T12:00:00Z", stageFt: peak },
          { t: "2026-10-26T12:00:00Z", stageFt: 41 },
        ],
        forecastIssued: "2026-10-23T15:00:00Z",
        categories: { minor: 43 },
        gaugeZeroFt: ZERO,
        gaugeDatum: "NGVD29",
      },
    });
    expect(verdict.tier === "FULL" && verdict.band).toBe("BORDERLINE");
    if (verdict.tier !== "FULL") return;
    const fn = input({ forecastPeakStageFt: verdict.peak.stageFt });
    const r = whatIfRange(fn)!;
    expect(whatIfReadout(r.start, fn)).toMatch(/too close to call/);
  });
});

describe("whatIfMarks", () => {
  it("lists your number, flood stage, record and forecast, lowest first", () => {
    const i = input();
    const marks = whatIfMarks(i, whatIfRange(i)!);
    expect(marks.map((m) => m.kind)).toEqual(["forecast", "floodStage", "yours", "record"]);
    expect(marks.map((m) => `${m.label} ${m.value}`)).toEqual([
      "forecast crest 17.2 ft",
      "flood stage 43.0 ft",
      "your number about 46.5 ft",
      "highest crest 57.1 ft",
    ]);
    const yours = marks.find((m) => m.kind === "yours")!;
    expect(yours.frac).toBeCloseTo((46.48 - 10) / (63 - 10), 6);
  });

  it("only shows marks that exist", () => {
    const i = input({ categories: {}, historicCrests: [] });
    expect(whatIfMarks(i, whatIfRange(i)!).map((m) => m.kind)).toEqual(["forecast", "yours"]);
  });
});

describe("whatIfHandlers", () => {
  const range = { min: 10, max: 63, step: 0.5, start: 17.2 };

  it("slide snaps, stores and reports the stage", () => {
    const setChosen = vi.fn();
    const onWhatIf = vi.fn();
    const h = whatIfHandlers(range, setChosen, onWhatIf);
    h.slide("48.5");
    h.slide("48.3");
    h.slide("999");
    expect(setChosen.mock.calls).toEqual([[48.5], [48.5], [63]]);
    expect(onWhatIf.mock.calls).toEqual([[48.5], [48.5], [63]]);
  });

  it("ignores a value that isn't a number", () => {
    const setChosen = vi.fn();
    const onWhatIf = vi.fn();
    whatIfHandlers(range, setChosen, onWhatIf).slide("abc");
    expect(setChosen).not.toHaveBeenCalled();
    expect(onWhatIf).not.toHaveBeenCalled();
  });

  it("back returns to the forecast with null", () => {
    const setChosen = vi.fn();
    const onWhatIf = vi.fn();
    whatIfHandlers(range, setChosen, onWhatIf).back();
    expect(setChosen).toHaveBeenCalledWith(null);
    expect(onWhatIf).toHaveBeenCalledWith(null);
  });

  it("works with no parent callback", () => {
    const setChosen = vi.fn();
    const h = whatIfHandlers(range, setChosen);
    expect(() => {
      h.slide("20");
      h.back();
    }).not.toThrow();
    expect(setChosen.mock.calls).toEqual([[20], [null]]);
  });
});

/* ------------------------------------------------------------------ */
/* Helpers for the integration engineer                                */
/* ------------------------------------------------------------------ */

describe("floodNumberShort", () => {
  it("gives a short Places line", () => {
    expect(floodNumberShort(46.48)).toBe("floods at about 46.5 ft");
    expect(floodNumberShort(46.1)).toBe("floods at about 46 ft");
    expect(floodNumberShort(46.48, true)).toBe("floods at roughly 46 ft");
  });

  it("is null with no number", () => {
    expect(floodNumberShort(null)).toBeNull();
    expect(floodNumberShort(-1)).toBeNull();
    expect(floodNumberShort(Number.NaN)).toBeNull();
  });
});

describe("floodNumberInputFor", () => {
  const PIN: Pin = {
    id: "ex0",
    name: "Levee St",
    matchedAddress: "LEVEE ST, VICKSBURG, MS",
    lat: 32.354,
    lon: -90.8825,
    elevationFt: PIN_ELEV,
  };
  const GAUGE: GaugeSummary = {
    lid: "VCKM6",
    name: "Mississippi River at Vicksburg",
    usgsId: "07289000",
    distanceMi: 0.5,
    gaugeZeroFt: ZERO,
    gaugeDatum: "NGVD29",
    categories: { minor: 43 },
    historicCrests: [{ stageFt: 57.1, time: "2011-05-19T00:00:00Z" }],
    // Out of order on purpose: the newest reading wins.
    observed: [
      { t: "2026-10-23T18:45:00Z", stageFt: 15.4 },
      { t: "2026-10-23T18:00:00Z", stageFt: 15.0 },
    ],
    forecast: [],
    forecastIssued: null,
  };
  const STALE = { observedH: 5, forecastH: 3, staleObserved: true, staleForecast: false };
  const full = (over: Partial<GaugeSummary> = {}): Pick<PinWatch, "verdict" | "gauge"> => ({
    verdict: {
      tier: "FULL",
      band: "UNLIKELY",
      marginFt: 29,
      peak: { waterElevFt: ZERO + 17.2, stageFt: 17.2, t: "2026-10-25T12:00:00Z" },
      crossing: null,
      pastPeak: false,
      currentlyAbove: false,
      currentWaterElevFt: ZERO + 15.4,
      stale: STALE,
    },
    gauge: { ...GAUGE, ...over },
  });

  it("builds the props for a FULL verdict", () => {
    expect(floodNumberInputFor(PIN, full())).toEqual({
      pinName: "Levee St",
      approximate: false,
      pinElevationFt: PIN_ELEV,
      gaugeZeroFt: ZERO,
      gaugeName: "Mississippi River at Vicksburg",
      currentStageFt: 15.4,
      currentStale: true,
      forecastPeakStageFt: 17.2,
      categories: { minor: 43 },
      historicCrests: GAUGE.historicCrests,
    });
    expect(floodNumberInputFor({ ...PIN, approximate: true }, full())!.approximate).toBe(true);
  });

  it("is null for CATEGORY, ALERT-ONLY, no gauge or no flood number", () => {
    const cat: Pick<PinWatch, "verdict" | "gauge"> = {
      verdict: {
        tier: "CATEGORY",
        peakStageFt: 17.2,
        peakT: "2026-10-25T12:00:00Z",
        aboveFloodFt: -25.8,
        category: "none",
        stale: STALE,
      },
      gauge: GAUGE,
    };
    expect(floodNumberInputFor(PIN, cat)).toBeNull();
    expect(floodNumberInputFor(PIN, { verdict: { tier: "ALERT_ONLY" }, gauge: null })).toBeNull();
    expect(floodNumberInputFor(PIN, { ...full(), gauge: null })).toBeNull();
    expect(floodNumberInputFor(PIN, full({ gaugeZeroFt: null }))).toBeNull();
    expect(floodNumberInputFor({ ...PIN, elevationFt: 40 }, full())).toBeNull();
  });

  it("reads no reading as null", () => {
    expect(floodNumberInputFor(PIN, full({ observed: [] }))!.currentStageFt).toBeNull();
  });
});

describe("end to end on recorded data (Pearl River at Jackson)", () => {
  beforeEach(() => clearCache());

  it("a FULL pin gets its number; crests without a datum flag show no record", async () => {
    const home: Pin = {
      id: "p1",
      name: "Home",
      matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
      lat: 32.300441828077,
      lon: -90.188419699815,
      elevationFt: 275.5,
    };
    const [w] = await watchPins([home], testFetchers, "2026-08-25T05:00:00Z");
    const fn = floodNumberInputFor(home, w)!;
    expect(fn).not.toBeNull();
    const v = floodNumberView(fn)!;
    // 275.5 - 233.39 = 42.11
    expect(v.headline).toBe(
      "Your flood number: about 42 ft on the Pearl River gauge at Jackson.",
    );
    expect(v.context).toContain("Your number is about 14 ft above flood stage, 28.0 ft.");
    // lib/gauges drops NWPS olddatum today, so no record is claimed.
    expect(v.context.some((l) => /record/.test(l))).toBe(false);
    expect(v.marks.some((m) => m.kind === "record")).toBe(false);
    expect(whatIfReadout(v.range.start, fn)).toMatch(/stays dry by about \d+ ft/);
  });
});

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

describe("<FloodNumber>", () => {
  it("renders the number, context, levee line and slider at the forecast", () => {
    const html = render(<FloodNumber {...input()} />);
    expect(html).toContain('data-testid="flood-number"');
    expect(html).toContain(">Your flood number</h2>");
    expect(html).toContain("about 46.5 ft");
    expect(html).toContain("on the Mississippi River gauge at Vicksburg.");
    expect(html).toContain(
      "When the river reads about 46.5 ft on that gauge, water reaches the ground at Levee St.",
    );
    expect(html).toContain("The river reads 15.0 ft now, about 31 ft below your number.");
    expect(html).toContain("The highest crest on record here was 57.1 ft, in May 2011.");
    expect(html).toContain("CrestWatch doesn't count levees or floodwalls.");
    expect(html).toMatch(/<input[^>]*type="range"/);
    expect(html).toMatch(/min="10"/);
    expect(html).toMatch(/max="63"/);
    expect(html).toMatch(/step="0.5"/);
    const readout = whatIfReadout(17.2, input());
    expect(readout).toBe(
      "If the river reaches 17.2 ft on the gauge, Levee St stays dry by about 29 ft.",
    );
    expect(html).toContain(`aria-valuetext="${readout}"`);
    expect(html).toContain(">Back to the forecast</button>");
    expect(html).toMatch(/aria-disabled="true"[^>]*>Back to the forecast/);
    expect(html).not.toContain(copy.approximateTag);
    // The slider's label is tied to it.
    const id = html.match(/<label for="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });

  it("tags an approximate place as rough", () => {
    const html = render(<FloodNumber {...input({ approximate: true, pinName: "Home" })} />);
    expect(html).toContain(">Your rough flood number</h2>");
    expect(html).toContain(copy.approximateTag);
    expect(html).toContain("the approximate spot for Home");
  });

  it("renders nothing without a flood number", () => {
    expect(render(<FloodNumber {...input({ pinElevationFt: 40 })} />)).toBe("");
    expect(render(<FloodNumber {...input({ gaugeZeroFt: null })} />)).toBe("");
  });

  it("works with no parent wiring", () => {
    expect(() => render(<FloodNumber {...input()} />)).not.toThrow();
  });
});

describe("<FloodNumberPanel> handlers", () => {
  const view = floodNumberView(input())!;
  const panel = (atForecast: boolean, onSlide = vi.fn(), onBack = vi.fn()) => ({
    tree: FloodNumberPanel({
      view,
      stageFt: atForecast ? view.range.start : 50,
      atForecast,
      readout: whatIfReadout(atForecast ? view.range.start : 50, input()),
      idBase: "fn",
      onSlide,
      onBack,
    }),
    onSlide,
    onBack,
  });

  it("passes the slider's raw value up", () => {
    const { tree, onSlide } = panel(true);
    const [slider] = findAll(tree, (el) => el.type === "input" && el.props.type === "range");
    (slider.props.onChange as (e: unknown) => void)({ currentTarget: { value: "50" } });
    expect(onSlide).toHaveBeenCalledWith("50");
  });

  it("Back to the forecast does nothing at the forecast, and resets off it", () => {
    const at = panel(true);
    const [b1] = findAll(at.tree, (el) => el.type === "button");
    (b1.props.onClick as () => void)();
    expect(at.onBack).not.toHaveBeenCalled();
    expect(b1.props["aria-disabled"]).toBe(true);

    const off = panel(false);
    const [b2] = findAll(off.tree, (el) => el.type === "button");
    expect(b2.props["aria-disabled"]).toBeUndefined();
    (b2.props.onClick as () => void)();
    expect(off.onBack).toHaveBeenCalledTimes(1);
  });

  it("the slider's spoken value is the readout", () => {
    const { tree } = panel(false);
    const [slider] = findAll(tree, (el) => el.type === "input");
    expect(slider.props["aria-valuetext"]).toBe(
      "If the river reaches 50.0 ft on the gauge, water would be about 4 ft deep at Levee St.",
    );
    expect(slider.props.value).toBe(50);
  });

  it("44 px touch targets on the slider and the button", () => {
    const { tree } = panel(false);
    const [slider] = findAll(tree, (el) => el.type === "input");
    const [button] = findAll(tree, (el) => el.type === "button");
    expect(String(slider.props.className)).toMatch(/\bh-11\b/);
    expect(String(button.props.className)).toMatch(/\bmin-h-11\b/);
  });
});

/* ------------------------------------------------------------------ */
/* Copy rules                                                          */
/* ------------------------------------------------------------------ */

describe("floodNumber copy follows the lib/copy.ts rules", () => {
  const samples: string[] = [];
  for (const [key, value] of Object.entries(copy)) {
    if (!key.startsWith("floodNumber")) continue;
    samples.push(
      typeof value === "function"
        ? String((value as (...a: unknown[]) => unknown)("46.5", "Levee St", true))
        : String(value),
    );
  }
  // And the strings the logic builds from them.
  for (const over of [{}, { approximate: true }, { currentStale: true }, { currentStageFt: 47 }]) {
    const v = floodNumberView(input(over))!;
    samples.push(v.headline, v.explainer, ...v.context, v.levees);
    for (let s = v.range.min; s <= v.range.max; s += 0.5) samples.push(whatIfReadout(s, input(over)));
  }

  it("has keys to check", () => {
    expect(samples.length).toBeGreaterThan(40);
  });

  it("no em dashes, exclamation marks, banned words or automated talk", () => {
    for (const s of samples) {
      expect(s).not.toMatch(/[—–!]/);
      expect(s).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
      expect(s).not.toMatch(/\bAI\b/);
    }
  });
});
