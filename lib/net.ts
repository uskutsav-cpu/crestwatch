/**
 * Shared fetch helper for all federal APIs. Sends a descriptive
 * User-Agent (api.weather.gov requires one), enforces a timeout, and
 * returns parsed JSON or throws. Server-side only.
 */

import { FETCH_USER_AGENT } from "@/lib/config";

export type FetchJson = (url: string) => Promise<unknown>;
export type FetchText = (url: string) => Promise<string>;

export async function fetchText(
  url: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<string> {
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
  }
}

export async function fetchJson(
  url: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<unknown> {
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
  }
}
