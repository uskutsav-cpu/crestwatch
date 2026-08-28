"use client";

/**
 * S3 · Places board (T08): up to 5 pins, worst first, one glance.
 * Each card can be opened, renamed, or removed on its own.
 */

import Link from "next/link";
import { copy } from "@/lib/copy";
import { useWatches } from "@/lib/use-watch";
import { statusLine } from "@/lib/sentences";
import { sortWorstFirst } from "@/lib/severity";
import { trendOf } from "@/lib/trend";
import { clearAllPins, removePin, renamePin } from "@/lib/pin-store";
import { BAND_COLOR, LiveDot, type VerdictBand } from "@/components/ui";
import { AlertStrip } from "@/components/watch/AlertStrip";
import type { PinWatch } from "@/lib/watch-service";

function edgeBand(w: PinWatch): VerdictBand {
  if (w.verdict.tier === "FULL") return w.verdict.band;
  if (w.verdict.tier === "CATEGORY") {
    return w.verdict.category === "major" || w.verdict.category === "moderate"
      ? "LIKELY"
      : "BORDERLINE";
  }
  return "BORDERLINE";
}

export function PlacesClient() {
  const { pins, watches, loading, refresh } = useWatches();

  function deleteAll() {
    if (window.confirm(copy.deleteAllConfirm)) {
      clearAllPins();
      refresh();
    }
  }

  function removeOne(id: string, name: string) {
    if (window.confirm(copy.removePlace(name))) {
      removePin(id);
      refresh();
    }
  }

  function renameOne(id: string, current: string) {
    const next = window.prompt(copy.renamePrompt, current);
    if (next && next.trim()) {
      renamePin(id, next.trim());
      refresh();
    }
  }

  if (!loading && pins.length === 0) {
    return (
      <div className="py-14">
        <h1 className="text-h2">{copy.placesTitle}</h1>
        <p className="mt-4 rounded-2xl bg-surface p-6 text-dim">
          {copy.placesEmpty}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block font-semibold text-(--color-current)"
        >
          {copy.addPlace}
        </Link>
      </div>
    );
  }

  const sorted = sortWorstFirst(watches);

  return (
    <div className="flex min-h-[60vh] flex-col gap-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-h2">{copy.placesTitle}</h1>
        <div className="flex items-center gap-2">
          {loading && <LiveDot />}
          <button
            onClick={refresh}
            disabled={loading}
            className="text-small font-semibold text-dim transition-colors hover:text-(--color-current) disabled:opacity-50"
          >
            {copy.refresh}
          </button>
        </div>
      </div>

      <AlertStrip alerts={watches.flatMap((w) => w.alerts).slice(0, 3)} />

      <ul className="flex flex-col gap-3">
        {sorted.map((w) => {
          const pin = pins.find((p) => p.id === w.pinId);
          if (!pin) return null;
          const crossing =
            w.verdict.tier === "FULL" ? w.verdict.crossing : null;
          const trend = w.gauge ? trendOf(w.gauge.observed) : null;
          return (
            <li key={w.pinId} className="relative">
              <Link
                href={`/watch?pin=${pin.id}`}
                className="block rounded-2xl bg-surface p-4 pr-20 transition-colors hover:bg-surface/70"
                style={{ borderLeft: `4px solid ${BAND_COLOR[edgeBand(w)]}` }}
              >
                <div className="flex items-center gap-2">
                  <p className="text-body font-semibold">{pin.name}</p>
                  {trend && (
                    <span className="text-small text-dim" aria-hidden="true">
                      {trend === "rising" ? "↑" : trend === "falling" ? "↓" : "→"}
                    </span>
                  )}
                  {crossing && (
                    <span className="tnum ml-auto text-small font-semibold text-risewatch">
                      ~{crossing.hoursFromNow}h
                    </span>
                  )}
                </div>
                <p className="mt-1 text-small text-dim">
                  {statusLine(w.verdict)}
                </p>
              </Link>
              <div className="absolute right-3 top-3 flex gap-1">
                <button
                  onClick={() => renameOne(pin.id, pin.name)}
                  aria-label={`Rename ${pin.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-dim transition-colors hover:text-(--color-current)"
                >
                  ✎
                </button>
                <button
                  onClick={() => removeOne(pin.id, pin.name)}
                  aria-label={`Remove ${pin.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-dim transition-colors hover:text-floodline"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {pins.length < 5 && (
        <Link href="/" className="font-semibold text-(--color-current)">
          {copy.addPlace}
        </Link>
      )}

      <div className="mt-auto pt-8">
        <button
          onClick={deleteAll}
          className="text-small text-dim underline-offset-2 hover:text-floodline hover:underline"
        >
          {copy.deleteAll}
        </button>
      </div>
    </div>
  );
}
