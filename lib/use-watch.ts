"use client";

/**
 * Client hook: pins from localStorage → POST /api/watch → verdicts,
 * auto-refreshed every 15 minutes (the observed-data cadence), and again
 * as soon as the device comes back online.
 *
 * When the signal drops before anything is on screen, the visitor's own
 * places fall back to the last good answer kept in this browser (see
 * lib/last-answer.ts), shown as an old answer, never as a fresh one. It
 * comes down the moment it turns 12 hours old or stops fitting the places.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPins } from "@/lib/pin-store";
import {
  LAST_ANSWER_MAX_AGE_MS,
  clearLastAnswer,
  lastAnswerTooOld,
  loadLastAnswer,
  pinsKeyFor,
  saveLastAnswer,
} from "@/lib/last-answer";
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
  /**
   * The watches on screen are the last answer saved in this browser, not
   * one from this visit. Always comes with error=true and updatedAt set to
   * when that answer arrived. useWatches always sets it; it is optional
   * only so hand-built states (tests) stay valid.
   */
  fromSaved?: boolean;
  refresh: () => void;
}

/** One successful /api/watch answer. */
export interface RiverAnswer {
  now: string | null;
  watches: PinWatch[];
}

/** Ask /api/watch about these pins. null when the check failed. Never throws. */
export async function fetchWatches(
  pins: Pin[],
  fetcher: typeof fetch = fetch,
): Promise<RiverAnswer | null> {
  try {
    const res = await fetcher("/api/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pins }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      now?: string;
      watches?: PinWatch[];
    };
    if (!json.ok || !Array.isArray(json.watches)) return null;
    return { now: json.now ?? null, watches: json.watches };
  } catch {
    return null;
  }
}

/** Whose answer is on screen: the pin set (pinsKeyFor) and where it came from. */
export interface OnScreen {
  key: string;
  saved: boolean;
}

export type CheckOutcome =
  /** A fresh answer. Show it; error=false, fromSaved=false. */
  | { kind: "fresh"; watches: PinWatch[]; now: string | null; updatedAt: number }
  /** The check failed; show the saved answer. error=true, fromSaved=true. */
  | { kind: "saved"; watches: PinWatch[]; now: string; updatedAt: number }
  /** The check failed. Keep whatever is on screen; error=true. */
  | { kind: "failed" }
  /**
   * The check failed and the saved answer on screen may not stay: it is 12
   * hours old, or the places changed. Clear it; error=true.
   */
  | { kind: "expired" };

/**
 * What a finished check means for the screen, and the only place the
 * saved answer is read or written.
 *
 * - `linked` (a shared or example link): the saved answer is never read
 *   or written. Those places aren't this visitor's.
 * - Own places, success: save it, unless the places in storage changed
 *   while the check ran ("Delete all my data" must stay deleted).
 * - Own places, failure, and nothing for these places on screen: the
 *   saved answer when it fits these exact places and is under 12 hours
 *   old.
 * - Own places, failure, and a saved answer already on screen: re-read it,
 *   so it ages honestly. Once no saved answer fits the current places (one
 *   was removed, added or renamed, which clears it) or it turns 12 hours
 *   old, it comes down, whichever places it was made for. A saved answer
 *   is never left up frozen.
 */
export function settleCheck({
  pins,
  linked,
  answer,
  onScreen,
  nowMs = Date.now(),
}: {
  pins: Pin[];
  linked: boolean;
  answer: RiverAnswer | null;
  onScreen: OnScreen | null;
  nowMs?: number;
}): CheckOutcome {
  if (answer) {
    if (!linked && pinsKeyFor(loadPins()) === pinsKeyFor(pins)) {
      saveLastAnswer(pins, answer.watches, answer.now, nowMs);
    }
    return { kind: "fresh", watches: answer.watches, now: answer.now, updatedAt: nowMs };
  }
  if (linked) return { kind: "failed" };
  // A fresh answer from this visit is already up for these places: keep
  // it, as before.
  if (onScreen !== null && !onScreen.saved && onScreen.key === pinsKeyFor(pins)) {
    return { kind: "failed" };
  }
  const saved = loadLastAnswer(pins, nowMs);
  if (saved) {
    return { kind: "saved", watches: saved.watches, now: saved.now, updatedAt: saved.savedAt };
  }
  // A saved answer on screen that no longer fits, or is too old: take it down.
  return onScreen?.saved ? { kind: "expired" } : { kind: "failed" };
}

/**
 * `overridePins` (a decoded Watch Link) replaces localStorage — the
 * recipient sees the sender's places without saving anything. It must be
 * referentially stable (memoize it, or use a module-level constant):
 * a fresh array each render would refetch forever.
 */
export function useWatches(
  overridePins: Pin[] | null = null,
): WatchState & { fromSaved: boolean } {
  const [pins, setPins] = useState<Pin[]>([]);
  const [watches, setWatches] = useState<PinWatch[]>([]);
  const [now, setNow] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fromSaved, setFromSaved] = useState(false);
  // Only the newest request may write state; a slow older answer that
  // lands after a newer one must not overwrite it.
  const latest = useRef(0);
  // Which pin set the watches on screen belong to, and whether they came
  // from the saved answer.
  const onScreen = useRef<OnScreen | null>(null);

  // A saved answer that may no longer be shown comes off the screen. The
  // check behind it failed, so error stays true. Setters and refs are
  // stable, so this is too.
  const takeDownSaved = useCallback(() => {
    onScreen.current = null;
    setWatches([]);
    setNow(null);
    setUpdatedAt(null);
    setError(true);
    setFromSaved(false);
  }, []);

  const refresh = useCallback(() => {
    const linked = overridePins !== null;
    const current = overridePins ?? loadPins();
    const req = ++latest.current;
    setPins(current);
    if (current.length === 0) {
      // No places left: no answer worth keeping either.
      if (!linked) clearLastAnswer();
      onScreen.current = null;
      setWatches([]);
      setFromSaved(false);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const answer = await fetchWatches(current);
      if (req !== latest.current) return;
      const out = settleCheck({
        pins: current,
        linked,
        answer,
        onScreen: onScreen.current,
      });
      const key = pinsKeyFor(current);
      switch (out.kind) {
        case "fresh":
          onScreen.current = { key, saved: false };
          setWatches(out.watches);
          setNow(out.now);
          setUpdatedAt(out.updatedAt);
          setError(false);
          setFromSaved(false);
          break;
        case "saved":
          onScreen.current = { key, saved: true };
          setWatches(out.watches);
          setNow(out.now);
          setUpdatedAt(out.updatedAt);
          setError(true);
          setFromSaved(true);
          break;
        case "expired":
          takeDownSaved();
          break;
        case "failed":
          setError(true);
          break;
      }
      setLoading(false);
    })();
  }, [overridePins, takeDownSaved]);

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

  // A saved answer comes down the moment it turns 12 hours old, even when
  // no check is due then, and without waiting on a network that may hang.
  // If the timer wakes early (the device clock moved), it waits again.
  useEffect(() => {
    if (!fromSaved || updatedAt === null) return;
    const savedAt = updatedAt;
    let id: ReturnType<typeof setTimeout>;
    const wait = () => {
      id = setTimeout(
        () => (lastAnswerTooOld(savedAt) ? takeDownSaved() : wait()),
        Math.max(0, savedAt + LAST_ANSWER_MAX_AGE_MS - Date.now()),
      );
    };
    wait();
    return () => clearTimeout(id);
  }, [fromSaved, updatedAt, takeDownSaved]);

  return { pins, watches, now, updatedAt, loading, error, fromSaved, refresh };
}
