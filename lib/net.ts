/**
 * Shared fetch helper for all federal APIs. Sends a descriptive
 * User-Agent (api.weather.gov requires one), enforces a timeout, and
 * returns parsed JSON or throws. Server-side only.
 */

import { FETCH_USER_AGENT } from "@/lib/config";

/**
 * Per-instance upstream concurrency gate. One /api/watch request can fan
 * out to ~26 federal fetches per pin; this keeps a burst of requests from
 * hammering the upstreams (and this instance) all at once.
 */
const MAX_CONCURRENT_UPSTREAM = 8;
let inFlight = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (inFlight < MAX_CONCURRENT_UPSTREAM) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight++;
}

function release(): void {
  inFlight--;
  waiters.shift()?.();
}

export type FetchJson = (url: string) => Promise<unknown>;
export type FetchText = (url: string) => Promise<string>;

export async function fetchText(
  url: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<string> {
  await acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": FETCH_USER_AGENT },
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
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<unknown> {
  await acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": FETCH_USER_AGENT,
        accept: "application/json,application/geo+json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`upstream ${res.status} for ${new URL(url).host}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
    release();
  }
}
