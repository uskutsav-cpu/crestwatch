"use client";

/**
 * S1 setup flow (T06): address → confirm card → optional second pin →
 * /watch. Typed addresses only — no GPS, no map. Pins go straight to
 * localStorage; the server remembers nothing.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { copy } from "@/lib/copy";
import { MAX_PINS } from "@/lib/config";
import { ButtonGhost, ButtonPrimary } from "@/components/ui";
import {
  addPin,
  loadPins,
  newPinId,
  type AddPinResult,
} from "@/lib/pin-store";
import { EXAMPLE_HREF } from "@/lib/example";
import { encodeWatchLink } from "@/lib/watch-link";
import type { LookupResult } from "@/lib/watch-service";

type Phase = "enter" | "confirm";

/** How long a lookup has run: 0 finding, 1 measuring, 2 slow. */
type Stage = 0 | 1 | 2;
const MEASURING_AFTER_MS = 4_000;
const SLOW_AFTER_MS = 12_000;
const STAGE_TEXT: Record<Stage, string> = {
  0: copy.lookupFinding,
  1: copy.lookupMeasuring,
  2: copy.lookupSlow,
};

/** Notes where running the same lookup again can simply work. */
const RETRYABLE: readonly string[] = [
  copy.elevationUnavailable,
  copy.lookupUpstream,
];

const PLACES_FULL = copy.placesFull(MAX_PINS);

const linkClasses =
  "inline-flex min-h-11 items-center self-start text-small font-semibold text-(--color-current) hover:underline";

export function SetupFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("enter");
  const [address, setAddress] = useState("");
  const [pinName, setPinName] = useState("Home");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>(0);
  const [note, setNote] = useState<string | null>(null);
  const [found, setFound] = useState<Extract<LookupResult, { ok: true }> | null>(
    null,
  );
  const [isSecondPin, setIsSecondPin] = useState(false);
  // Places already saved. Read after mount, never during render: this
  // page is server-rendered and the server has no localStorage.
  const [pinCount, setPinCount] = useState(0);
  const confirmRef = useRef<HTMLFormElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Synchronous guards: a double click lands before React re-renders.
  const inFlight = useRef(false);
  const saving = useRef(false);
  const focusInputNext = useRef(false);

  useEffect(() => {
    // One read of browser storage once hydrated.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinCount(loadPins().length);
  }, []);

  // A lookup can wait a long time on a slow federal service. Say what's
  // happening as the wait grows, so nobody thinks the page froze. Both
  // timers die when the lookup ends or the page goes away.
  useEffect(() => {
    if (!busy) return;
    const toMeasuring = setTimeout(() => setStage(1), MEASURING_AFTER_MS);
    const toSlow = setTimeout(() => setStage(2), SLOW_AFTER_MS);
    return () => {
      clearTimeout(toMeasuring);
      clearTimeout(toSlow);
    };
  }, [busy]);

  useEffect(() => {
    if (phase === "confirm") {
      // Put screen-reader focus on the answer ("Your spot sits…"). On
      // small phones the hero pushes the card below the fold, so bring
      // it into view too.
      headRef.current?.focus({ preventScroll: true });
      confirmRef.current?.scrollIntoView({ block: "start" });
    } else {
      // The confirm buttons are gone now, so a new save may start.
      saving.current = false;
    }
  }, [phase]);

  // Back to the address box (failed lookup, Edit address, second place):
  // put focus where the person types next.
  useEffect(() => {
    if (phase === "enter" && !busy && focusInputNext.current) {
      focusInputNext.current = false;
      inputRef.current?.focus();
    }
  }, [phase, busy]);

  async function lookup() {
    const a = address.trim();
    if (a.length < 3 || inFlight.current) return;
    // A full list can't take another place. Say so before the wait.
    const saved = loadPins().length;
    if (saved >= MAX_PINS) {
      setNote(null);
      setPinCount(saved);
      return;
    }
    inFlight.current = true;
    setStage(0);
    setBusy(true);
    setNote(null);
    let ok = false;
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: a }),
      });
      // A platform timeout or proxy error comes back as HTML, not JSON.
      const json = (await res.json().catch(() => ({
        error: "UPSTREAM",
      }))) as LookupResult | { error?: string };
      if ("ok" in json && json.ok) {
        ok = true;
        setFound(json);
        setPhase("confirm");
      } else {
        // Say which thing failed. "We couldn't find that address" is a lie
        // when we found it fine and a federal service was simply slow.
        const err = (json as { error?: string }).error;
        setNote(
          err === "NO_ELEVATION"
            ? copy.elevationUnavailable
            : err === "UPSTREAM"
              ? copy.lookupUpstream
              : err === "RATE_LIMITED"
                ? copy.rateLimited
                : copy.addressNotFound,
        );
      }
    } catch {
      // The request never got an answer: that's the connection, not the
      // address the person typed.
      setNote(copy.lookupOffline);
    }
    inFlight.current = false;
    // The input was disabled while busy, which drops focus. Give it back.
    if (!ok) focusInputNext.current = true;
    setBusy(false);
  }

  function savePin(): AddPinResult | null {
    if (!found) return null;
    return addPin({
      id: newPinId(),
      name: pinName.trim() || (isSecondPin ? "The road" : "Home"),
      matchedAddress: found.matchedAddress,
      lat: found.lat,
      lon: found.lon,
      elevationFt: found.elevationFt,
      approximate: found.precision === "place",
    });
  }

  /** The pin didn't stick. Say why, and never strand the answer. */
  function onSaveFailed(res: Extract<AddPinResult, { ok: false }>) {
    if (res.reason === "storage") {
      // This browser keeps nothing, but a Watch Link needs no storage,
      // so the person still sees the verdict they came for.
      setNote(copy.storageBlocked);
      router.push(`/watch?wl=${encodeWatchLink([res.pin])}`);
      return; // leaving the page: keep the save guard up
    }
    setPinCount(res.pins.length);
    setNote(PLACES_FULL);
    saving.current = false;
  }

  function confirmAndFinish() {
    if (saving.current) return;
    saving.current = true;
    const res = savePin();
    if (!res) {
      saving.current = false;
      return;
    }
    if (!res.ok) {
      onSaveFailed(res);
      return;
    }
    router.push(res.pins.length > 1 ? "/places" : "/watch");
  }

  function confirmAndAddSecond() {
    if (saving.current) return;
    saving.current = true;
    const res = savePin();
    if (!res) {
      saving.current = false;
      return;
    }
    if (!res.ok) {
      onSaveFailed(res);
      return;
    }
    setPinCount(res.pins.length);
    setIsSecondPin(true);
    setAddress("");
    setPinName("The road");
    setFound(null);
    setNote(null);
    focusInputNext.current = true;
    setPhase("enter"); // the phase effect lowers the save guard
  }

  function editAddress() {
    setFound(null);
    setNote(null);
    focusInputNext.current = true;
    setPhase("enter");
  }

  const full = pinCount >= MAX_PINS;
  const retryable = !busy && note !== null && RETRYABLE.includes(note);

  let body: ReactNode;
  if (phase === "confirm" && found) {
    /* ---------------- confirm ---------------- */
    body = (
      <form
        ref={confirmRef}
        className="flex w-full scroll-mt-20 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          confirmAndFinish();
        }}
      >
        <div className="rounded-2xl bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-small text-dim">{found.matchedAddress}</p>
            {found.precision === "place" && (
              <span className="rounded-full border border-risewatch/60 px-2 py-0.5 text-small font-semibold text-risewatch">
                {copy.approximateTag}
              </span>
            )}
          </div>
          <h2
            ref={headRef}
            tabIndex={-1}
            className="mt-2 text-h2 focus:outline-none"
          >
            {copy.confirmSpot(found.elevationFt.toFixed(1))}
          </h2>
          {found.precision === "place" && (
            <p className="mt-2 text-small text-risewatch">
              {copy.approximateNote}
            </p>
          )}
          <p className="mt-1 text-body text-dim tnum">
            {found.gauge
              ? copy.confirmGauge(
                  found.gauge.name,
                  found.gauge.distanceMi.toFixed(1),
                )
              : copy.noGaugeHeadline}
          </p>
          <label className="mt-4 block text-small text-dim">
            Call this place
            <input
              value={pinName}
              onChange={(e) => setPinName(e.target.value)}
              maxLength={40}
              className="mt-1 block w-full rounded-xl bg-bg px-3 py-2 ring-1 ring-inset ring-(--color-dim) text-body text-fg focus:outline-none focus:ring-(--color-current)"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonPrimary type="submit">{copy.done}</ButtonPrimary>
          {/* No second slot when this pin fills the last one. */}
          {!isSecondPin && pinCount < MAX_PINS - 1 && (
            <ButtonGhost type="button" onClick={confirmAndAddSecond}>
              {copy.addPin}
            </ButtonGhost>
          )}
          <ButtonGhost type="button" onClick={editAddress}>
            Edit address
          </ButtonGhost>
        </div>
      </form>
    );
  } else if (full) {
    /* ---------------- full ---------------- */
    body = (
      <>
        <p className="rounded-2xl bg-surface p-5 text-body">{PLACES_FULL}</p>
        <Link href="/places" className={linkClasses}>
          {copy.placesTitle} →
        </Link>
        {!isSecondPin && (
          <Link href={EXAMPLE_HREF} className={linkClasses}>
            {copy.exampleLink}
          </Link>
        )}
      </>
    );
  } else {
    /* ---------------- enter ---------------- */
    body = (
      <>
        {isSecondPin && (
          <p className="text-body text-dim">{copy.addPin.replace("+ ", "")}</p>
        )}
        <form
          className="flex w-full flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={busy}
            placeholder={copy.addressPlaceholder}
            aria-label="Address, town, or ZIP"
            aria-invalid={note ? true : undefined}
            aria-describedby={note ? "lookup-note" : undefined}
            className="h-13 shrink-0 rounded-xl bg-surface px-4 sm:flex-1 sm:shrink ring-1 ring-inset ring-(--color-dim) text-body text-fg placeholder:text-dim disabled:text-dim focus:outline-none focus:ring-(--color-current)"
          />
          <ButtonPrimary type="submit" disabled={busy || address.trim().length < 3}>
            {/* The long slow-service sentence goes in the status line;
                the button keeps a label that fits. */}
            {busy
              ? stage === 0
                ? copy.lookupFinding
                : copy.lookupMeasuring
              : copy.cta}
          </ButtonPrimary>
        </form>
        <p className="text-small text-dim">{copy.addressHint}</p>
        {isSecondPin ? (
          <ButtonGhost
            type="button"
            className="sm:self-start"
            onClick={() => router.push("/watch")}
          >
            {copy.skipSecond}
          </ButtonGhost>
        ) : (
          <Link href={EXAMPLE_HREF} className={linkClasses}>
            {copy.exampleLink}
          </Link>
        )}
      </>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      {body}
      {/* Live regions stay in the DOM the whole time and only their text
          changes: some screen readers skip a region inserted already
          filled. */}
      <p role="status" className={busy ? "text-small text-dim" : "sr-only"}>
        {busy ? STAGE_TEXT[stage] : ""}
      </p>
      <p
        id="lookup-note"
        role="alert"
        className={note ? "rounded-xl bg-risewatch/10 p-3 text-small" : "sr-only"}
      >
        {note ?? ""}
      </p>
      {retryable && (
        <ButtonGhost
          type="button"
          className="sm:self-start"
          onClick={() => void lookup()}
        >
          {copy.tryAgain}
        </ButtonGhost>
      )}
      {phase === "confirm" && note === PLACES_FULL && (
        <Link href="/places" className={linkClasses}>
          {copy.placesTitle} →
        </Link>
      )}
    </div>
  );
}
