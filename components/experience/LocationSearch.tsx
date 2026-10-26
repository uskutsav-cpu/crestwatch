"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Search,
  X,
  MapPin,
  LoaderCircle,
  ShieldCheck,
  Info,
} from "lucide-react";
import { groundHeightOrSkip, inSupportedBounds } from "@/lib/location-save";
import { RiverMap } from "./RiverMap";
import { addPin, newPinId } from "@/lib/pin-store";
import { encodeWatchLink } from "@/lib/watch-link";
import { EXAMPLE_HREF } from "@/lib/example";
import { SiteLink as Link } from "@/components/experience/SiteLink";
export function LocationSearch() {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"search" | "confirm">("search");
  const [error, setError] = useState("");
  const [found, setFound] = useState<{
    lat: number;
    lon: number;
    matchedAddress: string;
    precision: string;
  } | null>(null);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [name, setName] = useState("My place");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const skipGround = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (params.get("add") === "1") input.current?.focus();
    return () => abort.current?.abort();
  }, [params]);
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (busy || query.trim().length < 3) return;
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/locate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: query.trim() }),
        signal: abort.current.signal,
      });
      const d = (await res.json()) as {
        ok: boolean;
        error?: string;
        point: {
          lat: number;
          lon: number;
          matchedAddress: string;
          precision: string;
        };
      };
      if (!d.ok) throw Error(d.error);
      setFound(d.point);
      setPoint({ lat: d.point.lat, lon: d.point.lon });
      setName(query.split(",")[0].slice(0, 40) || "My place");
      setPhase("confirm");
      dialog.current?.showModal();
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError((e as Error).message || "Unable to find this location.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!point || !found || busy) return;
    if (!inSupportedBounds(point)) {
      setError(
        "Keep this location within the Mississippi coverage area. Check the latitude and longitude.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const elevationFt = await groundHeightOrSkip(
        point,
        fetch,
        controller.signal,
        (skip) => {
          skipGround.current = skip;
        },
      );
      if (controller.signal.aborted) return;
      const pin = {
        id: newPinId(),
        name: name.trim() || "My place",
        matchedAddress: found.matchedAddress,
        ...point,
        elevationFt,
        approximate: true,
      };
      const result = addPin(pin);
      if (!result.ok && result.reason === "full") {
        setError(
          "You already have five places. Remove a place from My places first.",
        );
        return;
      }
      dialog.current?.close();
      window.location.assign(
        result.ok
          ? `/watch?pin=${pin.id}`
          : `/watch?wl=${encodeWatchLink([pin])}&nosave=1`,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setError("Unable to save this place. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="location-search" onSubmit={lookup}>
        <Search size={18} />
        <input
          ref={input}
          aria-label="Address, town, or ZIP"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a Mississippi address, town, or ZIP"
          maxLength={200}
          required
          minLength={3}
        />
        <button
          className="primary-button"
          disabled={busy || query.trim().length < 3}
        >
          {busy ? (
            <>
              <LoaderCircle className="spin" size={16} /> Finding your place
            </>
          ) : (
            <>
              Check my place <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
      {error && phase === "search" && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        className="place-dialog"
        onCancel={() => {
          if (busy) abort.current?.abort();
          setPhase("search");
          setError("");
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">A PLACE THAT MATTERS</span>
            <h2>Let’s get your bearings.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close location confirmation"
            onClick={() => {
              dialog.current?.close();
              setPhase("search");
              setError("");
            }}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        {found && point && (
          <>
            <p className="found-address">
              <MapPin size={16} />
              {found.matchedAddress}
            </p>
            <div inert={busy}>
              <RiverMap point={point} onMove={setPoint} compact />
            </div>
            <p className="muted small">
              Drag the marker or tap the map to adjust. Address coordinates are
              approximate; this is not a property survey.
            </p>
            <details className="coordinate-details">
              <summary>Adjust coordinates with a keyboard</summary>
              <div>
                <label>
                  Latitude
                  <input
                    type="number"
                    aria-label="Location latitude"
                    disabled={busy}
                    step="0.00001"
                    min="29"
                    max="35.2"
                    value={point.lat}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) setPoint({ ...point, lat: v });
                    }}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    aria-label="Location longitude"
                    disabled={busy}
                    step="0.00001"
                    min="-91.8"
                    max="-88"
                    value={point.lon}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) setPoint({ ...point, lon: v });
                    }}
                  />
                </label>
              </div>
            </details>
            <label className="field-label">
              Call this place
              <input
                disabled={busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
            </label>
            <div className="notice">
              <Info size={17} />
              <p>
                We’ll show a nearby river forecast and estimated ground height.
                Proximity does not prove that river can flood this location.
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error} <Link href={EXAMPLE_HREF}>Open live example →</Link>
              </p>
            )}
            <div className="dialog-actions">
              <span>
                <ShieldCheck size={14} /> Saved only in this browser
              </span>
              <button className="primary-button" onClick={save} disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={15} /> Reading ground
                    height…
                  </>
                ) : (
                  <>
                    Save & see briefing <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
            {busy && (
              <button
                className="text-button skip-ground-button"
                onClick={() => skipGround.current?.()}
              >
                Open briefing without ground height <ArrowRight size={14} />
              </button>
            )}
            <p className="muted small">
              Finding ground height can take up to 20 seconds. If it is
              unavailable, your place still saves with its nearby river
              briefing. Address searches go to public geocoding services; map
              tiles are provided by OpenStreetMap.
            </p>
          </>
        )}
      </dialog>
    </>
  );
}
