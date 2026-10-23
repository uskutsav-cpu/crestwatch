"use client";

/**
 * S3 · Places board (T08): up to 5 pins, worst first, one glance.
 * Each card can be opened, renamed, or removed on its own.
 *
 * Saved places are always listed, even when the river data didn't
 * answer: a board that goes blank next to "Delete all my data" looks
 * like the places were wiped.
 */

import Link from "next/link";
import { useEffect, useRef } from "react";
import { copy } from "@/lib/copy";
import { MAX_PINS } from "@/lib/config";
import { fmtTime } from "@/lib/time";
import { useWatches } from "@/lib/use-watch";
import { statusLine } from "@/lib/sentences";
import { sortWorstFirst } from "@/lib/severity";
import { trendOf, type Trend } from "@/lib/trend";
import { clearAllPins, removePin, renamePin } from "@/lib/pin-store";
import { BAND_COLOR, LiveDot, type VerdictBand } from "@/components/ui";
import { AlertStrip } from "@/components/watch/AlertStrip";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";

/**
 * Card edge colour. The CATEGORY tier follows the Watch chip table:
 * below flood stage (or no category) is calm, action and minor are
 * too close to call, moderate and major mean water is likely.
 */
export function edgeBand(w: PinWatch): VerdictBand {
  const v = w.verdict;
  if (v.tier === "FULL") return v.band;
  if (v.tier === "CATEGORY") {
    if (v.category === "moderate" || v.category === "major") return "LIKELY";
    if (v.category === "action" || v.category === "minor") return "BORDERLINE";
    // No published flood stage: unknown, never a green all-clear.
    if (v.category === null || v.category === undefined) return "BORDERLINE";
    return "UNLIKELY";
  }
  return "BORDERLINE";
}

const TREND_ARROW: Record<Trend, string> = {
  rising: "↑",
  falling: "↓",
  steady: "→",
};
const TREND_TEXT: Record<Trend, string> = {
  rising: copy.trendRising,
  falling: copy.trendFalling,
  steady: copy.trendSteady,
};

export function PlacesClient() {
  const { pins, watches, loading, error, updatedAt, refresh } = useWatches();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);

  // Removing a place takes its button away with it. Once the new list
  // (or the empty state, which has its own h1) has rendered, put focus
  // on the page title so keyboard users don't land on <body>.
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  });

  function deleteAll() {
    if (window.confirm(copy.deleteAllConfirm)) {
      clearAllPins();
      focusHeading.current = true;
      refresh();
    }
  }

  function removeOne(id: string, name: string) {
    if (window.confirm(copy.removePlace(name))) {
      removePin(id);
      focusHeading.current = true;
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

  const heading = (
    <h1 ref={headingRef} tabIndex={-1} className="text-h2">
      {copy.placesTitle}
    </h1>
  );

  if (!loading && pins.length === 0) {
    return (
      <div className="py-14">
        {heading}
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

  // Checked places worst first, then any place the river data hasn't
  // answered for yet, in the order they were saved.
  const rows: Array<{ pin: Pin; watch: PinWatch | null }> = [];
  for (const w of sortWorstFirst(watches)) {
    const pin = pins.find((p) => p.id === w.pinId);
    if (pin) rows.push({ pin, watch: w });
  }
  for (const pin of pins) {
    if (!watches.some((w) => w.pinId === pin.id)) rows.push({ pin, watch: null });
  }

  const firstLoadFailed = error && watches.length === 0;
  const refreshFailed = error && watches.length > 0 && updatedAt !== null;

  const actions = (pin: Pin) => (
    <div className="absolute right-2 top-2 flex gap-2">
      <button
        type="button"
        onClick={() => renameOne(pin.id, pin.name)}
        aria-label={`Rename ${pin.name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-dim transition-colors hover:text-(--color-current)"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={() => removeOne(pin.id, pin.name)}
        aria-label={`Remove ${pin.name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-dim transition-colors hover:text-floodline"
      >
        ✕
      </button>
    </div>
  );

  const approxTag = (pin: Pin) =>
    pin.approximate ? (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-risewatch/10 px-2 py-0.5 text-small font-semibold text-risewatch">
        {copy.approximateTag}
      </span>
    ) : null;

  return (
    <div className="flex min-h-[60dvh] flex-col gap-4 py-10">
      <div>
        <div className="flex items-center justify-between">
          {heading}
          <div className="flex items-center gap-2">
            {loading && <LiveDot />}
            {/* Stays focusable while checking (aria-disabled, not
                disabled) so keyboard focus isn't dropped mid-refresh. */}
            <button
              type="button"
              onClick={() => {
                if (!loading) refresh();
              }}
              aria-disabled={loading || undefined}
              className="inline-flex min-h-11 items-center text-small font-semibold text-dim transition-colors hover:text-(--color-current) aria-disabled:opacity-50"
            >
              {copy.refresh}
            </button>
          </div>
        </div>
        <div role="status">
          {firstLoadFailed && (
            <p className="mt-2 rounded-2xl bg-surface p-4 text-body">
              {copy.riverDataDown}
            </p>
          )}
          {refreshFailed && (
            <p className="mt-1 text-small text-dim">
              {copy.refreshFailedPlaces(fmtTime(updatedAt))}
            </p>
          )}
        </div>
      </div>

      {/* AlertStrip drops repeats, then keeps 3: cutting here first
          could push out a distinct alert behind a repeated one. */}
      <AlertStrip alerts={watches.flatMap((w) => w.alerts)} />

      <ul className="flex flex-col gap-3">
        {rows.map(({ pin, watch: w }) => {
          if (!w) {
            // No answer for this place yet: name it, keep its buttons,
            // and say plainly that it wasn't checked.
            return (
              <li key={pin.id} className="relative">
                <Link
                  href={`/watch?pin=${pin.id}`}
                  className="block rounded-2xl bg-surface p-4 pr-28 transition-colors hover:bg-surface/70"
                  style={{ borderLeft: "4px solid var(--color-line)" }}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 text-body font-semibold [overflow-wrap:anywhere]">{pin.name}</p>
                    {approxTag(pin)}
                  </div>
                  <p className="mt-1 text-small text-dim">
                    {loading && !error ? copy.looking : copy.placeUnchecked}
                  </p>
                </Link>
                {actions(pin)}
              </li>
            );
          }
          const crossing =
            w.verdict.tier === "FULL" ? w.verdict.crossing : null;
          // Only show a direction when the reading is fresh; a week-old
          // "steady" would be a guess dressed up as a fact.
          const trend =
            w.gauge &&
            w.verdict.tier !== "ALERT_ONLY" &&
            !w.verdict.stale.staleObserved
              ? trendOf(w.gauge.observed)
              : null;
          return (
            <li key={w.pinId} className="relative">
              <Link
                href={`/watch?pin=${pin.id}`}
                className="block rounded-2xl bg-surface p-4 pr-28 transition-colors hover:bg-surface/70"
                style={{ borderLeft: `4px solid ${BAND_COLOR[edgeBand(w)]}` }}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="min-w-0 text-body font-semibold [overflow-wrap:anywhere]">{pin.name}</p>
                  {approxTag(pin)}
                  {trend && (
                    <span className="text-small text-dim">
                      <span aria-hidden="true">{TREND_ARROW[trend]}</span>
                      <span className="sr-only">{TREND_TEXT[trend]}</span>
                    </span>
                  )}
                  {crossing && crossing.hoursFromNow > 0 && (
                    <span className="tnum ml-auto text-small font-semibold text-risewatch">
                      ~{crossing.hoursFromNow}h
                    </span>
                  )}
                </div>
                <p className="mt-1 text-small text-dim">
                  {statusLine(w.verdict)}
                </p>
              </Link>
              {actions(pin)}
            </li>
          );
        })}
      </ul>

      {pins.length > 0 && pins.length < MAX_PINS && (
        <Link href="/" className="font-semibold text-(--color-current)">
          {copy.addPlace}
        </Link>
      )}

      {pins.length > 0 && (
        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={deleteAll}
            className="text-small text-dim underline-offset-2 hover:text-floodline hover:underline"
          >
            {copy.deleteAll}
          </button>
        </div>
      )}
    </div>
  );
}
