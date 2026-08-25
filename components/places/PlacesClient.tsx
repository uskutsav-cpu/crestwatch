"use client";

/**
 * S3 · Places board (T08) — up to 5 pins, worst-first, one glance.
 */

import Link from "next/link";
import { copy } from "@/lib/copy";
import { useWatches } from "@/lib/use-watch";
import { statusLine } from "@/lib/sentences";
import { sortWorstFirst } from "@/lib/severity";
import { clearAllPins } from "@/lib/pin-store";
import { BAND_COLOR, LiveDot, type VerdictBand } from "@/components/ui";
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

  if (!loading && pins.length === 0) {
    return (
      <div className="py-14">
        <h1 className="text-h2">{copy.placesTitle}</h1>
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-6 text-dim">
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
        {loading && <LiveDot />}
      </div>

      <ul className="flex flex-col gap-3">
        {sorted.map((w) => {
          const pin = pins.find((p) => p.id === w.pinId);
          if (!pin) return null;
          const crossing =
            w.verdict.tier === "FULL" ? w.verdict.crossing : null;
          return (
            <li key={w.pinId}>
              <Link
                href={`/watch?pin=${pin.id}`}
                className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-(--color-current)"
                style={{ borderLeft: `4px solid ${BAND_COLOR[edgeBand(w)]}` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-body font-semibold">{pin.name}</p>
                  {crossing && (
                    <span className="tnum text-small font-semibold text-risewatch">
                      ~{crossing.hoursFromNow}h
                    </span>
                  )}
                </div>
                <p className="mt-1 text-small text-dim">
                  {statusLine(w.verdict)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      {pins.length < 5 && (
        <Link
          href="/"
          className="font-semibold text-(--color-current)"
        >
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
