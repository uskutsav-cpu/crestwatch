/**
 * POST /api/lookup — address → pin scaffold (coords, ground elevation,
 * nearest forecast gauge). The client never talks to federal APIs.
 * Body: { "address": "123 Main St, Vicksburg MS" }
 */

import { NextRequest } from "next/server";
import { lookupAddress } from "@/lib/watch-service";
import { routeFetchers } from "@/lib/test-fetchers";
import { clientIp, rateLimitOk } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!rateLimitOk(clientIp(request.headers))) {
    return Response.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }
  let body: { address?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return Response.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (address.length < 4 || address.length > 200) {
    return Response.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  const result = await lookupAddress(address, routeFetchers());
  return Response.json(result, { status: result.ok ? 200 : 200 });
}
