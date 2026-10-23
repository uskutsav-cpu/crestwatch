import { beforeEach, describe, expect, it } from "vitest";
import { clearCache } from "@/lib/cache";
import { lookupAddress, watchPins } from "@/lib/watch-service";
import { testFetchers } from "@/lib/test-fetchers";
import { haversineMi, type Fetchers } from "@/lib/gauges";
import { rateLimitOk } from "@/lib/rate-limit";
import { RATE_LIMIT_PER_HOUR } from "@/lib/config";

// Fixture recording time — staleness math in these tests keys off it.
const NOW = "2026-08-25T05:00:00Z";

beforeEach(() => clearCache());

describe("lookupAddress (fixture-routed)", () => {
  it("FULL-tier city: Jackson resolves with the Pearl gauge", async () => {
    const r = await lookupAddress("100 E Capitol St, Jackson, MS", testFetchers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.elevationFt).toBeCloseTo(275.5, 0);
    expect(r.gauge?.lid).toBe("JACM6");
    expect(r.gauge?.distanceMi).toBeLessThan(3);
  });

  it("NOT_FOUND for gibberish", async () => {
    const r = await lookupAddress("zzz not a real place xx", testFetchers);
    expect(r).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("watchPins — the three tiers from real recorded data", () => {
  it("FULL: Jackson pin gets elevation math against the Pearl", async () => {
    const [w] = await watchPins(
      [
        {
          id: "p1",
          name: "Home",
          matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
          lat: 32.300441828077,
          lon: -90.188419699815,
          elevationFt: 275.5,
        },
      ],
      testFetchers,
      NOW,
    );
    expect(w.verdict.tier).toBe("FULL");
    if (w.verdict.tier !== "FULL") return;
    expect(w.verdict.band).toBe("UNLIKELY"); // ~39 ft of margin
    expect(w.verdict.marginFt).toBeGreaterThan(30);
    expect(w.gauge?.lid).toBe("JACM6");
    expect(w.gauge?.gaugeZeroFt).toBeCloseTo(233.39, 2);
  });

  it("CATEGORY: Yazoo City pin (gauge publishes no elevation)", async () => {
    const [w] = await watchPins(
      [
        {
          id: "p2",
          name: "Grandma",
          matchedAddress: "211 E BROADWAY ST, YAZOO CITY, MS",
          lat: 32.846783396348,
          lon: -90.412396914911,
          elevationFt: 124.3,
        },
      ],
      testFetchers,
      NOW,
    );
    expect(w.verdict.tier).toBe("CATEGORY");
    if (w.verdict.tier !== "CATEGORY") return;
    expect(w.gauge?.lid).toBe("YZOM6");
    expect(w.verdict.category).toBe("none"); // quiet river when recorded
    expect(w.verdict.aboveFloodFt).toBeLessThan(0);
  });

  it("ALERT-ONLY: Vicksburg pin has no forecast gauge within 25 mi", async () => {
    const [w] = await watchPins(
      [
        {
          id: "p3",
          name: "The farm road",
          matchedAddress: "1400 WASHINGTON ST, VICKSBURG, MS",
          lat: 32.349033641592,
          lon: -90.882368787159,
          elevationFt: 193.1,
        },
      ],
      testFetchers,
      NOW,
    );
    expect(w.verdict.tier).toBe("ALERT_ONLY");
    expect(w.gauge).toBeNull();
    expect(Array.isArray(w.alerts)).toBe(true);
  });

  it("watches multiple pins in one call", async () => {
    const watches = await watchPins(
      [
        {
          id: "a",
          name: "Home",
          matchedAddress: "JACKSON",
          lat: 32.3004,
          lon: -90.1884,
          elevationFt: 275.5,
        },
        {
          id: "b",
          name: "Road",
          matchedAddress: "VICKSBURG",
          lat: 32.349,
          lon: -90.8824,
          elevationFt: 193.1,
        },
      ],
      testFetchers,
      NOW,
    );
    expect(watches).toHaveLength(2);
    expect(watches[0].pinId).toBe("a");
    expect(watches[1].verdict.tier).toBe("ALERT_ONLY");
  });
});

/** testFetchers with the Census geocoder down (timeout / 5xx / HTML page). */
const censusDown: Fetchers = {
  json: async (url, opts) => {
    if (new URL(url).hostname === "geocoding.geo.census.gov") {
      throw new Error("upstream 503 for geocoding.geo.census.gov");
    }
    return testFetchers.json(url, opts);
  },
  text: testFetchers.text,
};

describe("#51: a Census outage falls through to the other tiers", () => {
  it("a street address still resolves via the town tier, flagged approximate", async () => {
    const r = await lookupAddress("1400 Washington St, Vicksburg, MS", censusDown);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.precision).toBe("place");
    expect(r.matchedAddress).toContain("Vicksburg");
  });

  it("the street tier answers when Census is down", async () => {
    const r = await lookupAddress("1234 Main Street, Yazoo City, MS", censusDown);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matchedAddress).toContain("Main Street");
  });

  it("every tier missing while Census was down is UPSTREAM, and is not cached", async () => {
    const q = "zzz not a real place xx";
    expect(await lookupAddress(q, censusDown)).toEqual({ ok: false, error: "UPSTREAM" });
    // Census is back: the outage wasn't pinned, so the real answer shows.
    expect(await lookupAddress(q, testFetchers)).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("any tier being down counts (the street fallback here)", async () => {
    const nominatimDown: Fetchers = {
      json: async (url, opts) => {
        if (new URL(url).hostname === "nominatim.openstreetmap.org") {
          throw new Error("upstream 429 for nominatim.openstreetmap.org");
        }
        return testFetchers.json(url, opts);
      },
      text: testFetchers.text,
    };
    expect(await lookupAddress("zzz not a real place xx", nominatimDown)).toEqual({
      ok: false,
      error: "UPSTREAM",
    });
  });
});

describe("#15: gauge distance is measured from each pin", () => {
  // JACM6 in the fixture NWPS list.
  const GAUGE = { lat: 32.28138, lon: -90.17888 };
  // Two pins in the same 0.01-degree cache cell ("32.30,-90.19"), at
  // different distances from the gauge.
  const near = { lat: 32.2952, lon: -90.1851 };
  const far = { lat: 32.3044, lon: -90.1946 };
  const pin = (id: string, p: { lat: number; lon: number }) => ({
    id,
    name: id,
    matchedAddress: id,
    lat: p.lat,
    lon: p.lon,
    elevationFt: 275.5,
  });

  it("the test pins really share a cache cell and really differ in distance", () => {
    const cell = (p: { lat: number; lon: number }) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
    expect(cell(near)).toBe(cell(far));
    const dNear = haversineMi(near.lat, near.lon, GAUGE.lat, GAUGE.lon);
    const dFar = haversineMi(far.lat, far.lon, GAUGE.lat, GAUGE.lon);
    expect(dFar - dNear).toBeGreaterThan(0.5);
  });

  it("watchPins: the second pin in a cell gets its own distance", async () => {
    const [a] = await watchPins([pin("near", near)], testFetchers, NOW);
    const [b] = await watchPins([pin("far", far)], testFetchers, NOW); // cache hit
    expect(a.gauge?.lid).toBe("JACM6");
    expect(b.gauge?.lid).toBe("JACM6");
    expect(a.gauge!.distanceMi).toBeCloseTo(haversineMi(near.lat, near.lon, GAUGE.lat, GAUGE.lon), 6);
    expect(b.gauge!.distanceMi).toBeCloseTo(haversineMi(far.lat, far.lon, GAUGE.lat, GAUGE.lon), 6);
    expect(b.gauge!.distanceMi).not.toBeCloseTo(a.gauge!.distanceMi, 2);
  });

  it("lookupAddress: a lookup after another pin filled the cell", async () => {
    // Fill the cell from a different pin first...
    await watchPins([pin("near", near)], testFetchers, NOW);
    // ...then look up the Jackson address, which lands in the same cell.
    const r = await lookupAddress("100 E Capitol St, Jackson, MS", testFetchers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(`${r.lat.toFixed(2)},${r.lon.toFixed(2)}`).toBe(
      `${near.lat.toFixed(2)},${near.lon.toFixed(2)}`,
    );
    expect(r.gauge?.distanceMi).toBeCloseTo(haversineMi(r.lat, r.lon, GAUGE.lat, GAUGE.lon), 6);
    expect(r.gauge?.distanceMi).not.toBeCloseTo(
      haversineMi(near.lat, near.lon, GAUGE.lat, GAUGE.lon),
      2,
    );
  });
});

describe("rate limit", () => {
  it("allows the configured budget then blocks", () => {
    const ip = `test-${Math.random()}`;
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      expect(rateLimitOk(ip)).toBe(true);
    }
    expect(rateLimitOk(ip)).toBe(false);
  });
});
