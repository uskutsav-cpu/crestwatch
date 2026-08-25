/**
 * POST /api/replay — historical daily water-surface elevations for one of
 * the configured events (D7). Static data, cached a day.
 * Body: { "eventId": "backwater2019" }
 */

import { NextRequest } from "next/server";
import { REPLAY_EVENTS } from "@/lib/config";
import { parseDvSeries, toElevationSeries, usgsDvUrl } from "@/lib/replay";
import { cached } from "@/lib/cache";
import { routeFetchers } from "@/lib/test-fetchers";
import { clientIp, rateLimitOk } from "@/lib/rate-limit";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!rateLimitOk(clientIp(request.headers))) {
    return Response.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }
  let body: { eventId?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return Response.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  const event = REPLAY_EVENTS.find((e) => e.id === body.eventId);
  if (!event) {
    return Response.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  try {
    const days = await cached(`replay:${event.id}`, DAY_MS, async () => {
      const raw = await routeFetchers().json(
        usgsDvUrl(event.usgsSite, event.startDT, event.endDT),
      );
      return toElevationSeries(parseDvSeries(raw), event);
    });
    return Response.json({ ok: true, event: event.id, days });
  } catch {
    return Response.json({ ok: false, error: "UPSTREAM" }, { status: 502 });
  }
}
