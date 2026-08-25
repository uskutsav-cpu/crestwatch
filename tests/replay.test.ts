import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPLAY_EVENTS } from "@/lib/config";
import { parseDvSeries, replayStats, toElevationSeries } from "@/lib/replay";
import { crestCompare, ordinal } from "@/lib/crest-compare";

const readFix = (f: string) =>
  JSON.parse(
    readFileSync(join(__dirname, "fixtures", "replay", f), "utf8"),
  ) as unknown;

const event = (id: string) => REPLAY_EVENTS.find((e) => e.id === id)!;

describe("replay — 2019 Yazoo backwater at Redwood (recorded)", () => {
  const days = toElevationSeries(
    parseDvSeries(readFix("dv_backwater2019.json")),
    event("backwater2019"),
  );

  it("has the full event and the documented crest", () => {
    expect(days.length).toBeGreaterThan(200);
    const stats = replayStats(days, 94)!;
    expect(stats.crest.waterElevFt).toBeCloseTo(100.19, 2);
    expect(stats.crest.date).toBe("2019-03-16");
  });

  it("a 94 ft farm road stays underwater for months", () => {
    const stats = replayStats(days, 94)!;
    expect(stats.daysAbove).toBeGreaterThan(90); // the six-month story
    expect(stats.firstAbove).not.toBeNull();
    expect(stats.lastAbove! > stats.firstAbove!).toBe(true);
  });

  it("a high spot never floods", () => {
    const stats = replayStats(days, 150)!;
    expect(stats.daysAbove).toBe(0);
    expect(stats.firstAbove).toBeNull();
  });
});

describe("replay — Pearl at Jackson (gauge zero added)", () => {
  it("Feb 2020 crest lands at 36.6 ft stage → ~270 ft elevation", () => {
    const days = toElevationSeries(
      parseDvSeries(readFix("dv_pearl2020.json")),
      event("pearl2020"),
    );
    const stats = replayStats(days, 268)!;
    expect(stats.crest.waterElevFt).toBeCloseTo(233.39 + 36.62, 1);
    expect(stats.daysAbove).toBeGreaterThan(0);
  });

  it("Aug 2022 crest ~35.2 ft stage", () => {
    const days = toElevationSeries(
      parseDvSeries(readFix("dv_pearl2022.json")),
      event("pearl2022"),
    );
    const stats = replayStats(days, 300)!;
    expect(stats.crest.waterElevFt).toBeCloseTo(233.39 + 35.19, 1);
    expect(stats.daysAbove).toBe(0);
  });
});

describe("crest compare", () => {
  const crests = [
    { stageFt: 43.28, time: "1979-04-17T00:00:00Z" },
    { stageFt: 39.58, time: "1983-05-25T00:00:00Z" },
    { stageFt: 36.62, time: "2020-02-17T00:00:00Z" },
    { stageFt: 35.19, time: "2022-08-29T00:00:00Z" },
    { stageFt: 34.1, time: "2016-03-14T00:00:00Z" },
  ];
  const cats = { action: 24, minor: 28, moderate: 33, major: 36 };

  it("ranks only against modern crests", () => {
    // Forecast 35.5: below 36.62, above 35.19/34.1 → 2nd since 2000.
    const cc = crestCompare(35.5, crests, cats)!;
    expect(cc.rank).toBe(2);
    expect(cc.ordinal).toBe("2nd");
    expect(cc.sinceYear).toBe(2000);
  });

  it("returns null below action stage", () => {
    expect(crestCompare(10, crests, cats)).toBeNull();
  });

  it("returns null with no modern crests", () => {
    expect(crestCompare(40, crests.slice(0, 2), cats)).toBeNull();
  });

  it("ordinals", () => {
    expect([1, 2, 3, 4, 11, 21].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "21st",
    ]);
  });
});
