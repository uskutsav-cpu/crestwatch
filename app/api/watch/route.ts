/**
 * POST /api/watch — pins → verdicts. Stateless: the pins arrive with the
 * request (from the visitor's localStorage) and are never stored.
 * Body: { "pins": [{ id, name, matchedAddress, lat, lon, elevationFt }] }
 */

import { NextRequest } from "next/server";
import { MAX_PINS } from "@/lib/config";
import type { Pin } from "@/lib/pins";
import { watchPins } from "@/lib/watch-service";
import { routeFetchers } from "@/lib/test-fetchers";
import { clientIp, rateLimitOk } from "@/lib/rate-limit";

function isValidPin(p: unknown): p is Pin {
  if (typeof p !== "object" || p === null) return false;
  const pin = p as Record<string, unknown>;
  return (
    typeof pin.id === "string" &&
    pin.id.length > 0 &&
    pin.id.length <= 40 &&
    typeof pin.name === "string" &&
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
    pin.elevationFt < 30_000
  );
}

export async function POST(request: NextRequest) {
  if (!rateLimitOk(clientIp(request.headers))) {
    return Response.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }
  let body: { pins?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return Response.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  const rawPins = Array.isArray(body.pins) ? body.pins : [];
  const pins = rawPins.filter(isValidPin).slice(0, MAX_PINS);
  if (pins.length === 0) {
    return Response.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  const watches = await watchPins(pins, routeFetchers());
  return Response.json({ ok: true, now: new Date().toISOString(), watches });
}
