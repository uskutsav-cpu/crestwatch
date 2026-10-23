/**
 * POST /api/replay — historical daily water-surface elevations for one of
 * the configured events (D7). Body: { "eventId": "backwater2019" }
 *
 * No network: these floods are over, so their USGS daily means ship with
 * the app in lib/replay-data (static imports, so the bundler packs them).
 * Checked Oct 2026 against the USGS Water Data daily API: same values.
 */

import { NextRequest } from "next/server";
import { REPLAY_EVENTS } from "@/lib/config";
import { parseDvSeries, toElevationSeries, type ReplayDay } from "@/lib/replay";
import { clientIp, rateLimitOk } from "@/lib/rate-limit";
import backwater2019 from "@/lib/replay-data/dv_backwater2019.json";
import pearl2020 from "@/lib/replay-data/dv_pearl2020.json";
import pearl2022 from "@/lib/replay-data/dv_pearl2022.json";

/**
 * Recorded USGS daily-value responses, keyed by REPLAY_EVENTS id. Not
 * exported: a route file may only export handlers and route config.
 */
const RECORDED: Readonly<Record<string, unknown>> = {
  backwater2019,
  pearl2020,
  pearl2022,
};

const series = new Map<string, ReplayDay[]>();

function recordedDays(eventId: string): ReplayDay[] | null {
  const hit = series.get(eventId);
  if (hit) return hit;
  const event = REPLAY_EVENTS.find((e) => e.id === eventId);
  const raw = RECORDED[eventId];
  if (!event || raw === undefined) return null;
  const days = toElevationSeries(parseDvSeries(raw), event);
  if (days.length === 0) return null;
  series.set(eventId, days);
  return days;
}

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
  const days = recordedDays(event.id);
  if (!days) {
    // An event in config with no recorded series is a build mistake.
    return Response.json({ ok: false, error: "NO_DATA" }, { status: 500 });
  }
  return Response.json({ ok: true, event: event.id, days });
}
