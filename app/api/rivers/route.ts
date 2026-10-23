/**
 * GET /api/rivers: the district's main rivers right now, for the home
 * page strip (lib/rivers.ts). NWPS only, cached 15 minutes; a failure is
 * never cached. Answers { ok: true, checkedAt, rivers } or { ok: false }.
 */

import { NextRequest } from "next/server";
import { riversNow } from "@/lib/rivers";
import { routeFetchers } from "@/lib/test-fetchers";
import { clientIp, rateLimitOk } from "@/lib/rate-limit";

// 8 NWPS calls run side by side under the 10 s fetch timeout.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Same limiter as /api/watch, in its own bucket: every home page visit
  // asks for this, and that must not eat the budget a family needs for
  // address lookups and river checks.
  if (!rateLimitOk(`rivers|${clientIp(request.headers)}`)) {
    return Response.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const answer = await riversNow(routeFetchers());
    return Response.json(answer, { status: answer.ok ? 200 : 502 });
  } catch {
    return Response.json({ ok: false, error: "UPSTREAM" }, { status: 502 });
  }
}
