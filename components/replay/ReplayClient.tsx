"use client";

/**
 * S5 · Replay (T10) — scrub a real flood against your own elevation.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { REPLAY_EVENTS } from "@/lib/config";
import { copy } from "@/lib/copy";
import { loadPins } from "@/lib/pin-store";
import { replayStats, type ReplayDay } from "@/lib/replay";
import { WaterScene } from "@/components/watch/WaterScene";
import { LiveDot } from "@/components/ui";
import type { Pin } from "@/lib/pins";

export function ReplayClient() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinId, setPinId] = useState<string | null>(null);
  const [eventId, setEventId] = useState(REPLAY_EVENTS[0].id);
  const [days, setDays] = useState<ReplayDay[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = loadPins();
    setPins(p);
    if (p.length > 0) setPinId(p[0].id);
  }, []);

  useEffect(() => {
    setBusy(true);
    setDays(null);
    void (async () => {
      try {
        const res = await fetch("/api/replay", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const json = (await res.json()) as { ok?: boolean; days?: ReplayDay[] };
        if (json.ok && json.days) {
          setDays(json.days);
          setIdx(0);
        }
      } catch {
        // upstream hiccup — the picker stays usable
      }
      setBusy(false);
    })();
  }, [eventId]);

  const pin = pins.find((p) => p.id === pinId) ?? null;
  const event = REPLAY_EVENTS.find((e) => e.id === eventId)!;
  const stats = useMemo(
    () => (days && pin ? replayStats(days, pin.elevationFt) : null),
    [days, pin],
  );

  if (pins.length === 0) {
    return (
      <div className="py-14">
        <h1 className="text-h2">{copy.replayTitle}</h1>
        <p className="mt-4 text-dim">{copy.placesEmpty}</p>
        <Link href="/" className="mt-3 inline-block font-semibold text-(--color-current)">
          {copy.addPlace}
        </Link>
      </div>
    );
  }

  const day = days?.[idx] ?? null;

  return (
    <div className="flex flex-col gap-5 py-10">
      <h1 className="text-h2">{copy.replayTitle}</h1>

      {/* Pickers */}
      <div className="flex flex-wrap gap-3">
        <label className="text-small text-dim">
          Place
          <select
            value={pinId ?? ""}
            onChange={(e) => setPinId(e.target.value)}
            className="mt-1 block rounded-xl bg-surface px-3 py-2 ring-1 ring-inset ring-line text-body text-fg"
          >
            {pins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-small text-dim">
          Flood
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mt-1 block rounded-xl bg-surface px-3 py-2 ring-1 ring-inset ring-line text-body text-fg"
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
        {event.blurb} Data: {event.gaugeName} (USGS {event.usgsSite}).
      </p>

      {busy && (
        <div className="flex items-center gap-2 text-dim">
          <LiveDot /> {copy.looking}
        </div>
      )}

      {pin && day && days && (
        <>
          <WaterScene
            markers={[{ label: pin.name, elevationFt: pin.elevationFt }]}
            currentWaterElevFt={day.waterElevFt}
            crestElevFt={stats?.crest.waterElevFt ?? null}
          />

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={days.length - 1}
              value={idx}
              onChange={(e) => setIdx(parseInt(e.target.value, 10))}
              className="flex-1 accent-(--color-current)"
              aria-label="Replay timeline"
            />
            <span className="tnum w-28 text-right text-small text-dim">
              {day.date}
            </span>
          </div>

          <p className="tnum text-body text-dim">
            Water that day: {day.waterElevFt.toFixed(1)} ft · your spot:{" "}
            {pin.elevationFt.toFixed(1)} ft
          </p>

          {stats && (
            <p className="text-display">
              {stats.daysAbove > 0
                ? copy.replayResult(pin.name, stats.daysAbove)
                : `The water never reached ${pin.name}. The highest it got was ${Math.max(
                    1,
                    Math.round(pin.elevationFt - stats.crest.waterElevFt),
                  )} ft below your spot.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
