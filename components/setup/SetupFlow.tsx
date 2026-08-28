"use client";

/**
 * S1 setup flow (T06): address → confirm card → optional second pin →
 * /watch. Typed addresses only — no GPS, no map. Pins go straight to
 * localStorage; the server remembers nothing.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy } from "@/lib/copy";
import { ButtonGhost, ButtonPrimary } from "@/components/ui";
import { addPin, loadPins, newPinId } from "@/lib/pin-store";
import type { LookupResult } from "@/lib/watch-service";

type Phase = "enter" | "confirm";

export function SetupFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("enter");
  const [address, setAddress] = useState("");
  const [pinName, setPinName] = useState("Home");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [found, setFound] = useState<Extract<LookupResult, { ok: true }> | null>(
    null,
  );
  const [isSecondPin, setIsSecondPin] = useState(false);

  async function lookup() {
    const a = address.trim();
    if (a.length < 3 || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: a }),
      });
      const json = (await res.json()) as LookupResult | { error?: string };
      if ("ok" in json && json.ok) {
        setFound(json);
        setPhase("confirm");
      } else {
        setNote(copy.addressNotFound);
      }
    } catch {
      setNote(copy.addressNotFound);
    }
    setBusy(false);
  }

  function savePin(): string {
    if (!found) return "";
    const id = newPinId();
    addPin({
      id,
      name: pinName.trim() || (isSecondPin ? "The road" : "Home"),
      matchedAddress: found.matchedAddress,
      lat: found.lat,
      lon: found.lon,
      elevationFt: found.elevationFt,
      approximate: found.precision === "place",
    });
    return id;
  }

  function confirmAndFinish() {
    savePin();
    const pins = loadPins();
    router.push(pins.length > 1 ? "/places" : "/watch");
  }

  function confirmAndAddSecond() {
    savePin();
    setIsSecondPin(true);
    setAddress("");
    setPinName("The road");
    setFound(null);
    setPhase("enter");
  }

  /* ---------------- confirm ---------------- */
  if (phase === "confirm" && found) {
    return (
      <div className="flex w-full max-w-xl flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-small text-dim">{found.matchedAddress}</p>
            {found.precision === "place" && (
              <span className="rounded-full border border-risewatch/60 px-2 py-0.5 text-small font-semibold text-risewatch">
                {copy.approximateTag}
              </span>
            )}
          </div>
          <p className="mt-2 text-h2">
            {copy.confirmSpot(found.elevationFt.toFixed(1))}
          </p>
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
              className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-body text-fg focus:border-(--color-current) focus:outline-none"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonPrimary onClick={confirmAndFinish}>{copy.done}</ButtonPrimary>
          {!isSecondPin && (
            <ButtonGhost onClick={confirmAndAddSecond}>
              {copy.addPin}
            </ButtonGhost>
          )}
          <ButtonGhost
            onClick={() => {
              setFound(null);
              setPhase("enter");
            }}
          >
            Edit address
          </ButtonGhost>
        </div>
      </div>
    );
  }

  /* ---------------- enter ---------------- */
  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
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
          type="text"
          autoComplete="off"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={copy.addressPlaceholder}
          aria-label="Address, town, or ZIP"
          className="h-13 flex-1 rounded-xl border border-line bg-surface px-4 text-body text-fg placeholder:text-dim focus:border-(--color-current) focus:outline-none"
        />
        <ButtonPrimary type="submit" disabled={busy || address.trim().length < 3}>
          {busy ? copy.looking : copy.cta}
        </ButtonPrimary>
      </form>
      {note && (
        <p className="rounded-xl border border-risewatch/50 bg-surface p-3 text-small">
          {note}
        </p>
      )}
    </div>
  );
}
