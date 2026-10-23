"use client";

/**
 * Pin persistence — the visitor's own localStorage, nothing else
 * (Appendix A privacy stance). Capped at MAX_PINS.
 */

import { MAX_PINS, STORAGE_KEYS } from "@/lib/config";
import { isPin, sanitizeName, type Pin } from "@/lib/pins";

/** What a pin with no usable name is called. */
const FALLBACK_NAME = "My place";

export function loadPins(): Pin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pins);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    // Old, corrupt, or hand-edited entries must never crash a screen or
    // print a sentence with no subject. Drop bad shapes, clean names the
    // same way addPin does, and keep only the first pin for each id.
    const seen = new Set<string>();
    const pins: Pin[] = [];
    for (const p of parsed) {
      if (!isPin(p) || seen.has(p.id)) continue;
      seen.add(p.id);
      pins.push({ ...p, name: sanitizeName(p.name) || FALLBACK_NAME });
      if (pins.length >= MAX_PINS) break;
    }
    return pins;
  } catch {
    return [];
  }
}

/** True only when the write went through. */
function persist(pins: Pin[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.pins, JSON.stringify(pins.slice(0, MAX_PINS)));
    return true;
  } catch {
    // storage blocked or full — pins won't survive a reload
    return false;
  }
}

export type AddPinResult =
  /** Saved. `pins` is the stored list, the new pin included. */
  | { ok: true; pin: Pin; pins: Pin[] }
  /** Not saved: MAX_PINS places are already stored. Nothing changed. */
  | { ok: false; reason: "full"; pins: Pin[] }
  /** Not saved: this browser won't keep anything. `pin` is the cleaned pin. */
  | { ok: false; reason: "storage"; pin: Pin; pins: Pin[] };

/**
 * Save a pin, or replace the stored pin with the same id. Never drops a
 * pin quietly: the caller learns whether it stuck and why not.
 */
export function addPin(pin: Pin): AddPinResult {
  const clean = { ...pin, name: sanitizeName(pin.name) || FALLBACK_NAME };
  const existing = loadPins();
  const replacing = existing.some((p) => p.id === clean.id);
  if (!replacing && existing.length >= MAX_PINS) {
    return { ok: false, reason: "full", pins: existing };
  }
  const pins = replacing
    ? existing.map((p) => (p.id === clean.id ? clean : p))
    : [...existing, clean];
  // Read it back: some browsers accept the write and keep nothing.
  if (!persist(pins) || !loadPins().some((p) => p.id === clean.id)) {
    return { ok: false, reason: "storage", pin: clean, pins: existing };
  }
  return { ok: true, pin: clean, pins };
}

export function renamePin(id: string, name: string): Pin[] {
  const clean = sanitizeName(name).slice(0, 40);
  if (!clean) return loadPins();
  const pins = loadPins().map((p) => (p.id === id ? { ...p, name: clean } : p));
  persist(pins);
  return pins;
}

export function removePin(id: string): Pin[] {
  const pins = loadPins().filter((p) => p.id !== id);
  persist(pins);
  return pins;
}

export function clearAllPins(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.pins);
  } catch {
    // nothing to clear
  }
}

export function newPinId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
