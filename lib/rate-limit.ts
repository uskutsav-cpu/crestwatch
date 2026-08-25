/**
 * Per-IP rate limit, 120 requests per rolling hour (Appendix A4).
 * In-memory per serverless instance — best-effort, which is fine: the
 * point is stopping one runaway client, not building a fortress.
 */

import { RATE_LIMIT_PER_HOUR } from "@/lib/config";

const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export function rateLimitOk(ip: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_PER_HOUR) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= cutoff)) hits.delete(k);
    }
  }
  return true;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "local"
  );
}
