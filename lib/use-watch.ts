"use client";

/**
 * Client hook: pins from localStorage → POST /api/watch → verdicts,
 * auto-refreshed every 15 minutes (the observed-data cadence), and again
 * as soon as the device comes back online.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPins } from "@/lib/pin-store";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";

const REFRESH_MS = 15 * 60 * 1000;

export interface WatchState {
  pins: Pin[];
  watches: PinWatch[];
  now: string | null;
  /** When the last successful answer arrived (ms). Kept through failures. */
  updatedAt: number | null;
  loading: boolean;
  /** The latest check failed. Older `watches` (if any) are still there. */
  error: boolean;
  refresh: () => void;
}

/**
 * `overridePins` (a decoded Watch Link) replaces localStorage — the
 * recipient sees the sender's places without saving anything. It must be
 * referentially stable (memoize it, or use a module-level constant):
 * a fresh array each render would refetch forever.
 */
export function useWatches(overridePins: Pin[] | null = null): WatchState {
  const [pins, setPins] = useState<Pin[]>([]);
  const [watches, setWatches] = useState<PinWatch[]>([]);
  const [now, setNow] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Only the newest request may write state; a slow older answer that
  // lands after a newer one must not overwrite it.
  const latest = useRef(0);

  const refresh = useCallback(() => {
    const current = overridePins ?? loadPins();
    const req = ++latest.current;
    setPins(current);
    if (current.length === 0) {
      setWatches([]);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      let ok = false;
      let body: { now?: string; watches?: PinWatch[] } = {};
      try {
        const res = await fetch("/api/watch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pins: current }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          now?: string;
          watches?: PinWatch[];
        };
        ok = Boolean(json.ok && json.watches);
        body = json;
      } catch {
        ok = false;
      }
      if (req !== latest.current) return;
      if (ok && body.watches) {
        setWatches(body.watches);
        setNow(body.now ?? null);
        setUpdatedAt(Date.now());
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    })();
  }, [overridePins]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    // The network coming back is the moment a failed check can succeed.
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  return { pins, watches, now, updatedAt, loading, error, refresh };
}
