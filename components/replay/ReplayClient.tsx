"use client";

/**
 * S5 · Replay (T10) — scrub a real flood against your own elevation.
 * A recorded river level only speaks for places near its gauge, so a
 * place farther than the event's radius gets a plain "too far" line
 * instead of a made-up result.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { REPLAY_EVENTS } from "@/lib/config";
import { copy } from "@/lib/copy";
import { EXAMPLE_PINS } from "@/lib/example";
import { loadPins } from "@/lib/pin-store";
import {
  crestIndex,
  eventDistanceMi,
  nearestEventFor,
  replayStats,
  type ReplayDay,
} from "@/lib/replay";
import { WaterScene } from "@/components/watch/WaterScene";
import { LiveDot } from "@/components/ui";
import type { Pin } from "@/lib/pins";

/** About one day per step: the 217-day 2019 flood plays in about 9 s. */
const PLAY_STEP_MS = 40;

const DEFAULT_EVENT_ID = REPLAY_EVENTS[0].id;

const selectClasses =
  "mt-1 block w-full max-w-full truncate rounded-xl bg-surface px-3 py-2 ring-1 ring-inset ring-(--color-dim) text-body text-fg";

const smallButtonClasses =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-left text-body font-semibold text-fg ring-1 ring-inset ring-(--color-dim) transition-colors hover:text-(--color-current) hover:ring-(--color-current) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg";

/** The nearest in-range flood for this place, or the current one if none. */
function eventIdFor(pin: Pin, currentId: string): string {
  return nearestEventFor(REPLAY_EVENTS, pin, currentId)?.id ?? currentId;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="currentColor">
      {playing ? (
        <>
          <rect x="2" y="1.5" width="3" height="9" rx="0.5" />
          <rect x="7" y="1.5" width="3" height="9" rx="0.5" />
        </>
      ) : (
        <path d="M3 1.5 L10.5 6 L3 10.5 Z" />
      )}
    </svg>
  );
}

/** One finished request: `days` is null when it failed. */
interface SeriesResult {
  key: string;
  days: ReplayDay[] | null;
}

const requestKey = (eventId: string, attempt: number) => `${eventId}#${attempt}`;

export function ReplayClient() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [example, setExample] = useState(false);
  const [pinId, setPinId] = useState<string | null>(null);
  const [eventId, setEventId] = useState(DEFAULT_EVENT_ID);
  const [result, setResult] = useState<SeriesResult | null>(null);
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const p = loadPins();
    setPins(p);
    if (p.length > 0) {
      setPinId(p[0].id);
      setEventId(eventIdFor(p[0], DEFAULT_EVENT_ID));
    }
    setLoaded(true);
  }, []);

  // One fetch per (flood, retry) once there is a place to compare.
  const active = pinId !== null;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const key = requestKey(eventId, attempt);
    void (async () => {
      let got: ReplayDay[] | null = null;
      try {
        const res = await fetch("/api/replay", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const json = (await res.json()) as { ok?: boolean; days?: ReplayDay[] };
        if (res.ok && json.ok && Array.isArray(json.days) && json.days.length > 0) {
          got = json.days;
        }
      } catch {
        // network error or a non-JSON error page: shown as failed below
      }
      // A late answer for a flood that's no longer picked is dropped.
      if (!cancelled) setResult({ key, days: got });
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, attempt, active]);

  // Only the answer to the request on screen counts, so a stale one can
  // never show under the wrong flood's name.
  const current =
    active && result?.key === requestKey(eventId, attempt) ? result : null;
  const days = current?.days ?? null;
  const busy = active && current === null;
  const failed = current !== null && current.days === null;

  const pin = pins.find((p) => p.id === pinId) ?? null;
  const event = REPLAY_EVENTS.find((e) => e.id === eventId) ?? REPLAY_EVENTS[0];
  const distMi = pin ? eventDistanceMi(event, pin) : null;
  const tooFar = distMi !== null && distMi > event.maxMi;
  const stats = days && pin ? replayStats(days, pin.elevationFt) : null;

  const lastIdx = days ? days.length - 1 : 0;
  const at = Math.min(idx, lastIdx);
  const isPlaying = playing && days !== null && !tooFar && at < lastIdx;
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setIdx((i) => Math.min(i + 1, lastIdx));
    }, PLAY_STEP_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, lastIdx]);

  /** Every flood switch starts at day one, with Play stopped. */
  function switchEvent(id: string) {
    setPlaying(false);
    if (id !== eventId) {
      setEventId(id);
      setIdx(0);
    }
  }

  function choosePlace(id: string) {
    const next = pins.find((p) => p.id === id);
    setPlaying(false);
    setPinId(id);
    if (next) switchEvent(eventIdFor(next, eventId));
  }

  function startExample() {
    setExample(true);
    setPins(EXAMPLE_PINS);
    setPinId(EXAMPLE_PINS[0].id);
    switchEvent(eventIdFor(EXAMPLE_PINS[0], eventId));
  }

  function retry() {
    setPlaying(false);
    setIdx(0);
    setAttempt((a) => a + 1);
  }

  function togglePlay() {
    if (!days) return;
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (prefersReducedMotion()) {
      setPlaying(false);
      setIdx(crestIndex(days));
      return;
    }
    if (at >= lastIdx) setIdx(0);
    setPlaying(true);
  }

  if (!loaded) {
    return (
      <div className="py-14">
        <h1 className="text-h2">{copy.replayTitle}</h1>
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="py-14">
        <h1 className="text-h2">{copy.replayTitle}</h1>
        <p className="mt-4 text-dim">{copy.placesEmpty}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="button" onClick={startExample} className={smallButtonClasses}>
            {copy.replayExampleCta}
          </button>
          <Link href="/" className="font-semibold text-(--color-current)">
            {copy.addPlace}
          </Link>
        </div>
      </div>
    );
  }

  const day = days?.[at] ?? null;

  return (
    <div className="flex flex-col gap-5 py-10">
      <h1 className="text-h2">{copy.replayTitle}</h1>

      {example && (
        <p className="text-small text-dim">
          {copy.replayExampleNote}{" "}
          <Link href="/" className="font-semibold text-(--color-current)">
            {copy.exampleCta}
          </Link>
        </p>
      )}

      {/* Pickers */}
      <div className="flex flex-wrap gap-3">
        <label className="min-w-0 max-w-full text-small text-dim">
          {copy.replayPlaceLabel}
          <select
            value={pinId ?? ""}
            onChange={(e) => choosePlace(e.target.value)}
            className={selectClasses}
          >
            {pins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 max-w-full text-small text-dim">
          {copy.replayFloodLabel}
          <select
            value={eventId}
            onChange={(e) => switchEvent(e.target.value)}
            className={selectClasses}
          >
            {REPLAY_EVENTS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-small text-dim">
        {event.blurb} {copy.replayData(event.gaugeName, event.usgsSite)}
      </p>

      {pin && tooFar && distMi !== null && (
        <p className="text-body">
          {copy.replayTooFar(event.gaugeName, Math.round(distMi), pin.name)}
        </p>
      )}

      {!tooFar && busy && (
        <div className="flex items-center gap-2 text-dim">
          <LiveDot /> {copy.looking}
        </div>
      )}

      {!tooFar && failed && !busy && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-dim">{copy.replayFailed}</p>
          <button
            type="button"
            onClick={retry}
            className={smallButtonClasses}
          >
            {copy.tryAgain}
          </button>
        </div>
      )}

      {pin && !tooFar && day && days && (
        <>
          <WaterScene
            markers={[{ label: pin.name, elevationFt: pin.elevationFt }]}
            currentWaterElevFt={day.waterElevFt}
            crestElevFt={stats?.crest.waterElevFt ?? null}
            crestLabel={copy.replayCrestLabel}
          />

          {/* A town-centre pin must never masquerade as house-level math. */}
          {pin.approximate && (
            <p className="rounded-xl bg-risewatch/10 p-3 text-small">
              <span className="font-semibold text-risewatch">
                {copy.approximateTag}
              </span>
              {": "}
              {copy.approximateNote}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={togglePlay} className={smallButtonClasses}>
              <PlayIcon playing={isPlaying} />
              {isPlaying ? copy.replayPause : copy.replayPlay}
            </button>
            <div className="flex min-w-48 flex-1 items-center gap-3">
              <input
                type="range"
                min={0}
                max={days.length - 1}
                value={at}
                onChange={(e) => {
                  setPlaying(false);
                  setIdx(parseInt(e.target.value, 10));
                }}
                className="h-11 min-w-0 flex-1 accent-(--color-current)"
                aria-label={copy.replayTimeline}
                aria-valuetext={copy.replaySliderValue(
                  day.date,
                  day.waterElevFt.toFixed(1),
                  pin.name,
                  pin.elevationFt.toFixed(1),
                )}
              />
              <span className="tnum w-28 text-right text-small text-dim">
                {day.date}
              </span>
            </div>
          </div>

          <p className="tnum text-body text-dim">
            {copy.replayWaterThatDay(
              day.waterElevFt.toFixed(1),
              pin.elevationFt.toFixed(1),
            )}
          </p>

          {stats && (
            <p className="text-display">
              {stats.daysAbove > 0
                ? copy.replayResult(pin.name, stats.daysAbove)
                : copy.replayNeverReached(
                    pin.name,
                    Math.max(1, Math.round(pin.elevationFt - stats.crest.waterElevFt)),
                  )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
