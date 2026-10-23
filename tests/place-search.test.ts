import { describe, expect, it } from "vitest";
import {
  extractLocality,
  geocodePlace,
  looksLikeStreetAddress,
  placeSearchUrl,
  splitStateHint,
} from "@/lib/geo";
import { lookupAddress } from "@/lib/watch-service";
import { clearCache } from "@/lib/cache";
import { testFetchers } from "@/lib/test-fetchers";
import { decodeWatchLink, encodeWatchLink } from "@/lib/watch-link";

const place = (results: unknown[]) => async () => ({ results });

describe("splitStateHint", () => {
  it("pulls a two-letter state off the end", () => {
    expect(splitStateHint("Vicksburg, MS")).toEqual({
      place: "Vicksburg",
      state: "Mississippi",
    });
    expect(splitStateHint("Rolling Fork MS")).toEqual({
      place: "Rolling Fork",
      state: "Mississippi",
    });
  });

  it("pulls a full state name off the end", () => {
    expect(splitStateHint("Yazoo City, Mississippi")).toEqual({
      place: "Yazoo City",
      state: "Mississippi",
    });
  });

  it("leaves a bare place or ZIP alone", () => {
    expect(splitStateHint("Yazoo City")).toEqual({
      place: "Yazoo City",
      state: null,
    });
    expect(splitStateHint("39180")).toEqual({ place: "39180", state: null });
  });

  it("does not mistake a short word for a state code", () => {
    // "Ave" is not a state; the whole string stays the place.
    expect(splitStateHint("Elm Ave").state).toBeNull();
  });
});

describe("geocodePlace", () => {
  const results = [
    { name: "Vicksburg", admin1: "Mississippi", country_code: "US", latitude: 32.35, longitude: -90.88 },
    { name: "Vicksburg", admin1: "Michigan", country_code: "US", latitude: 42.12, longitude: -85.53 },
  ];

  it("uses the named state instead of the first hit", async () => {
    const r = await geocodePlace("Vicksburg, MS", place(results));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.point.lat).toBeCloseTo(32.35, 2);
    expect(r.point.matchedAddress).toBe("Vicksburg, Mississippi");
    expect(r.point.precision).toBe("place");
  });

  it("falls back to the first US hit when no state is named", async () => {
    const r = await geocodePlace("Vicksburg", place(results));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.point.lat).toBeCloseTo(32.35, 2);
  });

  it("refuses to jump states when the named state has no match", async () => {
    // "Vicksburg, TX" must not silently return Mississippi.
    const r = await geocodePlace("Vicksburg, TX", place(results));
    expect(r).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("NOT_FOUND on an empty result set", async () => {
    const r = await geocodePlace("Nowheresville, MS", place([]));
    expect(r).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("UPSTREAM when the service is unreachable", async () => {
    const r = await geocodePlace("Vicksburg, MS", async () => {
      throw new Error("down");
    });
    expect(r).toEqual({ ok: false, error: "UPSTREAM" });
  });

  it("url-encodes the query", () => {
    expect(placeSearchUrl("Rolling Fork")).toContain("name=Rolling+Fork");
  });
});

describe("lookupAddress falls back from street to place", () => {
  it("a town name resolves and is flagged approximate", async () => {
    clearCache();
    const r = await lookupAddress("Vicksburg, MS", testFetchers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.precision).toBe("place");
    expect(r.matchedAddress).toContain("Vicksburg");
  });

  it("an exact street address still wins and stays address-precision", async () => {
    clearCache();
    const r = await lookupAddress("1400 Washington St, Vicksburg, MS", testFetchers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.precision).toBe("address");
  });

  it("still NOT_FOUND when neither tier matches", async () => {
    clearCache();
    const r = await lookupAddress("zzz not a real place xx", testFetchers);
    expect(r).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("watch links carry the approximate flag", () => {
  const base = {
    id: "x",
    name: "Home",
    matchedAddress: "Vicksburg, Mississippi",
    lat: 32.35,
    lon: -90.88,
    elevationFt: 100,
  };

  it("round-trips an approximate pin", () => {
    const decoded = decodeWatchLink(
      encodeWatchLink([{ ...base, approximate: true }]),
    )!;
    expect(decoded[0].approximate).toBe(true);
  });

  it("round-trips an exact pin without bloating the link", () => {
    const decoded = decodeWatchLink(encodeWatchLink([base]))!;
    expect(decoded[0].approximate).toBe(false);
  });

  it("rejects a forged flag value", () => {
    const forged = Buffer.from(
      JSON.stringify([["Home", "addr", 32, -90, 100, 7]]),
      "utf8",
    ).toString("base64").replace(/=+$/, "");
    expect(decodeWatchLink(forged)).toBeNull();
  });
});

const noSleep = async () => {};

describe("EPQS slowness must not look like a bad address", () => {
  it("retries after a failure", async () => {
    const { groundElevationFt } = await import("@/lib/geo");
    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls === 1) throw new Error("timeout");
      return { value: 241.58 };
    };
    const elev = await groundElevationFt(32.35, -90.88, flaky, {
      sleep: noSleep,
    });
    expect(calls).toBe(2);
    expect(elev).toBeCloseTo(241.58, 2);
  });

  it("rides out a burst of instant 500s (seen live, Oct 2026)", async () => {
    const { groundElevationFt } = await import("@/lib/geo");
    let calls = 0;
    const pauses: number[] = [];
    const elev = await groundElevationFt(
      32.9,
      -90.87,
      async () => {
        calls++;
        if (calls < 3) throw new Error("upstream 500 for epqs.nationalmap.gov");
        return { value: 105.56 };
      },
      { sleep: async (ms) => void pauses.push(ms) },
    );
    expect(calls).toBe(3);
    expect(elev).toBeCloseTo(105.56, 2);
    expect(pauses.every((ms) => ms > 0 && ms <= 3_000)).toBe(true);
  });

  it("never starts an attempt that would blow the time budget", async () => {
    const { groundElevationFt, EPQS_BUDGET_MS } = await import("@/lib/geo");
    let t = 0;
    const timeouts: number[] = [];
    const elev = await groundElevationFt(
      32.35,
      -90.88,
      async (_u, opts) => {
        timeouts.push(opts?.timeoutMs ?? 0);
        t += opts?.timeoutMs ?? 0; // every attempt runs to its timeout
        throw new Error("timed out");
      },
      { now: () => t, sleep: async (ms) => void (t += ms) },
    );
    expect(elev).toBeNull();
    expect(t).toBeLessThanOrEqual(EPQS_BUDGET_MS);
    expect(timeouts.length).toBeGreaterThanOrEqual(2);
  });

  it("asks for a long timeout, since EPQS routinely takes seconds", async () => {
    const { groundElevationFt } = await import("@/lib/geo");
    let seen: number | undefined;
    await groundElevationFt(32.35, -90.88, async (_u, opts) => {
      seen = opts?.timeoutMs;
      return { value: 100 };
    });
    expect(seen).toBeGreaterThanOrEqual(20_000);
  });

  it("still gives up after a few tries rather than hanging", async () => {
    const { groundElevationFt, EPQS_MAX_ATTEMPTS } = await import("@/lib/geo");
    let calls = 0;
    const elev = await groundElevationFt(
      32.35,
      -90.88,
      async () => {
        calls++;
        throw new Error("down");
      },
      { sleep: noSleep },
    );
    expect(calls).toBe(EPQS_MAX_ATTEMPTS);
    expect(elev).toBeNull();
  });
});

describe("extractLocality: find the town inside a street address", () => {
  it("takes the town from a comma-separated address", () => {
    expect(extractLocality("1234 Main Street, Yazoo City, MS")).toBe(
      "Yazoo City",
    );
    expect(extractLocality("1 Government St, Vicksburg MS")).toBe("Vicksburg");
  });

  it("handles an address with no commas", () => {
    expect(extractLocality("1400 Washington St Vicksburg MS")).toBe(
      "Vicksburg",
    );
  });

  it("passes a bare town through", () => {
    expect(extractLocality("Vicksburg, MS")).toBe("Vicksburg");
  });

  it("refuses to guess from a number with no town", () => {
    expect(extractLocality("1400 Washington St")).toBeNull();
    expect(extractLocality("123 Elm")).toBeNull();
  });
});

describe("looksLikeStreetAddress gates the street tier", () => {
  it("accepts real street addresses", () => {
    for (const q of [
      "1400 Washington St, Vicksburg, MS",
      "1 Government St, Vicksburg MS",
      "100 E Capitol St",
    ]) {
      expect(looksLikeStreetAddress(q)).toBe(true);
    }
  });

  it("rejects towns and ZIPs, so they can never be sold as house-level", () => {
    for (const q of ["Vicksburg, MS", "39180", "Yazoo City", "Rolling Fork MS"]) {
      expect(looksLikeStreetAddress(q)).toBe(false);
    }
  });
});

describe("three-tier lookup chain", () => {
  it("an unlisted house number degrades to the town, clearly flagged", async () => {
    clearCache();
    const r = await lookupAddress("1 Government St, Vicksburg MS", testFetchers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.precision).toBe("place");
    expect(r.matchedAddress).toContain("Vicksburg");
  });

  it("a street the Census file lacks is still found at street level", async () => {
    clearCache();
    const r = await lookupAddress("1234 Main Street, Yazoo City, MS", testFetchers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.precision).toBe("address");
    expect(r.matchedAddress).toContain("Main Street");
  });

  it("a town never comes back wearing house-level precision", async () => {
    clearCache();
    const r = await lookupAddress("Vicksburg, MS", testFetchers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.precision).toBe("place");
  });
});
