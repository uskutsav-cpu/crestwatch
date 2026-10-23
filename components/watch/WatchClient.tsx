"use client";

/**
 * S2 — the money screen (T07). One place, one picture, one sentence.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy";
import { decodeWatchLink, encodeWatchLink } from "@/lib/watch-link";
import { useWatches } from "@/lib/use-watch";
import { crestCompare } from "@/lib/crest-compare";
import { heightGloss } from "@/lib/kid-scale";
import { trendOf } from "@/lib/trend";
import { verdictSentence } from "@/lib/sentences";
import { WaterScene } from "@/components/watch/WaterScene";
import { CountdownChip } from "@/components/watch/CountdownChip";
import { AlertStrip } from "@/components/watch/AlertStrip";
import { ShareButton } from "@/components/watch/ShareButton";
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
  // Watch Link: pins arrive in the URL, nothing is saved on this device.
  const linkedPins = useMemo(() => {
    const wl = params.get("wl");
    return wl ? decodeWatchLink(wl) : null;
  }, [params]);
  const { pins, watches, now, loading, error, refresh } = useWatches(linkedPins);
  const [copied, setCopied] = useState(false);

  // Coming from a scrolled page, small phones landed mid-verdict with the
  // place name and picture above the fold. Always open at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
  const trend = gauge ? trendOf(gauge.observed) : null;
  const freshTrend =
    verdict.tier !== "ALERT_ONLY" && !verdict.stale.staleObserved
      ? trend
      : null;
  const sentence = verdictSentence({
    pinName: pin.name,
    verdict,
    gauge,
    now: now ?? new Date().toISOString(),
    observedTrend: freshTrend,
  });

  // A soft second line that turns feet into something you can picture.
  const gloss =
    verdict.tier === "FULL" ? heightGloss(verdict.marginFt) : null;
  const glossLine =
    gloss === null || verdict.tier !== "FULL"
      ? null
      : verdict.marginFt >= 0
        ? `That ${Math.max(1, Math.round(verdict.marginFt))} ft gap is ${gloss}.`
        : `That could put about ${Math.max(1, Math.round(-verdict.marginFt))} ft of water here, ${gloss}.`;

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
        <h1 className="min-w-0 text-h2 [overflow-wrap:anywhere]">{pin.name}</h1>
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
      <div>
        <p
          className={
            sentence.length > 110
              ? "text-h2 font-bold sm:text-display"
              : "text-display"
          }
        >
          {sentence}
        </p>
        {glossLine && (
          <p className="mt-2 text-body text-dim">{glossLine}</p>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {freshTrend && (
          <span className="tnum inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-small font-semibold text-dim">
            {freshTrend === "rising" ? "↑" : freshTrend === "falling" ? "↓" : "→"}{" "}
            {freshTrend === "rising"
              ? copy.trendRising
              : freshTrend === "falling"
                ? copy.trendFalling
                : copy.trendSteady}
          </span>
        )}
        {verdict.tier === "FULL" && verdict.crossing && (
          <CountdownChip pinName={pin.name} crossingIso={verdict.crossing.t} />
        )}
        {verdict.tier === "FULL" &&
          gauge &&
          (() => {
            const cc = crestCompare(
              verdict.peak.stageFt,
              gauge.historicCrests,
              gauge.categories,
            );
            return cc ? (
              <span className="tnum inline-flex items-center rounded-full bg-surface px-3 py-1.5 text-small font-semibold text-dim">
                {copy.crestCompare(cc.ordinal, cc.sinceYear)}
              </span>
            ) : null;
          })()}
        {stale ? (
          <span className="inline-flex items-center rounded-full bg-surface px-3 py-1.5 text-small font-semibold text-dim">
            {copy.delayedChip(staleH)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-small font-semibold text-dim">
            <LiveDot />
            {copy.liveChip(lastObsIso ? fmtTime(lastObsIso) : "now")}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold text-dim transition-colors hover:text-(--color-current) disabled:opacity-50"
        >
          {loading ? "…" : copy.refresh}
        </button>
      </div>

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

      {/* Active flood alerts (all tiers — additive context) */}
      <AlertStrip alerts={watch.alerts} />
      {verdict.tier === "ALERT_ONLY" && !watch.alertsOk && (
        <p className="rounded-xl bg-risewatch/10 p-3 text-small">
          CrestWatch couldn&apos;t reach the alert service just now. That is
          not an all-clear. Check weather.gov directly.
        </p>
      )}

      {/* Links + share */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={
            linkedPins
              ? `/why?pin=${pin.id}&wl=${params.get("wl")}`
              : `/why?pin=${pin.id}`
          }
          className="font-semibold text-(--color-current)"
        >
          {copy.whyLink}
        </Link>
        <ShareButton
          card={
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
                {pin.name}
              </p>
              {verdict.tier === "FULL" && (
                <WaterScene
                  markers={[{ label: pin.name, elevationFt: pin.elevationFt }]}
                  currentWaterElevFt={verdict.currentWaterElevFt}
                  crestElevFt={verdict.peak.waterElevFt}
                />
              )}
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 14, lineHeight: 1.3 }}>
                {sentence}
              </p>
            </div>
          }
        />
        <button
          onClick={() => {
            const url = `${window.location.origin}/watch?wl=${encodeWatchLink([pin])}`;
            void navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="inline-flex min-h-11 items-center text-small font-semibold text-dim hover:text-(--color-current)"
        >
          {copied ? "Link copied ✓" : "Copy watch link"}
        </button>
        <Link href="/places" className="text-dim hover:text-(--color-current)">
          {copy.placesTitle} →
        </Link>
      </div>

      {linkedPins && (
        <p className="text-small text-dim">
          You&apos;re viewing a shared watch link. Nothing was saved on this
          device.
        </p>
      )}
    </div>
  );
}
