"use client";

/**
 * S2 — the money screen (T07). One place, one picture, one sentence.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy";
import { MAX_PINS } from "@/lib/config";
import { decodeWatchLink, encodeWatchLink } from "@/lib/watch-link";
import { useWatches } from "@/lib/use-watch";
import { addPin, loadPins, newPinId } from "@/lib/pin-store";
import { sanitizeName, type Pin } from "@/lib/pins";
import { crestCompare } from "@/lib/crest-compare";
import { heightGloss } from "@/lib/kid-scale";
import { trendOf } from "@/lib/trend";
import { verdictSentence } from "@/lib/sentences";
import { WaterScene } from "@/components/watch/WaterScene";
import { CountdownChip } from "@/components/watch/CountdownChip";
import { AlertStrip } from "@/components/watch/AlertStrip";
import { ShareButton } from "@/components/watch/ShareButton";
import { NextSteps, needsNextSteps } from "@/components/watch/NextSteps";
import { LiveDot, VerdictChip, type VerdictBand } from "@/components/ui";
import type { PinWatch } from "@/lib/watch-service";
import type { CategoryLevel, Verdict } from "@/lib/surveyor";
import type { SeriesPoint } from "@/lib/gauges";

/**
 * A ?wl= that didn't decode. Module scope on purpose: useWatches keys its
 * fetch on this array's identity, so an inline [] would refetch forever.
 */
const BROKEN_LINK: Pin[] = [];

/** Same table as Places: the chip colour follows how bad the flooding is. */
const CATEGORY_CHIPS: Record<CategoryLevel, { band: VerdictBand; label: string }> = {
  none: { band: "UNLIKELY", label: copy.chipCategoryNone },
  action: { band: "BORDERLINE", label: copy.chipCategoryAction },
  minor: { band: "BORDERLINE", label: copy.chipCategoryMinor },
  moderate: { band: "LIKELY", label: copy.chipCategoryModerate },
  major: { band: "LIKELY", label: copy.chipCategoryMajor },
};

export function chipFor(w: PinWatch): { band: VerdictBand; label: string } {
  if (w.verdict.tier === "FULL") {
    const map = {
      LIKELY: copy.chipLikely,
      BORDERLINE: copy.chipBorderline,
      UNLIKELY: copy.chipUnlikely,
    } as const;
    return { band: w.verdict.band, label: map[w.verdict.band] };
  }
  if (w.verdict.tier === "CATEGORY") {
    return CATEGORY_CHIPS[w.verdict.category ?? "none"] ?? CATEGORY_CHIPS.none;
  }
  return { band: "BORDERLINE", label: copy.chipAlertOnly };
}

/** "1:30 PM CT". Visitors outside Central time must not misread the age. */
export function fmtTime(at: string | number): string {
  const t = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
  return `${t} CT`;
}

/**
 * The whole-foot margin a reader sees. Same rounding as the sentence
 * (lib/sentences.ts), so the sentence's number and the kid-scale gloss
 * always describe the same depth.
 */
export function shownFeet(marginFt: number): number {
  return Math.max(1, Math.round(Math.abs(marginFt)));
}

/** A soft second line that turns feet into something you can picture. */
export function glossLineFor(verdict: Verdict): string | null {
  if (verdict.tier !== "FULL") return null;
  const m = verdict.marginFt;
  // Under half a foot, "about 1 ft" plus a picture would overstate it.
  if (!Number.isFinite(m) || Math.abs(m) < 0.5) return null;
  const ft = shownFeet(m);
  const gloss = heightGloss(ft);
  if (gloss === null) return null;
  return m >= 0
    ? `That ${ft} ft gap is ${gloss}.`
    : `That could put about ${ft} ft of water here, ${gloss}.`;
}

/** Newest observed reading, whatever order the series arrived in. */
export function latestReadingIso(observed: SeriesPoint[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const p of observed) {
    const ms = Date.parse(p.t);
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      best = p.t;
    }
  }
  return best;
}

/** Stale data and how many hours old it is (0 when nobody knows). */
export function staleInfo(verdict: Verdict): { stale: boolean; hours: number } {
  if (verdict.tier === "ALERT_ONLY") return { stale: false, hours: 0 };
  const s = verdict.stale;
  return {
    stale: s.staleObserved || s.staleForecast,
    hours: Math.round(Math.max(s.observedH ?? 0, s.forecastH ?? 0)),
  };
}

/** The "Heads up" line under the sentence (and on the share card). */
export function staleLineFor(verdict: Verdict): string | null {
  const { stale, hours } = staleInfo(verdict);
  if (!stale) return null;
  return hours > 0 ? copy.staleness(hours) : copy.stalenessUnknown;
}

/**
 * The small "how fresh is this" chip. A gauge tier shows its newest
 * reading's time; ALERT-ONLY has no gauge, so it shows when the alerts
 * were checked; stale data says so.
 */
export function freshnessChip(
  w: PinWatch,
  updatedAt: number | null,
): { live: boolean; label: string } | null {
  if (w.verdict.tier === "ALERT_ONLY") {
    return w.alertsOk && updatedAt !== null
      ? { live: false, label: copy.alertsCheckedChip(fmtTime(updatedAt)) }
      : null;
  }
  const { stale, hours } = staleInfo(w.verdict);
  if (stale) {
    return hours > 0 ? { live: false, label: copy.delayedChip(hours) } : null;
  }
  const last = w.gauge ? latestReadingIso(w.gauge.observed) : null;
  return last ? { live: true, label: copy.liveChip(fmtTime(last)) } : null;
}

const pinKey = (p: Pin) =>
  `${sanitizeName(p.matchedAddress.slice(0, 120))}|${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`;

/**
 * "Save to this device" on a shared link: add the linked places that
 * aren't already saved (same address, same spot to 4 decimals), stopping
 * at MAX_PINS. Fresh ids, so a link's wl0 never replaces an earlier one.
 * Returns how many were added.
 */
export function saveLinkedPins(linked: Pin[]): number {
  const existing = loadPins();
  const seen = new Set(existing.map(pinKey));
  let count = existing.length;
  let added = 0;
  for (const p of linked) {
    if (count >= MAX_PINS) break;
    const k = pinKey(p);
    if (seen.has(k)) continue;
    if (addPin({ ...p, id: newPinId() })) {
      seen.add(k);
      count++;
      added++;
    }
  }
  return added;
}

interface CopyEnv {
  clipboard?: { writeText: (text: string) => Promise<void> };
  prompt: (message: string, value: string) => unknown;
}

/**
 * Copy to the clipboard. When that's refused (Safari permissions, in-app
 * browsers, plain-http LAN where navigator.clipboard is undefined), show
 * the link in a prompt so it can still be copied by hand. Never rejects.
 */
export async function copyWithFallback(
  text: string,
  onCopied: () => void,
  env: CopyEnv = {
    clipboard: typeof navigator !== "undefined" ? navigator.clipboard : undefined,
    prompt: (message, value) => window.prompt(message, value),
  },
): Promise<void> {
  let ok = false;
  try {
    if (env.clipboard?.writeText) {
      await env.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (ok) {
    onCopied();
    return;
  }
  try {
    env.prompt(copy.copyLinkPrompt, text);
  } catch {
    // no dialog allowed here either; nothing more we can do
  }
}

/** First load: the page's shape, so it's clearly working. */
function WatchSkeleton() {
  return (
    <div className="flex flex-col gap-5 py-8">
      <div
        aria-busy="true"
        className="flex flex-col gap-5"
        data-testid="watch-skeleton"
      >
        <div
          aria-hidden="true"
          className="h-7 w-40 rounded-lg bg-surface motion-safe:animate-pulse"
        />
        <div
          aria-hidden="true"
          className="aspect-[20/11] w-full rounded-2xl bg-surface motion-safe:animate-pulse"
        />
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="h-8 w-full rounded-md bg-surface motion-safe:animate-pulse" />
          <div className="h-8 w-2/3 rounded-md bg-surface motion-safe:animate-pulse" />
        </div>
      </div>
      <p role="status" className="flex items-center gap-2 text-small text-dim">
        <LiveDot /> {copy.looking}
      </p>
    </div>
  );
}

export function WatchClient() {
  const params = useSearchParams();
  const router = useRouter();
  // Watch Link: pins arrive in the URL, nothing is saved on this device.
  const wl = params.get("wl");
  const linkedPins = useMemo(
    () => (wl === null ? null : (decodeWatchLink(wl) ?? BROKEN_LINK)),
    [wl],
  );
  const linkBroken = linkedPins === BROKEN_LINK;
  const isLinked = linkedPins !== null && !linkBroken;
  const { pins, watches, now, updatedAt, loading, error, refresh } =
    useWatches(linkedPins);
  const isExample = isLinked && params.get("ex") === "1";
  const [copied, setCopied] = useState(false);

  // Coming from a scrolled page, small phones landed mid-verdict with the
  // place name and picture above the fold. Always open at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Stays focusable while loading (aria-disabled, not disabled), so a
  // keyboard or screen-reader user keeps their place.
  const checkAgain = (className: string) => (
    <button
      type="button"
      onClick={() => {
        if (!loading) refresh();
      }}
      aria-disabled={loading || undefined}
      className={`${className} aria-disabled:cursor-wait aria-disabled:opacity-50`}
    >
      {copy.refresh}
    </button>
  );

  // A broken link must never fall back to this device's own places: a
  // visitor whose own place is also called "Home" would read their own
  // verdict as the sender's.
  if (linkBroken) {
    return (
      <div className="py-14">
        <p className="text-body text-dim">{copy.brokenLink}</p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center font-semibold text-(--color-current)"
        >
          {copy.addPlace}
        </Link>
      </div>
    );
  }

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

  if (!pin || !watch) {
    if (loading && !error) return <WatchSkeleton />;
    // Kept mounted while a retry runs, so the button keeps focus.
    return (
      <div className="py-14">
        <p className="text-body text-dim">{copy.riverDataDown}</p>
        {checkAgain(
          "mt-4 inline-flex min-h-11 items-center font-semibold text-(--color-current)",
        )}
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
  const glossLine = glossLineFor(verdict);

  // Second marker: another pin sharing this gauge, drawn at true relative
  // elevation (the classic "street floods, house doesn't" picture).
  const other = pins.find(
    (p) =>
      p.id !== pin.id &&
      watches.find((w) => w.pinId === p.id)?.gauge?.lid === gauge?.lid &&
      Math.abs(p.elevationFt - pin.elevationFt) < 40,
  );

  const staleLine = staleLineFor(verdict);
  const freshness = freshnessChip(watch, updatedAt);
  // A failed refresh keeps the last good answer up; say how old it is.
  const refreshFailedLine =
    error && updatedAt !== null ? copy.refreshFailed(fmtTime(updatedAt)) : null;

  const noteStyle = {
    fontSize: 15,
    lineHeight: 1.35,
    marginTop: 10,
    color: "#FFB84D",
  } as const;

  return (
    <div className="flex flex-col gap-5 py-8">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 text-h2 [overflow-wrap:anywhere]">{pin.name}</h1>
        <VerdictChip band={chip.band}>{chip.label}</VerdictChip>
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

      {/* The sentence. The live region stays mounted through refreshes,
          so a changed verdict is announced and an unchanged one is not. */}
      <div>
        <div aria-live="polite" aria-atomic="true" data-testid="verdict-live">
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
        {staleLine && (
          <p className="mt-3 rounded-xl bg-risewatch/10 p-3 text-small">
            {staleLine}
          </p>
        )}
        <div aria-live="polite">
          {refreshFailedLine && (
            <p className="mt-3 rounded-xl bg-risewatch/10 p-3 text-small">
              {refreshFailedLine}
            </p>
          )}
        </div>
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
        {freshness && (
          <span className="tnum inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-small font-semibold text-dim">
            {freshness.live && <LiveDot />}
            {freshness.label}
          </span>
        )}
        {checkAgain(
          "inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold text-dim transition-colors hover:text-(--color-current)",
        )}
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

      {needsNextSteps(watch) && <NextSteps />}

      {/* Links + share */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={
            isLinked && wl !== null
              ? `/why?pin=${pin.id}&wl=${encodeURIComponent(wl)}`
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
              {staleLine && <p style={noteStyle}>{staleLine}</p>}
              {pin.approximate && (
                <p style={noteStyle}>
                  {copy.approximateTag}: {copy.approximateShare}
                </p>
              )}
            </div>
          }
        />
        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}/watch?wl=${encodeWatchLink([pin])}`;
            void copyWithFallback(url, () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="inline-flex min-h-11 items-center text-small font-semibold text-dim hover:text-(--color-current)"
        >
          <span aria-live="polite">
            {copied ? copy.linkCopied : copy.copyLink}
          </span>
        </button>
        {isLinked && linkedPins ? (
          <button
            type="button"
            onClick={() => {
              saveLinkedPins(linkedPins);
              router.push("/places");
            }}
            className="inline-flex min-h-11 items-center font-semibold text-(--color-current)"
          >
            {copy.saveLinkedPins}
          </button>
        ) : (
          <Link href="/places" className="text-dim hover:text-(--color-current)">
            {copy.placesTitle} →
          </Link>
        )}
      </div>

      {isExample && (
        <div className="rounded-xl bg-surface p-4 text-small">
          <p className="text-dim">{copy.exampleNote}</p>
          <Link
            href="/"
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-(--color-current)"
          >
            {copy.exampleCta}
          </Link>
        </div>
      )}
      {isLinked && !isExample && (
        <p className="text-small text-dim">
          You&apos;re viewing a shared watch link. Nothing was saved on this
          device.
        </p>
      )}
    </div>
  );
}
