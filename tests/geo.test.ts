import { describe, expect, it } from "vitest";
import {
  censusUrl,
  epqsUrl,
  geocodeAddress,
  groundElevationFt,
} from "@/lib/geo";
import fixtures from "./fixtures/geo_fixtures.json";

/** Fixture-backed fetch: serves the recorded response for each URL. */
function fixtureFetch(map: Record<string, unknown>) {
  return async (url: string): Promise<unknown> => {
    for (const [key, value] of Object.entries(map)) {
      if (url === key) return value;
    }
    throw new Error(`no fixture for ${url}`);
  };
}

describe("geo pipeline — 5 known addresses (recorded fixtures)", () => {
  for (const a of fixtures.addresses) {
    it(`resolves ${a.input} → (${a.expect.lat.toFixed(3)}, ${a.expect.lon.toFixed(3)}) @ ~${a.expect.elevationFt} ft`, async () => {
      const geo = await geocodeAddress(
        a.input,
        fixtureFetch({ [censusUrl(a.input)]: a.census }),
      );
      expect(geo.ok).toBe(true);
      if (!geo.ok) return;
      expect(geo.point.lat).toBeCloseTo(a.expect.lat, 6);
      expect(geo.point.lon).toBeCloseTo(a.expect.lon, 6);

      const elev = await groundElevationFt(
        geo.point.lat,
        geo.point.lon,
        fixtureFetch({ [epqsUrl(geo.point.lat, geo.point.lon)]: a.epqs }),
      );
      expect(elev).not.toBeNull();
      expect(Math.abs((elev as number) - a.expect.elevationFt)).toBeLessThan(2);
    });
  }

  it("returns NOT_FOUND for an unmatchable address", async () => {
    const input = fixtures.noMatch.input;
    const geo = await geocodeAddress(
      input,
      fixtureFetch({ [censusUrl(input)]: fixtures.noMatch.census }),
    );
    expect(geo).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("returns UPSTREAM when the geocoder is unreachable", async () => {
    const geo = await geocodeAddress("123 Main St", async () => {
      throw new Error("network down");
    });
    expect(geo).toEqual({ ok: false, error: "UPSTREAM" });
  });

  it("returns null elevation for EPQS no-data sentinels", async () => {
    const elev = await groundElevationFt(
      30,
      -90,
      async () => fixtures.epqsNoData,
    );
    expect(elev).toBeNull();
  });

  it("returns null elevation when EPQS is unreachable", async () => {
    const elev = await groundElevationFt(
      30,
      -90,
      async () => {
        throw new Error("timeout");
      },
      { sleep: async () => {} },
    );
    expect(elev).toBeNull();
  });
});
