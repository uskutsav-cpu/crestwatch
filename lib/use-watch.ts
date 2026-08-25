"use client";

/**
 * Client hook: pins from localStorage → POST /api/watch → verdicts,
 * auto-refreshed every 15 minutes (the observed-data cadence).
 */

import { useCallback, useEffect, useState } from "react";
import { loadPins } from "@/lib/pin-store";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";

const REFRESH_MS = 15 * 60 * 1000;

export interface WatchState {
  pins: Pin[];
  watches: PinWatch[];
  now: string | null;
  updatedAt: number | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

export function useWatches(): WatchState {
  const [pins, setPins] = useState<Pin[]>([]);
  const [watches, setWatches] = useState<PinWatch[]>([]);
  const [now, setNow] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    const current = loadPins();
    setPins(current);
    if (current.length === 0) {
      setWatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
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
        if (json.ok && json.watches) {
          setWatches(json.watches);
          setNow(json.now ?? null);
          setUpdatedAt(Date.now());
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { pins, watches, now, updatedAt, loading, error, refresh };
}
