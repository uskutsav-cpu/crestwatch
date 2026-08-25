"use client";

/**
 * S2 — the money screen (T07). One place, one picture, one sentence.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { copy } from "@/lib/copy";
import { useWatches } from "@/lib/use-watch";
import { verdictSentence } from "@/lib/sentences";
import { WaterScene } from "@/components/watch/WaterScene";
import { CountdownChip } from "@/components/watch/CountdownChip";
import {
  LiveDot,
  TierBadge,
  VerdictChip,
  type VerdictBand,
} from "@/components/ui";
import type { PinWatch } from "@/lib/watch-service";
import type { Pin } from "@/lib/pins";

function chipFor(w: PinWatch): { band: VerdictBand; label: string } {
  if (w.verdict.tier === "FULL") {
    const map = {
      LIKELY: copy.chipLikely,
      BORDERLINE: copy.chipBorderline,
      UNLIKELY: copy.chipUnlikely,
    } as const;
    return { band: w.verdict.band, label: map[w.verdict.band] };
  }
  if (w.verdict.tier === "CATEGORY") {
    return { band: "BORDERLINE", label: copy.chipCategory };
  }
  return { band: "BORDERLINE", label: copy.chipAlertOnly };
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function WatchClient() {
  const params = useSearchParams();
  const { pins, watches, now, loading, error } = useWatches();

  if (!loading && pins.length === 0) {
    return (
      <div className="py-14">
        <p className="text-body text-dim">{copy.placesEmpty}</p>
        <Link
          href="/"
          className="mt-4 inline-block font-semibold text-(--color-current)"
        >
          {copy.addPlace}
        </Link>
      </div>
    );
  }

  const wantedId = params.get("pin");
  const pin: Pin | undefined =
    pins.find((p) => p.id === wantedId) ?? pins[0];
  const watch = watches.find((w) => w.pinId === pin?.id);

  if (loading && !watch) {
    return (
      <div className="flex items-center gap-2 py-14 text-dim">
        <LiveDot /> {copy.looking}
      </div>
    );
  }
  if (!pin || !watch) {
    return (
      <div className="py-14 text-dim">
        {error ? "The river data didn't answer. Try again in a minute." : copy.looking}
      </div>
    );
  }

  const { verdict, gauge } = watch;
  const chip = chipFor(watch);
  const sentence = verdictSentence({
    pinName: pin.name,
    verdict,
    gauge,
    now: now ?? new Date().toISOString(),
  });

  // Second marker: another pin sharing this gauge, drawn at true relative
  // elevation (the classic "street floods, house doesn't" picture).
  const other = pins.find(
    (p) =>
      p.id !== pin.id &&
      watches.find((w) => w.pinId === p.id)?.gauge?.lid === gauge?.lid &&
      Math.abs(p.elevationFt - pin.elevationFt) < 40,
  );

  const stale =
    verdict.tier !== "ALERT_ONLY" &&
    (verdict.stale.staleObserved || verdict.stale.staleForecast);
  const staleH =
    verdict.tier === "ALERT_ONLY"
      ? 0
      : Math.round(
          Math.max(verdict.stale.observedH ?? 0, verdict.stale.forecastH ?? 0),
        );
  const lastObsIso =
    verdict.tier === "FULL" && gauge?.observed.length
      ? gauge.observed[gauge.observed.length - 1].t
      : null;

  return (
    <div className="flex flex-col gap-5 py-8">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h2">{pin.name}</h1>
        <VerdictChip band={chip.band}>{chip.label}</VerdictChip>
        {verdict.tier !== "FULL" && (
          <TierBadge tier={verdict.tier} />
        )}
      </div>

      {/* The picture */}
      {verdict.tier === "FULL" && (
        <WaterScene
          markers={[
            { label: pin.name, elevationFt: pin.elevationFt },
            ...(other ? [{ label: other.name, elevationFt: other.elevationFt }] : []),
          ]}
          currentWaterElevFt={verdict.currentWaterElevFt}
          crestElevFt={verdict.peak.waterElevFt}
        />
      )}

      {/* The sentence */}
      <p className="text-display">{sentence}</p>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {verdict.tier === "FULL" && verdict.crossing && (
          <CountdownChip pinName={pin.name} crossingIso={verdict.crossing.t} />
        )}
        {stale ? (
          <span className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-small font-semibold text-dim">
            {copy.delayedChip(staleH)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-small font-semibold text-dim">
            <LiveDot />
            {copy.liveChip(lastObsIso ? fmtTime(lastObsIso) : "now")}
          </span>
        )}
      </div>

      {/* Alert-only helper */}
      {verdict.tier === "ALERT_ONLY" && watch.alerts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {watch.alerts.map((a, i) => (
            <li
              key={i}
              className="rounded-xl border border-risewatch/60 bg-surface p-3 text-small"
            >
              <span className="font-semibold">{a.event}</span>
              {a.areaDesc ? ` — ${a.areaDesc}` : ""}
            </li>
          ))}
        </ul>
      )}

      {/* Links */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/why?pin=${pin.id}`}
          className="font-semibold text-(--color-current)"
        >
          {copy.whyLink}
        </Link>
        <Link href="/places" className="text-dim hover:text-(--color-current)">
          {copy.placesTitle} →
        </Link>
      </div>
    </div>
  );
}
