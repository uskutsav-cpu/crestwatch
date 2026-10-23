import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { REPLAY_EVENTS } from "@/lib/config";
import { EXAMPLE_PINS } from "@/lib/example";
import {
  crestIndex,
  eventDistanceMi,
  haversineMi,
  isNearEvent,
  nearestEventFor,
  parseDvSeries,
  replayStats,
  toElevationSeries,
  type ReplayDay,
} from "@/lib/replay";
import { crestCompare, ordinal } from "@/lib/crest-compare";
import { POST } from "@/app/api/replay/route";

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

/* Places from tests/fixtures/geo_fixtures.json (Census lookups). */
const VICKSBURG = { lat: 32.349033641592, lon: -90.882368787159 };
const ROLLING_FORK = { lat: 32.908491588415, lon: -90.87486015929 };
const JACKSON = { lat: 32.300441828077, lon: -90.188419699815 };
const TUPELO = { lat: 34.2576, lon: -88.7034 };

describe("replay only compares places near the flood's gauge", () => {
  it("haversine gives sane miles", () => {
    expect(haversineMi(0, 0, 0, 0)).toBe(0);
    // Vicksburg to downtown Jackson is about 40 miles as the crow flies.
    expect(haversineMi(VICKSBURG.lat, VICKSBURG.lon, JACKSON.lat, JACKSON.lon)).toBeGreaterThan(38);
    expect(haversineMi(VICKSBURG.lat, VICKSBURG.lon, JACKSON.lat, JACKSON.lon)).toBeLessThan(42);
  });

  it("every event names its gauge's position and a radius", () => {
    for (const e of REPLAY_EVENTS) {
      expect(Math.abs(e.gaugeLat - 32.4)).toBeLessThan(1); // central Mississippi
      expect(Math.abs(e.gaugeLon + 90.5)).toBeLessThan(1);
      expect(e.maxMi).toBeGreaterThan(0);
    }
  });

  it("Vicksburg and Rolling Fork are near the 2019 backwater, not the Pearl", () => {
    expect(eventDistanceMi(event("backwater2019"), VICKSBURG)).toBeCloseTo(10, -1);
    expect(eventDistanceMi(event("backwater2019"), ROLLING_FORK)).toBeCloseTo(29, -1);
    expect(isNearEvent(event("backwater2019"), VICKSBURG)).toBe(true);
    expect(isNearEvent(event("backwater2019"), ROLLING_FORK)).toBe(true);
    for (const id of ["pearl2020", "pearl2022"]) {
      expect(isNearEvent(event(id), VICKSBURG)).toBe(false);
      expect(isNearEvent(event(id), ROLLING_FORK)).toBe(false);
    }
  });

  it("Jackson is near the Pearl, too far from the Yazoo at Redwood", () => {
    expect(isNearEvent(event("pearl2020"), JACKSON)).toBe(true);
    expect(isNearEvent(event("pearl2022"), JACKSON)).toBe(true);
    expect(isNearEvent(event("backwater2019"), JACKSON)).toBe(false);
    expect(eventDistanceMi(event("backwater2019"), JACKSON)).toBeGreaterThan(35);
  });

  it("picks the nearest in-range flood, keeping the current one on a tie", () => {
    expect(nearestEventFor(REPLAY_EVENTS, ROLLING_FORK)?.id).toBe("backwater2019");
    expect(nearestEventFor(REPLAY_EVENTS, VICKSBURG, "pearl2022")?.id).toBe("backwater2019");
    expect(nearestEventFor(REPLAY_EVENTS, JACKSON)?.id).toBe("pearl2020");
    expect(nearestEventFor(REPLAY_EVENTS, JACKSON, "pearl2022")?.id).toBe("pearl2022");
    expect(nearestEventFor(REPLAY_EVENTS, TUPELO)).toBeNull();
  });

  it("the example places land on a flood they're near", () => {
    const e = nearestEventFor(REPLAY_EVENTS, EXAMPLE_PINS[0]);
    expect(e?.id).toBe("backwater2019");
    const stats = replayStats(
      toElevationSeries(parseDvSeries(readFix("dv_backwater2019.json")), e!),
      EXAMPLE_PINS[0].elevationFt,
    )!;
    expect(stats.daysAbove).toBeGreaterThan(0);
  });
});

describe("replay play button helpers", () => {
  it("crestIndex finds the highest day (the reduced-motion jump)", () => {
    const days = toElevationSeries(
      parseDvSeries(readFix("dv_backwater2019.json")),
      event("backwater2019"),
    );
    expect(days[crestIndex(days)].date).toBe("2019-03-16");
    expect(crestIndex([{ date: "2020-01-01", waterElevFt: 1 }])).toBe(0);
  });
});

describe("POST /api/replay serves recorded data with no network", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const post = (body: unknown, ip = "10.0.0.1") =>
    POST(
      new NextRequest("http://localhost/api/replay", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify(body),
      }),
    );

  it("the shipped series are the recorded fixtures, byte for byte", () => {
    for (const f of ["dv_backwater2019.json", "dv_pearl2020.json", "dv_pearl2022.json"]) {
      const shipped = readFileSync(join(__dirname, "..", "lib", "replay-data", f), "utf8");
      const recorded = readFileSync(join(__dirname, "fixtures", "replay", f), "utf8");
      expect(shipped).toBe(recorded);
    }
  });

  it("answers every event with fetch disabled", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network is off");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const crests: Record<string, number> = {
      backwater2019: 100.19,
      pearl2020: 233.39 + 36.62,
      pearl2022: 233.39 + 35.19,
    };
    for (const e of REPLAY_EVENTS) {
      const res = await post({ eventId: e.id }, `10.0.1.${e.id.length}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { ok: boolean; event: string; days: ReplayDay[] };
      expect(json.ok).toBe(true);
      expect(json.event).toBe(e.id);
      expect(json.days.length).toBeGreaterThan(20);
      expect(json.days[0].date >= e.startDT).toBe(true);
      expect(json.days.at(-1)!.date <= e.endDT).toBe(true);
      const crest = Math.max(...json.days.map((d) => d.waterElevFt));
      expect(crest).toBeCloseTo(crests[e.id], 1);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an unknown event", async () => {
    const res = await post({ eventId: "nope" }, "10.0.2.1");
    expect(res.status).toBe(400);
  });

  it("keeps the rate limit", async () => {
    let last = 200;
    for (let i = 0; i < 125; i++) {
      last = (await post({ eventId: "pearl2020" }, "10.0.3.1")).status;
    }
    expect(last).toBe(429);
  });
});
