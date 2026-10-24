"use client";

/**
 * S2 — the money screen (T07). One place, one picture, one sentence.
 *
 * Below the sentence, top to bottom: the honesty notes and alerts, What
 * to do now when it applies (right after the alerts, so a family never
 * scrolls past anything to reach it), "Your flood number" (FULL only; its
 * what-if slider draws its own small picture inside the card, and the
 * main picture always stays on the forecast), the actions (Why, Read it
 * to me, Share, Send to family, Copy watch link, Add the crest to my
 * calendar), then Past floods here (FULL only). Flood number and past
 * floods need a gauge zero the Surveyor trusts, so CATEGORY and
 * ALERT-ONLY never show them.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { copy } from "@/lib/copy";
import { MAX_PINS } from "@/lib/config";
import { fmtTime } from "@/lib/time";
import { decodeWatchLink, encodeWatchLink } from "@/lib/watch-link";
import { useWatches } from "@/lib/use-watch";
import { addPin, loadPins, newPinId } from "@/lib/pin-store";
import { sanitizeName, type Pin } from "@/lib/pins";
import { crestCompare } from "@/lib/crest-compare";
import { heightGloss } from "@/lib/kid-scale";
import { trendOf } from "@/lib/trend";
import { riverName, verdictSentence } from "@/lib/sentences";
import { staleInfo, staleLineFor } from "@/lib/staleness";
import { WaterScene } from "@/components/watch/WaterScene";
import { CountdownChip } from "@/components/watch/CountdownChip";
import { AlertStrip, shownAlerts } from "@/components/watch/AlertStrip";
import { ShareButton } from "@/components/watch/ShareButton";
import { NextSteps, needsNextSteps } from "@/components/watch/NextSteps";
import { FloodNumber } from "@/components/watch/FloodNumber";
import { PastFloods } from "@/components/watch/PastFloods";
import { ReadAloud } from "@/components/watch/ReadAloud";
import { SendToFamily } from "@/components/watch/SendToFamily";
import { AddToCalendar, isFutureCrest } from "@/components/watch/AddToCalendar";
import { floodNumberInputFor } from "@/lib/flood-number";
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
    // No published flood stage: unknown, never a green all-clear.
    if (w.verdict.category === null || w.verdict.category === undefined) {
      return { band: "BORDERLINE", label: copy.chipCategoryUnknown };
    }
    return CATEGORY_CHIPS[w.verdict.category] ?? CATEGORY_CHIPS.none;
  }
  return { band: "BORDERLINE", label: copy.chipAlertOnly };
}

// Shared with Places and Why; re-exported so existing imports keep working.
export { fmtTime, staleInfo, staleLineFor };

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
  return m >= 0 ? copy.glossGap(ft, gloss) : copy.glossWater(ft, gloss);
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

/**
 * The forecast crest still ahead, for "Add the crest to my calendar", or
 * null when there isn't an honest one to save: no gauge (ALERT-ONLY), an
 * old forecast, a crest already behind us, or a river the forecast has
 * coming down (the "peak" would only be the next forecast point). FULL
 * uses the Surveyor's own pastPeak; CATEGORY has no such flag, so the
 * same rule is read off the forecast here.
 */
export function crestAheadIso(w: PinWatch, now: string): string | null {
  const v = w.verdict;
  if (v.tier === "ALERT_ONLY" || v.stale.staleForecast) return null;
  if (v.tier === "FULL") {
    if (v.pastPeak) return null;
    return isFutureCrest(v.peak.t, now) ? v.peak.t : null;
  }
  const nowMs = Date.parse(now);
  const future = (w.gauge?.forecast ?? [])
    .filter((p) => Number.isFinite(Date.parse(p.t)) && Date.parse(p.t) > nowMs)
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const rises = future.some((p, i) => i > 0 && p.stageFt > future[0].stageFt);
  if (!rises) return null;
  return isFutureCrest(v.peakT, now) ? v.peakT : null;
}

/** A what-if stage from the flood number slider, and the place and gauge it was picked for. */
export interface WhatIfPick {
  key: string;
  stageFt: number;
}

/** What ties a what-if stage to one place on one gauge. */
export const whatIfKeyFor = (pinId: string, gaugeLid: string | null | undefined) =>
  `${pinId}|${gaugeLid ?? ""}`;

/**
 * The what-if stage the picture may draw, or null for the forecast. Only
 * while the flood number card is up (FULL, trusted gauge zero), and only
 * for the place and gauge it was picked on, so a stage from one gauge is
 * never drawn on another gauge's zero, not even for one render.
 */
export function whatIfFor(
  pick: WhatIfPick | null,
  key: string,
  gaugeZeroFt: number | null | undefined,
): number | null {
  if (pick === null || pick.key !== key) return null;
  if (typeof gaugeZeroFt !== "number" || !Number.isFinite(gaugeZeroFt)) return null;
  return Number.isFinite(pick.stageFt) ? pick.stageFt : null;
}

/**
 * The dashed line for the what-if picture inside the flood number card:
 * that river level (gauge zero + stage), labelled "what-if level". Null
 * on the forecast, or without a usable gauge zero. The main picture never
 * takes it: it always shows the forecast crest.
 */
export function whatIfCrest(
  gaugeZeroFt: number | null | undefined,
  whatIf: number | null,
): { crestElevFt: number; crestLabel: string } | null {
  if (whatIf === null || !Number.isFinite(whatIf)) return null;
  if (typeof gaugeZeroFt !== "number" || !Number.isFinite(gaugeZeroFt)) return null;
  return { crestElevFt: gaugeZeroFt + whatIf, crestLabel: copy.floodNumberSceneLabel };
}

/**
 * The alert lines that leave the screen with the answer (Read it to me,
 * Send to family, the calendar file, the share picture), matching what
 * the screen shows: the alert strip's warnings by name, and, for
 * ALERT-ONLY, the note that the alert service couldn't be reached.
 */
export function alertNotesFor(w: Pick<PinWatch, "verdict" | "alerts" | "alertsOk">): string[] {
  const events = [
    ...new Set(
      shownAlerts(w.alerts ?? [])
        .map((a) => (typeof a.event === "string" ? a.event.trim() : ""))
        .filter(Boolean),
    ),
  ];
  const notes: string[] = [];
  if (events.length > 0) notes.push(copy.alertsShare(events));
  if (w.verdict.tier === "ALERT_ONLY" && !w.alertsOk) notes.push(copy.alertServiceDown);
  return notes;
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

const neverChanges = () => () => {};

/**
 * This site's origin, for the watch link that Send to family and the
 * calendar file carry. "" on the server and during hydration, so the
 * first paint matches the server's HTML.
 */
function useOrigin(): string {
  return useSyncExternalStore(
    neverChanges,
    () => window.location.origin,
    () => "",
  );
}

const pinKey = (p: Pin) =>
  `${sanitizeName(p.matchedAddress.slice(0, 120))}|${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`;

export interface SaveLinkedResult {
  /** How many linked places were stored. */
  added: number;
  /** A linked place didn't fit: MAX_PINS places are already saved. */
  full: boolean;
  /** This browser wouldn't keep a place (storage blocked or full). */
  storageFailed: boolean;
}

/**
 * "Save to this device" on a shared link: add the linked places that
 * aren't already saved (same address, same spot to 4 decimals), stopping
 * at MAX_PINS. Fresh ids, so a link's wl0 never replaces an earlier one.
 * Says how many were added and why any weren't.
 */
export function saveLinkedPins(linked: Pin[]): SaveLinkedResult {
  const existing = loadPins();
  const seen = new Set(existing.map(pinKey));
  let count = existing.length;
  const result: SaveLinkedResult = { added: 0, full: false, storageFailed: false };
  for (const p of linked) {
    const k = pinKey(p);
    // Already saved is fine even on a full board; only a new place is "full".
    if (seen.has(k)) continue;
    if (count >= MAX_PINS) {
      result.full = true;
      break;
    }
    const r = addPin({ ...p, id: newPinId() });
    if (r.ok) {
      seen.add(k);
      count++;
      result.added++;
    } else if (r.reason === "full") {
      result.full = true;
      break;
    } else {
      result.storageFailed = true;
      break;
    }
  }
  return result;
}

/**
 * What to say after Save to this device, or null to go to Your places.
 * Go when something was saved or everything already was; otherwise stay
 * on the shared answer and say why nothing was saved.
 */
export function saveLinkedNote(r: SaveLinkedResult): string | null {
  if (r.added > 0 || (!r.full && !r.storageFailed)) return null;
  return r.storageFailed ? copy.storageBlocked : copy.placesFull(MAX_PINS);
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
  // Setup sends a place here when this browser wouldn't save it.
  const noSave = isLinked && params.get("nosave") === "1";
  const [copied, setCopied] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  // The what-if stage from the flood number slider, tied to the place and
  // gauge it was chosen for, so it is never drawn on another gauge's zero.
  const [whatIfPick, setWhatIfPick] = useState<WhatIfPick | null>(null);
  const origin = useOrigin();

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
        <p className="text-body text-dim">
          {isLinked ? copy.riverDataDownLinked : copy.riverDataDown}
        </p>
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
  const answerNow = now ?? new Date().toISOString();
  const sentence = verdictSentence({
    pinName: pin.name,
    verdict,
    gauge,
    now: answerNow,
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
  const lastFreshness = freshnessChip(watch, updatedAt);
  // After a failed check nothing on screen is live, however recent the
  // reading: drop "live · updated" and let refreshFailedLine give the time.
  // "data delayed" and "alerts checked {time}" are still true, so they stay.
  const freshness = error && lastFreshness?.live ? null : lastFreshness;
  // A failed refresh keeps the last good answer up; say how old it is.
  const refreshFailedLine =
    error && updatedAt !== null ? copy.refreshFailed(fmtTime(updatedAt)) : null;
  // Anything that leaves the screen (speech, a text message, a calendar
  // file, the share picture) carries the same warnings as the screen, in
  // screen order: staleness, a failed refresh, the approximate spot, then
  // the flood alerts (or that the alert service couldn't be reached).
  const alertNotes = alertNotesFor(watch);
  const leavingNotes = [
    staleLine,
    refreshFailedLine,
    pin.approximate ? copy.approximateShare : null,
    ...alertNotes,
  ];

  // "Your flood number": FULL tier with a trusted gauge zero only.
  const floodNumber = floodNumberInputFor(pin, watch);
  const whatIfKey = whatIfKeyFor(pin.id, gauge?.lid);
  const whatIf = whatIfFor(whatIfPick, whatIfKey, floodNumber?.gaugeZeroFt);
  const whatIfLine = whatIfCrest(floodNumber?.gaugeZeroFt, whatIf);
  const onWhatIf = (stageFt: number | null) =>
    setWhatIfPick(stageFt === null ? null : { key: whatIfKey, stageFt });

  const crestIso = crestAheadIso(watch, answerNow);
  const watchUrl = origin ? `${origin}/watch?wl=${encodeWatchLink([pin])}` : "";
  const copyLink = () => {
    const url = `${window.location.origin}/watch?wl=${encodeWatchLink([pin])}`;
    void copyWithFallback(url, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

      {/* The picture: always the forecast crest, like the sentence under
          it. The what-if slider draws its own picture inside its card. */}
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

      {/* An approximate pin (town or street point) must never pass for house-level math. */}
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
          {copy.alertServiceDown}
        </p>
      )}

      {/* What to do now, right after the alerts: on a likely or
          too-close day it comes before anything else to read. */}
      {needsNextSteps(watch) && <NextSteps />}

      {/* Your flood number (FULL only). Keyed by place, so another place
          starts back at the forecast; it reports null when it goes away.
          Off the forecast, its own picture shows the what-if level right
          under the slider. */}
      {floodNumber && (
        <FloodNumber key={pin.id} {...floodNumber} onWhatIf={onWhatIf}>
          {verdict.tier === "FULL" && whatIfLine && (
            <WaterScene
              markers={[{ label: pin.name, elevationFt: pin.elevationFt }]}
              currentWaterElevFt={verdict.currentWaterElevFt}
              {...whatIfLine}
            />
          )}
        </FloodNumber>
      )}

      {/* Actions: the reasoning first, then quiet ways to keep or pass on
          this answer. Read it to me and Send to family render only where
          the browser can do them. */}
      <div className="flex flex-col gap-1">
        <Link
          href={
            isLinked && wl !== null
              ? `/why?pin=${pin.id}&wl=${encodeURIComponent(wl)}${isExample ? "&ex=1" : ""}`
              : `/why?pin=${pin.id}`
          }
          className="inline-flex min-h-11 items-center self-start font-semibold text-(--color-current)"
        >
          {copy.whyLink}
        </Link>
        <div
          role="group"
          aria-label={copy.actionsLabel}
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
          data-testid="watch-actions"
        >
          <ReadAloud sentence={sentence} secondLine={glossLine} notes={leavingNotes} />
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
                {refreshFailedLine && <p style={noteStyle}>{refreshFailedLine}</p>}
                {pin.approximate && (
                  <p style={noteStyle}>
                    {copy.approximateTag}: {copy.approximateShare}
                  </p>
                )}
                {alertNotes.map((note) => (
                  <p key={note} style={noteStyle}>
                    {note}
                  </p>
                ))}
              </div>
            }
          />
          {watchUrl && (
            <SendToFamily
              pinName={pin.name}
              sentence={sentence}
              url={watchUrl}
              notes={leavingNotes}
              now={answerNow}
              onFallback={copyLink}
            />
          )}
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-11 items-center text-small font-semibold text-dim hover:text-(--color-current)"
          >
            <span aria-live="polite">
              {copied ? copy.linkCopied : copy.copyLink}
            </span>
          </button>
          {crestIso && (
            <AddToCalendar
              crestIso={crestIso}
              riverName={gauge ? riverName(gauge.name) : null}
              pinName={pin.name}
              sentence={sentence}
              url={watchUrl}
              now={answerNow}
              notes={leavingNotes}
            />
          )}
        </div>
        {noSave ? null : isLinked && linkedPins ? (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => {
                const note = saveLinkedNote(saveLinkedPins(linkedPins));
                if (note === null) router.push("/places");
                else setSaveNote(note);
              }}
              className="inline-flex min-h-11 items-center self-start font-semibold text-(--color-current)"
            >
              {copy.saveLinkedPins}
            </button>
            {/* Mounted before it has words, so the reason is announced. */}
            <p role="status" className="text-small" data-testid="save-note">
              {saveNote}
            </p>
          </div>
        ) : (
          <Link
            href="/places"
            className="inline-flex min-h-11 items-center self-start text-dim hover:text-(--color-current)"
          >
            {copy.placesTitle} →
          </Link>
        )}
      </div>

      {/* Past floods here (FULL only): a one-line summary that opens into
          the list, the levee caveat and the source. */}
      {verdict.tier === "FULL" && gauge && (
        <PastFloods
          pinName={pin.name}
          approximate={pin.approximate}
          pinElevationFt={pin.elevationFt}
          gaugeZeroFt={gauge.gaugeZeroFt}
          gaugeName={gauge.name}
          historicCrests={gauge.historicCrests}
          floodStageFt={gauge.categories.minor ?? null}
          now={answerNow}
          compact
        />
      )}

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
          {noSave ? copy.storageBlocked : copy.sharedLinkNote}
        </p>
      )}
    </div>
  );
}
