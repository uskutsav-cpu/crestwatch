import { beforeEach, describe, expect, it } from "vitest";
import { clearCache } from "@/lib/cache";
import { lookupAddress, watchPins } from "@/lib/watch-service";
import { testFetchers } from "@/lib/test-fetchers";
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

describe("rate limit", () => {
  it("allows the configured budget then blocks", () => {
    const ip = `test-${Math.random()}`;
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      expect(rateLimitOk(ip)).toBe(true);
    }
    expect(rateLimitOk(ip)).toBe(false);
  });
});
