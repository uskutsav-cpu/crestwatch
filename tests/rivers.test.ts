/**
 * Package rivers: lib/rivers.ts (shaping, category, forecast high,
 * failure omission, caching) and GET /api/rivers (rate limit, ok:false,
 * offline test mode).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Fetchers } from "@/lib/gauges";

const holder = vi.hoisted(() => ({ fetchers: null as Fetchers | null }));
vi.mock("@/lib/test-fetchers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/test-fetchers")>();
  return {
    ...actual,
    routeFetchers: () => holder.fetchers ?? actual.routeFetchers(),
  };
});

import { clearCache } from "@/lib/cache";
import { rateLimitOk } from "@/lib/rate-limit";
import { RATE_LIMIT_PER_HOUR } from "@/lib/config";
import {
  RIVER_GAUGES,
  RIVERS_PARTIAL_TTL_MS,
  RIVERS_TTL_MS,
  fetchRivers,
  riversNow,
  shapeRiver,
  type RiverGauge,
} from "@/lib/rivers";
import { GET } from "@/app/api/rivers/route";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(join(__dirname, "fixtures", "gauges", name), "utf8"),
  ) as unknown;

const YZ_DETAIL = fixture("nwps_detail_YZOM6.json");
const YZ_FLOW = fixture("nwps_stageflow_YZOM6.json");
const JAC_DETAIL = fixture("nwps_detail_JACM6.json");
const JAC_FLOW = fixture("nwps_stageflow_JACM6.json");

/** Just after the fixtures' newest readings (Aug 25 2026, 04:00-04:30Z). */
const NOW_ISO = "2026-08-25T05:00:00Z";
const NOW = Date.parse(NOW_ISO);

const VICKSBURG: RiverGauge = { lid: "VCKM6", name: "Mississippi River at Vicksburg" };

const detail = (cats: Record<string, number>) => ({
  name: "Upstream Name That Drifts",
  flood: {
    categories: Object.fromEntries(
      Object.entries(cats).map(([k, stage]) => [k, { stage }]),
    ),
  },
});
const flow = (
  observed: Array<[string, number]>,
  forecast: Array<[string, number]> = [],
  units = "ft",
) => ({
  observed: {
    primaryUnits: units,
    data: observed.map(([validTime, primary]) => ({ validTime, primary })),
  },
  forecast: {
    issuedTime: "2026-08-25T03:00:00Z",
    primaryUnits: units,
    data: forecast.map(([validTime, primary]) => ({ validTime, primary })),
  },
});
const CATS = { action: 35, minor: 43, moderate: 46, major: 50 };

/** Fetchers serving NWPS bodies per lid; a lid mapped to "throw" fails. */
function nwpsFetchers(
  byLid: Record<string, { detail: unknown; flow: unknown } | "throw">,
  calls: string[] = [],
): Fetchers {
  return {
    json: async (url) => {
      calls.push(url);
      const m = url.match(/\/gauges\/([A-Z0-9]+)(\/stageflow)?$/);
      const entry = m ? byLid[m[1]] : undefined;
      if (!m || entry === undefined || entry === "throw") {
        throw new Error(`upstream 503 for ${url}`);
      }
      return m[2] ? entry.flow : entry.detail;
    },
    text: async () => {
      throw new Error("rivers must not ask for text");
    },
  };
}

const allRivers = (lid: string) =>
  lid === "JACM6"
    ? { detail: JAC_DETAIL, flow: JAC_FLOW }
    : { detail: YZ_DETAIL, flow: YZ_FLOW };

const everyGauge = (
  pick: (lid: string) => { detail: unknown; flow: unknown } | "throw" = allRivers,
) => Object.fromEntries(RIVER_GAUGES.map((g) => [g.lid, pick(g.lid)]));

beforeEach(() => {
  clearCache();
  holder.fetchers = null;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ */

describe("the river list", () => {
  it("is the four district gauges, named by us, in this order", () => {
    expect(RIVER_GAUGES.map((g) => g.lid)).toEqual(["VCKM6", "GEEM6", "YZOM6", "JACM6"]);
    expect(RIVER_GAUGES.map((g) => g.name)).toEqual([
      "Mississippi River at Vicksburg",
      "Mississippi River near Greenville",
      "Yazoo River at Yazoo City",
      "Pearl River at Jackson",
    ]);
  });
});

describe("shapeRiver", () => {
  it("shapes a recorded NWPS gauge, with our name and not upstream's", () => {
    const r = shapeRiver(VICKSBURG, YZ_DETAIL, YZ_FLOW, NOW);
    expect(r).toEqual({
      lid: "VCKM6",
      name: "Mississippi River at Vicksburg",
      stageFt: 8.92,
      observedAt: "2026-08-25T04:00:00.000Z",
      trend: "steady",
      floodStageFt: 29,
      category: "none",
      forecastHigh: { stageFt: 9.3, t: "2026-08-26T06:00:00.000Z" },
      forecastCategory: "none",
    });
  });

  it("takes the latest reading by time, not by array order", () => {
    const r = shapeRiver(
      VICKSBURG,
      detail(CATS),
      flow([
        ["2026-08-25T04:00:00Z", 15.4],
        ["2026-08-24T20:00:00Z", 14.0],
        ["2026-08-24T22:00:00Z", 14.6],
      ]),
      NOW,
    );
    expect(r?.stageFt).toBe(15.4);
    expect(r?.observedAt).toBe("2026-08-25T04:00:00.000Z");
    expect(r?.trend).toBe("rising");
  });

  it("judges the category on the latest reading, not the forecast", () => {
    // Over flood stage now, forecast to drop well under it.
    const r = shapeRiver(
      VICKSBURG,
      detail(CATS),
      flow(
        [
          ["2026-08-24T22:00:00Z", 44.5],
          ["2026-08-25T04:00:00Z", 44.0],
        ],
        [
          ["2026-08-25T12:00:00Z", 42.0],
          ["2026-08-26T12:00:00Z", 40.0],
        ],
      ),
      NOW,
    );
    expect(r?.category).toBe("minor");
    expect(r?.trend).toBe("falling");
    expect(r?.forecastHigh).toEqual({ stageFt: 42, t: "2026-08-25T12:00:00.000Z" });
    expect(r?.forecastCategory).toBe("action");
    // And at exactly flood stage, that's flooding, not below it.
    const at = shapeRiver(
      VICKSBURG,
      detail(CATS),
      flow([["2026-08-25T04:00:00Z", 43]]),
      NOW,
    );
    expect(at?.category).toBe("minor");
  });

  it("forecast high is the highest point still ahead; past points don't count", () => {
    const r = shapeRiver(
      VICKSBURG,
      detail(CATS),
      flow(
        [["2026-08-25T04:00:00Z", 30]],
        [
          ["2026-08-24T18:00:00Z", 60], // behind us, however high
          ["2026-08-25T06:00:00Z", 31],
          ["2026-08-26T06:00:00Z", 47.5],
          ["2026-08-27T06:00:00Z", 47.5], // a tie keeps the first
          ["2026-08-28T06:00:00Z", 45],
        ],
      ),
      NOW,
    );
    expect(r?.forecastHigh).toEqual({ stageFt: 47.5, t: "2026-08-26T06:00:00.000Z" });
    expect(r?.forecastCategory).toBe("moderate");
  });

  it("no forecast ahead means no forecast high, not a made-up one", () => {
    const pastOnly = shapeRiver(
      VICKSBURG,
      detail(CATS),
      flow([["2026-08-25T04:00:00Z", 30]], [["2026-08-25T00:00:00Z", 31]]),
      NOW,
    );
    expect(pastOnly?.forecastHigh).toBeNull();
    expect(pastOnly?.forecastCategory).toBeNull();
    const none = shapeRiver(VICKSBURG, detail(CATS), { observed: flow([["2026-08-25T04:00:00Z", 30]]).observed }, NOW);
    expect(none?.forecastHigh).toBeNull();
  });

  it("flood stage is the minor stage; unknown stays unknown, never calm", () => {
    const noMinor = shapeRiver(
      VICKSBURG,
      detail({ moderate: 46, major: 50 }),
      flow([["2026-08-25T04:00:00Z", 12]], [["2026-08-26T00:00:00Z", 13]]),
      NOW,
    );
    expect(noMinor?.floodStageFt).toBeNull();
    expect(noMinor?.category).toBeNull();
    expect(noMinor?.forecastCategory).toBeNull();
    const noCats = shapeRiver(VICKSBURG, {}, flow([["2026-08-25T04:00:00Z", 12]]), NOW);
    expect(noCats?.floodStageFt).toBeNull();
    expect(noCats?.category).toBeNull();
  });

  it("omits a river with no usable reading", () => {
    expect(shapeRiver(VICKSBURG, detail(CATS), flow([]), NOW)).toBeNull();
    // Flow in kcfs must never pass for feet.
    expect(
      shapeRiver(VICKSBURG, detail(CATS), flow([["2026-08-25T04:00:00Z", 399]], [], "kcfs"), NOW),
    ).toBeNull();
    expect(shapeRiver(VICKSBURG, null, null, NOW)).toBeNull();
    expect(shapeRiver(VICKSBURG, "<html>", "<html>", NOW)).toBeNull();
    expect(
      shapeRiver(VICKSBURG, detail(CATS), flow([["not a time", 12]]), NOW),
    ).toBeNull();
  });
});

describe("fetchRivers", () => {
  it("asks NWPS only: detail and stageflow for each gauge", async () => {
    const calls: string[] = [];
    const a = await fetchRivers(nwpsFetchers(everyGauge(), calls), () => NOW);
    expect(a.ok).toBe(true);
    expect(calls).toHaveLength(RIVER_GAUGES.length * 2);
    expect(calls.every((u) => u.startsWith("https://api.water.noaa.gov/nwps/v1/gauges/"))).toBe(true);
    if (!a.ok) return;
    expect(a.checkedAt).toBe(new Date(NOW).toISOString());
    expect(a.rivers.map((r) => r.name)).toEqual(RIVER_GAUGES.map((g) => g.name));
    const jackson = a.rivers.find((r) => r.lid === "JACM6");
    expect(jackson?.stageFt).toBe(3.21);
    expect(jackson?.floodStageFt).toBe(28);
    expect(jackson?.forecastHigh).toEqual({ stageFt: 3.5, t: "2026-08-25T06:00:00.000Z" });
  });

  it("leaves out a river whose data fails, and fakes nothing in its place", async () => {
    const a = await fetchRivers(
      nwpsFetchers(everyGauge((lid) => (lid === "GEEM6" ? "throw" : allRivers(lid)))),
      () => NOW,
    );
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.rivers.map((r) => r.lid)).toEqual(["VCKM6", "YZOM6", "JACM6"]);
  });

  it("a detail that fails sinks that river too (no guessed flood stage)", async () => {
    const half: Fetchers = {
      json: async (url) => {
        if (url.endsWith("/gauges/YZOM6")) throw new Error("upstream 500");
        return url.endsWith("/stageflow") ? YZ_FLOW : YZ_DETAIL;
      },
      text: async () => "",
    };
    const a = await fetchRivers(half, () => NOW);
    expect(a.ok && a.rivers.map((r) => r.lid)).toEqual(["VCKM6", "GEEM6", "JACM6"]);
  });

  it("is ok:false when every river fails", async () => {
    const a = await fetchRivers(nwpsFetchers(everyGauge(() => "throw")), () => NOW);
    expect(a).toEqual({ ok: false, error: "UPSTREAM" });
  });

  it("is ok:false when every river answers without a reading", async () => {
    const a = await fetchRivers(
      nwpsFetchers(everyGauge(() => ({ detail: detail(CATS), flow: flow([]) }))),
      () => NOW,
    );
    expect(a.ok).toBe(false);
  });
});

describe("riversNow caching", () => {
  it("keeps a complete answer 15 minutes", async () => {
    const t0 = 1_800_000_000_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(t0);
    const calls: string[] = [];
    const f = nwpsFetchers(everyGauge(), calls);
    const first = await riversNow(f, () => NOW);
    expect(first.ok).toBe(true);
    const n = calls.length;
    clock.mockReturnValue(t0 + RIVERS_TTL_MS - 1000);
    expect(await riversNow(f, () => NOW)).toEqual(first);
    expect(calls.length).toBe(n);
    clock.mockReturnValue(t0 + RIVERS_TTL_MS + 1000);
    await riversNow(f, () => NOW);
    expect(calls.length).toBe(2 * n);
  });

  it("never keeps a failure", async () => {
    const down = await riversNow(nwpsFetchers(everyGauge(() => "throw")), () => NOW);
    expect(down.ok).toBe(false);
    const up = await riversNow(nwpsFetchers(everyGauge()), () => NOW);
    expect(up.ok && up.rivers).toHaveLength(4);
  });

  it("keeps an answer missing a river only briefly", async () => {
    const t0 = 1_800_000_000_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(t0);
    const calls: string[] = [];
    const partial = nwpsFetchers(
      everyGauge((lid) => (lid === "VCKM6" ? "throw" : allRivers(lid))),
      calls,
    );
    const a = await riversNow(partial, () => NOW);
    expect(a.ok && a.rivers).toHaveLength(3);
    const n = calls.length;
    clock.mockReturnValue(t0 + RIVERS_PARTIAL_TTL_MS - 1000);
    await riversNow(partial, () => NOW);
    expect(calls.length).toBe(n);
    // Past the short window, Vicksburg is back and gets its row again.
    clock.mockReturnValue(t0 + RIVERS_PARTIAL_TTL_MS + 1000);
    const b = await riversNow(nwpsFetchers(everyGauge()), () => NOW);
    expect(b.ok && b.rivers).toHaveLength(4);
  });
});

/* ------------------------------------------------------------------ */

describe("GET /api/rivers", () => {
  const get = (ip: string) =>
    GET(
      new NextRequest("http://localhost/api/rivers", {
        headers: { "x-real-ip": ip },
      }),
    );

  it("works offline in CRESTWATCH_TEST mode, from the recorded fixtures", async () => {
    vi.stubEnv("CRESTWATCH_TEST", "1");
    const fetchSpy = vi.fn(() => {
      throw new Error("network is off");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await get("10.9.0.1");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      checkedAt: string;
      rivers: Array<{ lid: string; name: string; stageFt: number }>;
    };
    expect(json.ok).toBe(true);
    expect(Number.isFinite(Date.parse(json.checkedAt))).toBe(true);
    expect(json.rivers.map((r) => r.lid)).toEqual(RIVER_GAUGES.map((g) => g.lid));
    expect(json.rivers.map((r) => r.name)).toEqual(RIVER_GAUGES.map((g) => g.name));
    expect(json.rivers.find((r) => r.lid === "JACM6")?.stageFt).toBe(3.21);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("says ok:false with a 502 when every river fails, and doesn't keep it", async () => {
    holder.fetchers = nwpsFetchers(everyGauge(() => "throw"));
    const res = await get("10.9.0.2");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "UPSTREAM" });
    holder.fetchers = nwpsFetchers(everyGauge());
    const again = await get("10.9.0.2");
    expect(again.status).toBe(200);
    expect(((await again.json()) as { ok: boolean }).ok).toBe(true);
  });

  it("rate-limits one runaway client, in a bucket of its own", async () => {
    holder.fetchers = nwpsFetchers(everyGauge());
    let last = 200;
    for (let i = 0; i < RATE_LIMIT_PER_HOUR + 5; i++) {
      last = (await get("10.9.0.3")).status;
    }
    expect(last).toBe(429);
    const limited = await get("10.9.0.3");
    expect(await limited.json()).toEqual({ ok: false, error: "RATE_LIMITED" });
    // Another visitor is unaffected.
    expect((await get("10.9.0.4")).status).toBe(200);
    // And the home page strip never used up this visitor's lookups and checks.
    expect(rateLimitOk("10.9.0.3")).toBe(true);
  });
});
