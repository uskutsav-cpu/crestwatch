import { describe, expect, it } from "vitest";
import { decodeWatchLink, encodeWatchLink } from "@/lib/watch-link";
import type { Pin } from "@/lib/pins";

const pin: Pin = {
  id: "abc",
  name: "Grandma",
  matchedAddress: "211 E BROADWAY ST, YAZOO CITY, MS",
  lat: 32.846783396348,
  lon: -90.412396914911,
  elevationFt: 124.32014933,
};

describe("watch link (T14 stretch)", () => {
  it("round-trips pins through the URL param", () => {
    const encoded = encodeWatchLink([pin]);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe, no padding
    const decoded = decodeWatchLink(encoded)!;
    expect(decoded).toHaveLength(1);
    expect(decoded[0].name).toBe("Grandma");
    expect(decoded[0].lat).toBeCloseTo(pin.lat, 4);
    expect(decoded[0].lon).toBeCloseTo(pin.lon, 4);
    expect(decoded[0].elevationFt).toBeCloseTo(124.3, 1);
  });

  it("caps at MAX_PINS and survives unicode names", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...pin,
      id: String(i),
      name: `Café №${i}`,
    }));
    const decoded = decodeWatchLink(encodeWatchLink(many))!;
    expect(decoded).toHaveLength(5);
    expect(decoded[0].name).toBe("Café №0");
  });

  it("rejects garbage, wrong shapes, and out-of-range values", () => {
    expect(decodeWatchLink("!!!not-base64!!!")).toBeNull();
    expect(decodeWatchLink("aGVsbG8")).toBeNull(); // "hello"
    const bad = encodeWatchLink([pin]).slice(0, 6);
    expect(decodeWatchLink(bad)).toBeNull();
    // Hand-forged wire with absurd elevation
    const forged = Buffer.from(
      JSON.stringify([["x", "addr", 32, -90, 99999]]),
      "utf8",
    )
      .toString("base64")
      .replace(/=+$/, "");
    expect(decodeWatchLink(forged)).toBeNull();
  });
});
