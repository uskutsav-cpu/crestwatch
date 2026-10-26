/**
 * Shared fetch helper for all federal APIs. Sends a descriptive
 * User-Agent (api.weather.gov requires one), enforces a timeout, and
 * returns parsed JSON or throws. Server-side only.
 */

import { upstreamScope } from "@/lib/upstream-scope";
import { FETCH_USER_AGENT } from "@/lib/config";

/**
 * Per-instance upstream concurrency gate. One /api/watch request can fan
 * out to ~26 federal fetches per pin; this keeps a burst of requests from
 * hammering the upstreams (and this instance) all at once.
 */
const MAX_CONCURRENT_UPSTREAM = 8;


async function acquire(): Promise<void> {
  const scope = upstreamScope();
  if (scope.inFlight < MAX_CONCURRENT_UPSTREAM) {
    scope.inFlight++;
    return;
  }
  // Wait for a permit to be handed over. inFlight is deliberately NOT
  // incremented on wake: the releaser transfers its own permit to us.
  await new Promise<void>((resolve) => scope.waiters.push(resolve));
}

function release(): void {
  const scope = upstreamScope();
  const next = scope.waiters.shift();
  if (next) {
    // Direct handoff — inFlight must never dip while a waiter exists, or
    // a caller arriving in that window barges past the cap.
    next();
    return;
  }
  scope.inFlight--;
}

export interface FetchOpts {
  timeoutMs?: number;
}

export type FetchJson = (
  url: string,
  opts?: FetchOpts,
) => Promise<unknown>;
export type FetchText = (url: string, opts?: FetchOpts) => Promise<string>;

export const DEFAULT_TIMEOUT_MS = 10_000;

/** The only host that ever receives USGS_API_KEY. */
const USGS_KEY_HOST = "api.waterdata.usgs.gov";

/**
 * Optional free api.data.gov key for the USGS Water Data API. Nothing
 * requires it: unset means keyless, exactly as before. When set it goes
 * ONLY to https://api.waterdata.usgs.gov, as the x-api-key header, and is
 * never logged or put in an error message.
 */
function usgsKeyFor(url: string): string | null {
  const key = process.env.USGS_API_KEY?.trim();
  if (!key) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  return u.protocol === "https:" && u.hostname === USGS_KEY_HOST ? key : null;
}

/** Headers + redirect policy for one request. */
function requestInit(
  url: string,
  base: Record<string, string>,
): { headers: Record<string, string>; redirect?: RequestRedirect } {
  const key = usgsKeyFor(url);
  if (!key) return { headers: base };
  // fetch keeps custom headers across a cross-host redirect, so a request
  // that carries the key must not follow one (an outage redirect would
  // otherwise hand the key to the blog host). A 3xx then fails like any
  // other non-OK answer and the caller falls back to its other source.
  return { headers: { ...base, "x-api-key": key }, redirect: "manual" };
}

export async function fetchText(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOpts = {},
): Promise<string> {
  await acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...requestInit(url, { "user-agent": FETCH_USER_AGENT }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`upstream ${res.status} for ${new URL(url).host}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
    release();
  }
}

export async function fetchJson(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOpts = {},
): Promise<unknown> {
  await acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...requestInit(url, {
        "user-agent": FETCH_USER_AGENT,
        accept: "application/json,application/geo+json",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`upstream ${res.status} for ${new URL(url).host}`);
    }
    // An HTML outage page (USGS redirects to its blog) throws here, so
    // callers see a failure, not a half-parsed body.
    return await res.json();
  } finally {
    clearTimeout(timer);
    release();
  }
}
