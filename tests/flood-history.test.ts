/**
 * Package history: "Past floods at your place". The pure math in
 * lib/flood-history.ts, plus the NWPS olddatum flag in parseHistoricCrests.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import {
  PAST_FLOODS_TOP,
  atPinWords,
  crestLooksSane,
  crestMonthYear,
  outcomeFor,
  pastFloods,
  pastFloodsSummary,
  type PastFloodsInput,
} from "@/lib/flood-history";
import { datumLooksSane, parseHistoricCrests, type HistoricCrest } from "@/lib/gauges";
import { BANDS } from "@/lib/config";
import { EXAMPLE_PINS } from "@/lib/example";
import { bandFor } from "@/lib/surveyor";

const NOW = "2026-10-23T17:00:00Z";
/** Vicksburg's USGS gauge zero (07289000, NGVD29), as the app reads it. */
const VICKSBURG_ZERO = 46.22;

/**
 * Shaped like Vicksburg (VCKM6). The top three are the real figures
 * (2011 57.1, 1927 56.2, 1937 53.2); the rest are test values.
 */
const CRESTS: HistoricCrest[] = [
  { stageFt: 50.8, time: "1983-05-30T00:00:00Z" },
  { stageFt: 57.1, time: "2011-05-19T00:00:00Z" },
  { stageFt: 48.1, time: "2016-01-17T00:00:00Z" },
  { stageFt: 53.2, time: "1937-02-21T00:00:00Z" },
  { stageFt: 50.3, time: "2019-03-20T00:00:00Z" },
  { stageFt: 56.2, time: "1927-05-04T00:00:00Z" },
  { stageFt: 51.6, time: "1973-05-14T00:00:00Z" },
  { stageFt: 40.0, time: "1950-02-10T00:00:00Z" },
];

const levee = EXAMPLE_PINS[0]; // 92.7 ft
const museum = EXAMPLE_PINS[1]; // 117.0 ft

function input(over: Partial<PastFloodsInput> = {}): PastFloodsInput {
  return {
    pinName: levee.name,
    approximate: false,
    pinElevationFt: levee.elevationFt,
    gaugeZeroFt: VICKSBURG_ZERO,
    historicCrests: CRESTS,
    now: NOW,
    ...over,
  };
}

describe("parseHistoricCrests reads the NWPS olddatum flag", () => {
  const detail = (historic: unknown[]) =>
    ({ flood: { crests: { historic } } }) as Parameters<typeof parseHistoricCrests>[0];

  it("true, false, a 'true' string and a missing flag", () => {
    const out = parseHistoricCrests(
      detail([
        { stage: 40, occurredTime: "1913-04-01T00:00:00Z", olddatum: true },
        { stage: 39, occurredTime: "2011-05-19T00:00:00Z", olddatum: false },
        { stage: 38, occurredTime: "1912-04-01T00:00:00Z", olddatum: "true" },
        { stage: 37, occurredTime: "1983-05-30T00:00:00Z" },
      ]),
    );
    expect(out.map((c) => c.oldDatum)).toEqual([true, false, true, false]);
    expect(out[0]).toEqual({ stageFt: 40, time: "1913-04-01T00:00:00Z", oldDatum: true });
  });

  it("the recorded Jackson fixture: every crest is on today's datum", () => {
    const raw = JSON.parse(
      readFileSync(join(__dirname, "fixtures", "gauges", "nwps_detail_JACM6.json"), "utf8"),
    );
    const out = parseHistoricCrests(raw);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.oldDatum === false)).toBe(true);
  });
});

describe("pastFloods: which crests, in what order", () => {
  it("the 5 highest, highest first, then the most recent of the last 15 years", () => {
    const r = pastFloods(input())!;
    expect(r.top).toBe(PAST_FLOODS_TOP);
    expect(r.rows.map((x) => x.stageFt)).toEqual([57.1, 56.2, 53.2, 51.6, 50.8, 50.3]);
    expect(r.rows.map((x) => x.recent)).toEqual([false, false, false, false, false, true]);
    // 2011-05 falls just outside 15 years of 2026-10; 2019 beats 2016 on date.
    expect(r.rows[5].monthYear).toBe("March 2019");
  });

  it("no extra row when the most recent big one is already among the highest", () => {
    const crests = CRESTS.map((c) =>
      c.time.startsWith("2019") ? { ...c, stageFt: 54 } : c,
    );
    const r = pastFloods(input({ historicCrests: crests }))!;
    expect(r.rows).toHaveLength(5);
    expect(r.rows.some((x) => x.recent)).toBe(false);
    expect(r.rows.map((x) => x.stageFt)).toEqual([57.1, 56.2, 54, 53.2, 51.6]);
  });

  it("no extra row when nothing crested in the last 15 years", () => {
    const r = pastFloods(input({ now: "2045-01-01T00:00:00Z" }))!;
    expect(r.rows).toHaveLength(5);
    expect(r.rows.some((x) => x.recent)).toBe(false);
  });

  it("picks the most recent by date, not the highest, inside the window", () => {
    const crests = [
      ...CRESTS,
      { stageFt: 45, time: "2024-06-01T00:00:00Z" },
    ];
    const r = pastFloods(input({ historicCrests: crests }))!;
    expect(r.rows.at(-1)).toMatchObject({ recent: true, stageFt: 45, monthYear: "June 2024" });
  });

  it("a crest exactly 15 years back still counts; a future-dated one doesn't", () => {
    const crests = [
      { stageFt: 60, time: "2000-01-01T00:00:00Z" },
      { stageFt: 59, time: "1999-01-01T00:00:00Z" },
      { stageFt: 58, time: "1998-01-01T00:00:00Z" },
      { stageFt: 57, time: "1997-01-01T00:00:00Z" },
      { stageFt: 56, time: "1996-01-01T00:00:00Z" },
      { stageFt: 30, time: "2011-10-23T17:00:00Z" },
      { stageFt: 31, time: "2027-04-01T00:00:00Z" },
    ];
    const r = pastFloods(input({ historicCrests: crests }))!;
    expect(r.rows).toHaveLength(6);
    expect(r.rows[5]).toMatchObject({ recent: true, stageFt: 30 });
  });

  it("fewer than 5 usable crests: shows them all, no extra row", () => {
    const r = pastFloods(input({ historicCrests: CRESTS.slice(0, 3) }))!;
    expect(r.top).toBe(3);
    expect(r.rows.map((x) => x.stageFt)).toEqual([57.1, 50.8, 48.1]);
  });

  it("a tie goes to the more recent crest; a date listed twice counts once", () => {
    const crests = [
      { stageFt: 50, time: "1990-01-01T00:00:00Z" },
      { stageFt: 50, time: "2000-01-01T00:00:00Z" },
      { stageFt: 49, time: "1990-01-01T00:00:00Z" },
    ];
    const r = pastFloods(input({ historicCrests: crests, now: "2050-01-01T00:00:00Z" }))!;
    expect(r.rows.map((x) => x.time)).toEqual([
      "2000-01-01T00:00:00Z",
      "1990-01-01T00:00:00Z",
    ]);
  });

  it("skips crests with no usable stage or date", () => {
    const crests = [
      { stageFt: Number.NaN, time: "2001-01-01T00:00:00Z" },
      { stageFt: 52, time: "not a date" },
      { stageFt: 51, time: "2002-01-01T00:00:00Z" },
    ];
    const r = pastFloods(input({ historicCrests: crests }))!;
    expect(r.rows.map((x) => x.stageFt)).toEqual([51]);
  });
});

describe("pastFloods: old datum crests are left out", () => {
  const withOld: HistoricCrest[] = [
    { stageFt: 58.3, time: "1913-04-01T00:00:00Z", oldDatum: true },
    ...CRESTS,
  ];

  it("never compared, never in a row, but counted and said", () => {
    const r = pastFloods(input({ historicCrests: withOld }))!;
    expect(r.rows.map((x) => x.stageFt)).not.toContain(58.3);
    expect(r.rows[0].stageFt).toBe(57.1);
    expect(r.leftOut).toBe(1);
    expect(r.leftOutNote).toBe(copy.pastFloodsLeftOut(1));
    // The shown crests are no longer the whole record: say "can compare".
    expect(r.summary).toBe(
      "All 5 of the highest crests CrestWatch can compare here would have reached Levee St.",
    );
  });

  it("no old datum crests: no note, plain summary", () => {
    const r = pastFloods(input())!;
    expect(r.leftOut).toBe(0);
    expect(r.leftOutNote).toBeNull();
    expect(r.summary).not.toMatch(/can compare/);
  });

  it("every crest on an old datum: nothing to show", () => {
    const all = CRESTS.map((c) => ({ ...c, oldDatum: true }));
    expect(pastFloods(input({ historicCrests: all }))).toBeNull();
  });
});

describe("pastFloods: the numbers at the pin", () => {
  it("Levee St: the 2011 crest puts about 11 ft of water there", () => {
    const r = pastFloods(input())!;
    const y2011 = r.rows[0];
    expect(y2011.monthYear).toBe("May 2011");
    expect(y2011.stageLabel).toBe("57.1 ft on the gauge");
    expect(y2011.waterElevFt).toBeCloseTo(103.32, 6);
    expect(y2011.depthFt).toBeCloseTo(10.62, 6);
    expect(y2011.atPin).toBe("about 11 ft of water here");
    expect(r.rows.map((x) => x.atPin)).toEqual([
      "about 11 ft of water here",
      "about 10 ft of water here",
      "about 7 ft of water here",
      "about 5 ft of water here",
      "about 4 ft of water here",
      "about 4 ft of water here",
    ]);
  });

  it("Museum: every crest stays below", () => {
    const r = pastFloods(input({ pinName: museum.name, pinElevationFt: museum.elevationFt }))!;
    expect(r.rows[0].atPin).toBe("stayed about 14 ft below");
    expect(r.rows.every((x) => !x.reached)).toBe(true);
    expect(r.summary).toBe("None of the 5 highest crests here would have reached Museum.");
    expect(r.noneNote).toBe(copy.pastFloodsBigger);
  });

  it("wording thresholds: whole feet, words under a foot", () => {
    expect(atPinWords(10.62)).toBe("about 11 ft of water here");
    expect(atPinWords(1.49)).toBe("about 1 ft of water here");
    expect(atPinWords(1)).toBe("about 1 ft of water here");
    expect(atPinWords(0.99)).toBe("less than a foot of water here");
    expect(atPinWords(0)).toBe("less than a foot of water here");
    expect(atPinWords(-0.01)).toBe(copy.pastFloodsWithinFoot);
    expect(atPinWords(-0.99)).toBe(copy.pastFloodsWithinFoot);
    expect(atPinWords(-1)).toBe("stayed about 1 ft below");
    expect(atPinWords(-1.5)).toBe("stayed about 2 ft below");
    expect(atPinWords(-13.68)).toBe("stayed about 14 ft below");
    expect([2, 0.3, -0.3, -2].map(outcomeFor)).toEqual([
      "water",
      "underFoot",
      "withinFoot",
      "below",
    ]);
  });

  it("float noise at a threshold doesn't flip the words", () => {
    // 46.22 + 47.48 - 92.7 is 0.99999… in floats; it's 1 ft.
    const r = pastFloods(
      input({ historicCrests: [{ stageFt: 47.48, time: "2020-01-01T00:00:00Z" }] }),
    )!;
    expect(r.rows[0].atPin).toBe("about 1 ft of water here");
    // Water exactly at the ground counts as reaching it.
    const at = pastFloods(
      input({
        pinElevationFt: 100,
        gaugeZeroFt: 50,
        historicCrests: [{ stageFt: 50, time: "2020-01-01T00:00:00Z" }],
      }),
    )!;
    expect(at.rows[0]).toMatchObject({ reached: true, atPin: "less than a foot of water here" });
    expect(at.summary).toBe("The highest crest here would have reached Levee St.");
  });

  it("month and year read in UTC (a crest on the 1st is not the month before)", () => {
    expect(crestMonthYear("2011-05-01T00:00:00Z")).toBe("May 2011");
    expect(crestMonthYear("1927-12-31T00:00:00Z")).toBe("December 1927");
  });
});

describe("pastFloods: the summary line", () => {
  it("some reached, the rest too close to call", () => {
    // Pin at 100: 2011 +3.3, 1927 +2.4, 1937 -0.6, 1973 -2.2, 1983 -3.0.
    // Every miss is inside the borderline band, so none is called a miss.
    const r = pastFloods(input({ pinName: "Home", pinElevationFt: 100 }))!;
    expect(r.reached).toBe(2);
    expect(r.closeCalls).toBe(3);
    // The row words stay as they are: whole feet, or "within a foot".
    expect(r.rows[2].atPin).toBe(copy.pastFloodsWithinFoot);
    expect(r.rows[3].atPin).toBe("stayed about 2 ft below");
    expect(r.summary).toBe(
      "2 of the 5 highest crests here would have reached Home. 3 more would have been too close to call.",
    );
    expect(r.noneNote).toBeNull();
  });

  it("some reached, one too close to call, the rest clear misses", () => {
    // Pin at 102: 2011 +1.3, 1927 +0.4, 1937 -2.6, 1973 -4.2, 1983 -5.0.
    const r = pastFloods(input({ pinName: "Home", pinElevationFt: 102 }))!;
    expect(r.reached).toBe(2);
    expect(r.closeCalls).toBe(1);
    expect(r.summary).toBe(
      "2 of the 5 highest crests here would have reached Home. One more would have been too close to call.",
    );
  });

  it("matches the Surveyor's bands: a miss inside BANDS.borderline is never 'wouldn't have reached'", () => {
    // Water at 95 ft. bandFor(pin - 95) is what the live verdict would say.
    for (const m of [0.01, 0.4, BANDS.likely, 1, 2, 3.49, BANDS.borderline, 3.51, 5]) {
      const pin = 95 + m;
      const r = pastFloods(
        input({
          pinName: "Home",
          pinElevationFt: pin,
          gaugeZeroFt: 50,
          historicCrests: [{ stageFt: 45, time: "2020-01-01T00:00:00Z" }],
        }),
      )!;
      const close = bandFor(pin - 95) !== "UNLIKELY";
      expect(r.closeCalls, `margin ${m}`).toBe(close ? 1 : 0);
      expect(r.summary, `margin ${m}`).toBe(
        close
          ? "The highest crest here would have been too close to call at Home."
          : "The highest crest here wouldn't have reached Home.",
      );
    }
  });

  it("regression: a 2 ft margin (BORDERLINE live) doesn't read as a flat miss", () => {
    // Gauge zero 50; crests at 95, 90 and 85 ft; Home at 97.
    const r = pastFloods(
      input({
        pinName: "Home",
        pinElevationFt: 97,
        gaugeZeroFt: 50,
        historicCrests: [
          { stageFt: 45, time: "2020-01-01T00:00:00Z" },
          { stageFt: 40, time: "2010-01-01T00:00:00Z" },
          { stageFt: 35, time: "2000-01-01T00:00:00Z" },
        ],
      }),
    )!;
    expect(bandFor(97 - 95)).toBe("BORDERLINE");
    expect(r.reached).toBe(0);
    expect(r.closeCalls).toBe(1);
    expect(r.summary).not.toMatch(/would have reached Home\.$/);
    expect(r.summary).toBe(
      "None of the 3 highest crests here would have clearly reached Home, but one would have been too close to call.",
    );
    expect(r.noneNote).toBe(copy.pastFloodsBigger);
  });

  it("regression: a 0.4 ft margin (LIKELY live) is too close to call, not a miss", () => {
    const r = pastFloods(
      input({
        pinName: "Home",
        pinElevationFt: 95.4,
        gaugeZeroFt: 50,
        historicCrests: [
          { stageFt: 45, time: "2020-01-01T00:00:00Z" },
          { stageFt: 40, time: "2010-01-01T00:00:00Z" },
        ],
      }),
    )!;
    expect(bandFor(95.4 - 95)).toBe("LIKELY");
    expect(r.rows[0].atPin).toBe(copy.pastFloodsWithinFoot);
    expect(r.summary).toBe(
      "None of the 2 highest crests here would have clearly reached Home, but one would have been too close to call.",
    );
  });

  it("the recent row never counts toward the summary", () => {
    // Pin at 96.6: only the 2019 extra row (96.52) is a close call; the
    // 1983 crest (97.02) reaches. The top 5 all reach.
    const r = pastFloods(input({ pinElevationFt: 96.6 }))!;
    expect(r.rows[5]).toMatchObject({ recent: true, outcome: "withinFoot" });
    expect(r.closeCalls).toBe(0);
    expect(r.summary).toBe(
      "All 5 of the highest crests here would have reached Levee St.",
    );
  });

  it("every variant reads right", () => {
    const line = copy.pastFloodsLine;
    expect(line(2, 5, 0, "Home", false)).toBe(
      "2 of the 5 highest crests here would have reached Home.",
    );
    expect(line(5, 5, 0, "Home", false)).toBe(
      "All 5 of the highest crests here would have reached Home.",
    );
    expect(line(0, 5, 0, "Home", false)).toBe(
      "None of the 5 highest crests here would have reached Home.",
    );
    expect(line(0, 5, 1, "Home", false)).toBe(
      "None of the 5 highest crests here would have clearly reached Home, but one would have been too close to call.",
    );
    expect(line(0, 4, 2, "Home", false)).toBe(
      "None of the 4 highest crests here would have clearly reached Home, but 2 would have been too close to call.",
    );
    expect(line(1, 5, 1, "Home", false)).toBe(
      "1 of the 5 highest crests here would have reached Home. One more would have been too close to call.",
    );
    expect(line(1, 5, 2, "Home", false)).toBe(
      "1 of the 5 highest crests here would have reached Home. 2 more would have been too close to call.",
    );
    expect(line(1, 1, 0, "Home", false)).toBe(
      "The highest crest here would have reached Home.",
    );
    expect(line(0, 1, 1, "Home", false)).toBe(
      "The highest crest here would have been too close to call at Home.",
    );
    expect(line(0, 1, 0, "Home", true)).toBe(
      "The highest crest CrestWatch can compare here wouldn't have reached Home.",
    );
  });

  it("an approximate pin says 'this spot', never its name", () => {
    const r = pastFloods(input({ pinName: "Grandma", approximate: true }))!;
    expect(r.pinLabel).toBe(copy.pastFloodsSpot);
    expect(r.summary).toBe(
      "All 5 of the highest crests here would have reached this spot.",
    );
    expect(r.summary).not.toContain("Grandma");
  });

  it("pastFloodsSummary is the same line, or null", () => {
    expect(pastFloodsSummary(input())).toBe(pastFloods(input())!.summary);
    expect(pastFloodsSummary(input({ historicCrests: [] }))).toBeNull();
    expect(pastFloodsSummary(input({ gaugeZeroFt: null }))).toBeNull();
  });

  it("pastFloodsSummary never reads as an all-clear: none reached carries the bigger-flood line", () => {
    const museumIn = input({ pinName: museum.name, pinElevationFt: museum.elevationFt });
    const s = pastFloodsSummary(museumIn)!;
    expect(s).toContain(copy.pastFloodsBigger);
    expect(s).toBe(
      `None of the 5 highest crests here would have reached Museum. ${copy.pastFloodsBigger}`,
    );
    // A single crest that misses gets it too, worded for one crest.
    const one = pastFloodsSummary({
      ...museumIn,
      historicCrests: [{ stageFt: 57.1, time: "2011-05-19T00:00:00Z" }],
    })!;
    expect(one).toBe(`The highest crest here wouldn't have reached Museum. ${copy.pastFloodsBiggerOne}`);
    expect(copy.pastFloodsBiggerOne).toBe("A flood bigger than this one could still come.");
    // Something reached: no bigger-flood line needed.
    expect(pastFloodsSummary(input())).not.toContain(copy.pastFloodsBigger);
  });
});

describe("pastFloods: nothing honest to show", () => {
  it("no crests", () => {
    expect(pastFloods(input({ historicCrests: [] }))).toBeNull();
  });

  it("no gauge zero (CATEGORY tier)", () => {
    expect(pastFloods(input({ gaugeZeroFt: null }))).toBeNull();
  });

  it("no usable pin height or gauge zero", () => {
    expect(pastFloods(input({ pinElevationFt: Number.NaN }))).toBeNull();
    expect(pastFloods(input({ gaugeZeroFt: Number.POSITIVE_INFINITY }))).toBeNull();
  });

  it("a gauge zero that puts the water over 200 ft from the ground", () => {
    expect(pastFloods(input({ gaugeZeroFt: 400 }))).toBeNull();
  });

  it("the 200 ft rule is the Surveyor's datumLooksSane", () => {
    for (const [z, s, p] of [
      [46.22, 57.1, 92.7],
      [400, 57.1, 92.7],
      [0, 10, 210],
      [0, 10, 210.01],
      [233.39, 43.28, 40],
    ]) {
      expect(crestLooksSane(z, s, p)).toBe(datumLooksSane(z, s, p));
    }
  });
});

describe("copy rules for the Past floods strings", () => {
  const strings = [
    copy.pastFloodsTitle,
    copy.pastFloodsSpot,
    copy.pastFloodsIntro,
    copy.pastFloodsIntroSpot,
    copy.pastFloodsCaveat,
    copy.pastFloodsBigger,
    copy.pastFloodsStage("57.1"),
    copy.pastFloodsWater(11),
    copy.pastFloodsWaterUnderFoot,
    copy.pastFloodsBelow(14),
    copy.pastFloodsWithinFoot,
    copy.pastFloodsRecent,
    copy.pastFloodsLeftOut(1),
    copy.pastFloodsLeftOut(3),
    copy.pastFloodsSource("Mississippi River at Vicksburg"),
    copy.pastFloodsShow,
    copy.pastFloodsHide,
    ...[
      [2, 5, 1, false],
      [5, 5, 0, false],
      [0, 5, 2, true],
      [1, 1, 0, false],
      [0, 1, 1, false],
      [0, 1, 0, true],
      [0, 5, 1, false],
      [1, 5, 1, false],
    ].map(([r, t, c, l]) =>
      copy.pastFloodsLine(r as number, t as number, c as number, "Home", l as boolean),
    ),
  ];

  it("no em dashes, exclamation marks, banned words or automated", () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/[—–!]/);
      expect(s, s).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
      expect(s, s).not.toMatch(/\bAI\b/);
    }
  });

  it("the caveat says levees and floodwalls aren't counted", () => {
    expect(copy.pastFloodsCaveat).toMatch(/doesn't count levees or floodwalls/);
    expect(copy.pastFloodsCaveat).toMatch(/rough guide/);
  });

  it("the approximate intro never says 'your ground'", () => {
    expect(copy.pastFloodsIntroSpot).not.toMatch(/your ground|house/i);
  });
});

describe("integration review fixes", () => {
  it("two crests that both reach read 'Both', never 'All 2'", () => {
    const r = pastFloods(input({ historicCrests: CRESTS.slice(0, 2) }))!;
    expect(r.top).toBe(2);
    expect(r.summary).toBe("Both of the highest crests here would have reached Levee St.");
  });

  it("drops NWPS -9999 sentinels instead of blanking the section", () => {
    const r = pastFloods(
      input({ historicCrests: [...CRESTS, { stageFt: -9999, time: "2024-04-01T00:00:00Z" }] }),
    )!;
    expect(r).not.toBeNull();
    expect(r.rows.some((row) => row.stageFt < 0)).toBe(false);
  });

  it("with a flood stage, the 'most recent big one' must have reached it", () => {
    const small = { stageFt: 30.0, time: "2025-03-01T00:00:00Z", oldDatum: false };
    const crests = [...CRESTS, small];
    // Without a flood stage the old rule stands: the newest crest gets the row.
    const plain = pastFloods(input({ historicCrests: crests }))!;
    expect(plain.rows.find((row) => row.recent)?.time).toBe(small.time);
    // With Vicksburg's 43 ft flood stage, the 30 ft rise isn't a big one:
    // the newest crest at or over flood stage gets the row instead.
    const gated = pastFloods(input({ historicCrests: crests, floodStageFt: 43 }))!;
    const recent = gated.rows.find((row) => row.recent);
    expect(recent?.time).toBe("2019-03-20T00:00:00Z");
    expect(recent!.stageFt).toBeGreaterThanOrEqual(43);
  });
});
