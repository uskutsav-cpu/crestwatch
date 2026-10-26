"use client";
import { useState, useEffect } from "react";
import { SiteLink as Link } from "@/components/experience/SiteLink";
import {
  Plus,
  ArrowRight,
  Trash2,
  Pencil,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { loadPins, removePin, renamePin } from "@/lib/pin-store";
import { useWatches } from "@/lib/use-watch";
import { isFresh, timeLabel } from "@/lib/river-stations";
import { EXAMPLE_HREF } from "@/lib/example";
import type { Pin } from "@/lib/pins";
export function Places() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [ready, setReady] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [removed, setRemoved] = useState<Pin | null>(null);
  const { watches, loading, error } = useWatches(pins);
  useEffect(() => {
    setPins(loadPins());
    setReady(true);
  }, []);
  return (
    <div className="page-enter places-page">
      <div className="page-title">
        <span className="eyebrow">KEEP WHAT MATTERS CLOSE</span>
        <h1>My places.</h1>
        <p>
          Your home, the way to school, a family member’s street. A little river
          context for the places you care about.
        </p>
      </div>
      <div className="section-heading">
        <span className="eyebrow">{pins.length} OF 5 PLACES SAVED</span>
        <Link className="primary-button" href="/?add=1#find-place">
          <Plus size={14} /> Add a place
        </Link>
      </div>
      {!ready ? (
        <div className="chart-loading">Opening your places…</div>
      ) : pins.length === 0 ? (
        <div className="empty-state">
          <svg className="place-illustration" viewBox="0 0 320 150" fill="none" aria-hidden="true">
            <path d="M14 121L81 77L125 98L190 42L305 121V140H14Z" fill="#e8ecdd"/>
            <path d="M14 121L81 77L125 98L190 42L305 121" stroke="#bcc8ab"/>
            <path d="M200 142C240 116 112 110 154 85C185 64 141 61 165 39" stroke="#7e9c83" strokeWidth="13"/>
            <path d="M200 142C240 116 112 110 154 85C185 64 141 61 165 39" stroke="#fffef8" strokeDasharray="3 5"/>
            <path d="M90 65C90 48 116 48 116 65C116 77 103 88 103 88S90 77 90 65Z" fill="#b85c38"/>
            <circle cx="103" cy="64" r="5" fill="#fff9e8"/>
            <circle cx="245" cy="42" r="12" fill="#e8d7ac"/>
            <path d="M32 139H294" stroke="#b9c3aa"/>
          </svg>
          <h2>Make yourself at home.</h2>
          <p>
            Save your first place to bring the closest available river forecast
            into view. Your places stay on this device.
          </p>
          <div className="action-row">
            <Link href="/?add=1#find-place" className="primary-button">
              Add my first place <ArrowRight size={16} />
            </Link>
            <Link href={EXAMPLE_HREF} className="secondary-button">
              Explore a live example
            </Link>
          </div>
        </div>
      ) : (
        <div className="saved-places">
          {pins.map((pin, i) => {
            const w = watches.find((x) => x.pinId === pin.id);
            const g = w?.gauge;
            const last = g?.observed.at(-1);
            return (
              <article className="saved-place" key={pin.id}>
                <span className="saved-place-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="saved-place-main">
                  {edit === pin.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setPins(renamePin(pin.id, name));
                        setEdit(null);
                      }}
                    >
                      <input
                        aria-label="Place name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={40}
                        autoFocus
                      />
                      <button aria-label="Save name" className="icon-button">
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Cancel rename"
                        onClick={() => setEdit(null)}
                      >
                        <X size={16} />
                      </button>
                    </form>
                  ) : (
                    <h2>
                      <Link href={`/watch?pin=${pin.id}`}>{pin.name}</Link>
                    </h2>
                  )}
                  <p>{pin.matchedAddress}</p>
                  <div className="saved-place-meta">
                    <span>
                      {pin.elevationFt === null
                        ? "Ground height unavailable"
                        : `${Math.round(pin.elevationFt)} ft estimated ground`}
                    </span>
                    <span>
                      {g?.name ??
                        (loading
                          ? "Reading nearby river…"
                          : "River data unavailable")}
                    </span>
                  </div>
                </div>
                <div className="saved-river-reading">
                  {last ? (
                    <>
                      <strong>
                        {last.stageFt.toFixed(1)}
                        <small> ft</small>
                      </strong>
                      <span>
                        {isFresh(last.t) && !error
                          ? "Gauge reading"
                          : "Older gauge reading"}{" "}
                        · {timeLabel(last.t)}
                      </span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="saved-place-actions">
                  <Link
                    href={`/watch?pin=${pin.id}`}
                    className="icon-button"
                    aria-label={`Open ${pin.name} briefing`}
                  >
                    <ArrowRight size={18} />
                  </Link>
                  <button
                    className="icon-button"
                    aria-label={`Rename ${pin.name}`}
                    onClick={() => {
                      setEdit(pin.id);
                      setName(pin.name);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${pin.name}`}
                    onClick={() => {
                      setRemoved(pin);
                      setPins(removePin(pin.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {removed && (
        <UndoRemoved
          pin={removed}
          onUndo={() => {
            setPins(loadPins());
            setRemoved(null);
          }}
          onDismiss={() => setRemoved(null)}
        />
      )}
      <div className="notice">
        <ShieldCheck size={17} />
        <p>
          No account, no tracking. Saved places live in this browser. Checking a
          place sends its coordinates to CrestWatch and public data services.
          Shared links include the names and addresses you choose to share.{" "}
          <Link href="/methodology#privacy">Read the privacy details →</Link>
        </p>
      </div>
      <div className="next-steps">
        <span className="eyebrow">A FIELD GUIDE, NOT AN ALARM</span>
        <h2>Keep official alerts switched on.</h2>
        <p>
          CrestWatch checks again while it’s open. It cannot send background
          flood warnings, and a nearby gauge cannot establish a property’s flood
          exposure.
        </p>
      </div>
    </div>
  );
}
import { addPin } from "@/lib/pin-store";
function UndoRemoved({
  pin,
  onUndo,
  onDismiss,
}: {
  pin: Pin;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="undo-note" role="status">
      <span>
        {pin.name} removed. {error}
      </span>
      <button
        onClick={() => {
          const r = addPin(pin);
          if (r.ok) onUndo();
          else setError("Could not restore this place.");
        }}
      >
        Undo
      </button>
      <button onClick={onDismiss} aria-label="Dismiss removal note">
        <X size={14} />
      </button>
    </div>
  );
}
