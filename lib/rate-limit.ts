/**
 * Per-IP rate limit, 120 requests per rolling hour (Appendix A4).
 * In-memory per serverless instance — best-effort, which is fine: the
 * point is stopping one runaway client, not building a fortress.
 */

import { RATE_LIMIT_PER_HOUR } from "@/lib/config";

const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

const MAX_TRACKED_IPS = 10_000;

export function rateLimitOk(ip: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_PER_HOUR) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED_IPS) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= cutoff)) hits.delete(k);
    }
    // Hard cap even against all-fresh unique keys: evict oldest-inserted.
    while (hits.size > MAX_TRACKED_IPS) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
  }
  return true;
}

/**
 * The platform-set header wins. The FIRST x-forwarded-for entry is
 * client-supplied (trivially spoofable to rotate rate-limit buckets);
 * x-real-ip is set by Vercel, and the LAST forwarded entry was appended
 * by the trusted edge.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "local";
}
