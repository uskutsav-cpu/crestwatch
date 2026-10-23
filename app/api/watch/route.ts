/**
 * POST /api/watch — pins → verdicts. Stateless: the pins arrive with the
 * request (from the visitor's localStorage) and are never stored.
 * Body: { "pins": [{ id, name, matchedAddress, lat, lon, elevationFt }] }
 */

import { NextRequest } from "next/server";
import { MAX_PINS } from "@/lib/config";
import { isPin } from "@/lib/pins";
import { watchPins } from "@/lib/watch-service";
import { routeFetchers } from "@/lib/test-fetchers";
import { clientIp, rateLimitOk } from "@/lib/rate-limit";

// Worst case for 5 pins is now about 25 s: each gauge's USGS calls can
// wait out a slow legacy source before the new API answers. Leave room.
export const maxDuration = 60;

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
  const pins = rawPins.filter(isPin).slice(0, MAX_PINS);
  if (pins.length === 0) {
    return Response.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  try {
    const watches = await watchPins(pins, routeFetchers());
    return Response.json({ ok: true, now: new Date().toISOString(), watches });
  } catch {
    return Response.json({ ok: false, error: "UPSTREAM" }, { status: 502 });
  }
}
