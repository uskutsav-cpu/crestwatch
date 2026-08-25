"use client";

/**
 * Pin persistence — the visitor's own localStorage, nothing else
 * (Appendix A privacy stance). Capped at MAX_PINS.
 */

import { MAX_PINS, STORAGE_KEYS } from "@/lib/config";
import type { Pin } from "@/lib/pins";

export function loadPins(): Pin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pins);
    const pins = raw ? (JSON.parse(raw) as Pin[]) : [];
    return Array.isArray(pins) ? pins.slice(0, MAX_PINS) : [];
  } catch {
    return [];
  }
}

function persist(pins: Pin[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.pins, JSON.stringify(pins.slice(0, MAX_PINS)));
  } catch {
    // storage blocked — pins won't survive a reload
  }
}

export function addPin(pin: Pin): Pin[] {
  const pins = [...loadPins().filter((p) => p.id !== pin.id), pin].slice(
    0,
    MAX_PINS,
  );
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
