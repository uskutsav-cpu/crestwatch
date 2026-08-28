import { describe, expect, it } from "vitest";
import { geocodePlace, placeSearchUrl, splitStateHint } from "@/lib/geo";
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
