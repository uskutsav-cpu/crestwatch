/**
 * Watch Link (T14 stretch): pins encoded into a URL so a verdict page can
 * be texted to grandma — she opens it and sees the watch with zero setup.
 * Compact base64url JSON, validated hard on decode (it's untrusted input).
 */

import { MAX_PINS } from "@/lib/config";
import type { Pin } from "@/lib/pins";

/** Compact wire form: [name, matchedAddress, lat, lon, elevationFt] */
type WirePin = [string, string, number, number, number];

export function encodeWatchLink(pins: Pin[]): string {
  const wire: WirePin[] = pins
    .slice(0, MAX_PINS)
    .map((p) => [
      p.name.slice(0, 40),
      p.matchedAddress.slice(0, 120),
      Math.round(p.lat * 1e5) / 1e5,
      Math.round(p.lon * 1e5) / 1e5,
      Math.round(p.elevationFt * 10) / 10,
    ]);
  const json = JSON.stringify(wire);
  const b64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeWatchLink(param: string): Pin[] | null {
  if (!/^[A-Za-z0-9_-]{4,4000}$/.test(param)) return null;
  try {
    const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, "base64").toString("utf8");
    const wire = JSON.parse(json) as unknown;
    if (!Array.isArray(wire) || wire.length === 0 || wire.length > MAX_PINS) {
      return null;
    }
    const pins: Pin[] = [];
    for (let i = 0; i < wire.length; i++) {
      const w = wire[i] as unknown[];
      if (!Array.isArray(w) || w.length !== 5) return null;
      const [name, addr, lat, lon, elev] = w;
      if (
        typeof name !== "string" ||
        name.length === 0 ||
        name.length > 40 ||
        typeof addr !== "string" ||
        addr.length > 120 ||
        typeof lat !== "number" ||
        Math.abs(lat) > 90 ||
        typeof lon !== "number" ||
        Math.abs(lon) > 180 ||
        typeof elev !== "number" ||
        elev <= -400 ||
        elev >= 30_000
      ) {
        return null;
      }
      pins.push({
        id: `wl${i}`,
        name,
        matchedAddress: addr,
        lat,
        lon,
        elevationFt: elev,
      });
    }
    return pins;
  } catch {
    return null;
  }
}
