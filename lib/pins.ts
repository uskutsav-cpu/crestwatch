/**
 * Pin types shared by client and server. Pins persist ONLY in the
 * visitor's localStorage — the watch API receives them per-request and
 * remembers nothing.
 */

export interface Pin {
  id: string;
  name: string;
  matchedAddress: string;
  lat: number;
  lon: number;
  elevationFt: number;
  /**
   * True when this pin came from a town/ZIP match, or from a point on a
   * street whose house wasn't found, rather than a house-level address —
   * the elevation is the middle of a town or street, not this visitor's
   * ground. Every screen that shows a verdict must say so.
   */
  approximate?: boolean;
}

/**
 * Strip control and bidi-override characters — a hostile watch-link name
 * must not be able to visually reorder a verdict sentence or share card.
 */
const CONTROL_AND_BIDI = new RegExp(
  "[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069]",
  "g",
);

export function sanitizeName(raw: string): string {
  return raw.replace(CONTROL_AND_BIDI, "").trim();
}

/** Shared shape guard — used by the API route, pin storage, and links. */
export function isPin(p: unknown): p is Pin {
  if (typeof p !== "object" || p === null) return false;
  const pin = p as Record<string, unknown>;
  return (
    typeof pin.id === "string" &&
    pin.id.length > 0 &&
    pin.id.length <= 40 &&
    typeof pin.name === "string" &&
    pin.name.length > 0 &&
    pin.name.length <= 80 &&
    typeof pin.matchedAddress === "string" &&
    pin.matchedAddress.length <= 200 &&
    typeof pin.lat === "number" &&
    Number.isFinite(pin.lat) &&
    Math.abs(pin.lat) <= 90 &&
    typeof pin.lon === "number" &&
    Number.isFinite(pin.lon) &&
    Math.abs(pin.lon) <= 180 &&
    typeof pin.elevationFt === "number" &&
    Number.isFinite(pin.elevationFt) &&
    pin.elevationFt > -400 &&
    pin.elevationFt < 30_000 &&
    (pin.approximate === undefined || typeof pin.approximate === "boolean")
  );
}
