"use client";

/**
 * "Add the crest to my calendar": a one-event .ics file for the forecast
 * crest, with a reminder before it. Made in the browser and saved through
 * a Blob URL, so nothing is sent anywhere and no account is needed.
 *
 * The file holds one forecast and forecasts change, so its description
 * says so and links back to the live watch. It shows only while the
 * crest is still ahead.
 */

import { useState } from "react";
import { copy } from "@/lib/copy";
import { buildCrestIcs, icsUtc } from "@/lib/ics";
import { ACTION_BUTTON } from "@/components/watch/ReadAloud";

export const CALENDAR_FILENAME = "crestwatch-crest.ics";
export const CALENDAR_MIME = "text/calendar;charset=utf-8";
/** The crest is a moment, but "around 12pm" needs a block you can see. */
export const CREST_EVENT_MIN = 60;
/** Long enough for any browser to have started the download. */
export const REVOKE_AFTER_MS = 10_000;

const HOUR_MS = 3_600_000;

/** 12 hours ahead, or 1 hour when the crest is closer than 12 hours. */
export function reminderMinutesBefore(crestMs: number, nowMs: number): number {
  return crestMs - nowMs >= 12 * HOUR_MS ? 12 * 60 : 60;
}

/** The crest is a real time, still ahead of `now`. */
export function isFutureCrest(crestIso: string, now: string | number): boolean {
  const c = Date.parse(crestIso);
  const n = typeof now === "number" ? now : Date.parse(now);
  return Number.isFinite(c) && Number.isFinite(n) && c > n;
}

/** "River crest: Pearl River near Home", or without a river name when there isn't one. */
export function calendarTitle(riverName: string | null | undefined, pinName: string): string {
  const river = riverName?.trim();
  return river ? copy.calendarTitle(river, pinName) : copy.calendarTitleNoRiver(pinName);
}

/** FNV-1a, 32 bits: a short, stable tag for the uid. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface CrestCalendarInput {
  /** The forecast crest time (FULL: verdict.peak.t, CATEGORY: verdict.peakT). */
  crestIso: string;
  /** riverName(gauge.name) from lib/sentences, or null when there's no gauge name. */
  riverName: string | null;
  pinName: string;
  /** The verdict sentence, exactly as shown. */
  sentence: string;
  /** The live watch link for this place. */
  url: string;
  /** Honesty lines that must travel with the sentence (stale, approximate spot). */
  notes?: ReadonlyArray<string | null | undefined>;
}

/**
 * The .ics text for this crest, or null when the crest isn't a real
 * future time. Same crest, river and place give the same uid, so adding
 * it twice updates one event in most calendar apps instead of making two.
 */
export function crestCalendarFile(input: CrestCalendarInput, nowMs: number): string | null {
  const crestMs = Date.parse(input.crestIso);
  if (!Number.isFinite(nowMs) || !isFutureCrest(input.crestIso, nowMs)) return null;
  const title = calendarTitle(input.riverName, input.pinName);
  const description = [input.sentence, ...(input.notes ?? []), copy.calendarCheckLatest(input.url)]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join("\n\n");
  return buildCrestIcs({
    uid: `crest-${icsUtc(crestMs)}-${fnv1a(`${input.riverName ?? ""}|${input.pinName}`)}@crestwatch`,
    title,
    startIso: new Date(crestMs).toISOString(),
    durationMin: CREST_EVENT_MIN,
    description,
    url: input.url,
    alarmMinutesBefore: reminderMinutesBefore(crestMs, nowMs),
    nowIso: new Date(nowMs).toISOString(),
    alarmText: copy.calendarAlarm,
  });
}

type AnchorLike = Pick<HTMLAnchorElement, "href" | "download" | "rel" | "click" | "remove">;

/** The browser pieces a download needs, swappable in tests. */
export interface DownloadEnv {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => AnchorLike;
  attach: (a: AnchorLike) => void;
  later: (fn: () => void, ms: number) => void;
}

function browserDownloadEnv(): DownloadEnv {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
    attach: (a) => {
      document.body.appendChild(a as HTMLAnchorElement);
    },
    later: (fn, ms) => {
      window.setTimeout(fn, ms);
    },
  };
}

/**
 * Save `text` as a file through a Blob URL, then revoke the URL a little
 * later (revoking at once can cancel the download in Safari and Firefox).
 * True when the download was started.
 */
export function downloadTextFile(
  text: string,
  filename: string,
  type: string,
  env: DownloadEnv = browserDownloadEnv(),
): boolean {
  let href: string | null = null;
  try {
    href = env.createObjectURL(new Blob([text], { type }));
    const a = env.createAnchor();
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    env.attach(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    if (href !== null) {
      const made = href;
      env.later(() => env.revokeObjectURL(made), REVOKE_AFTER_MS);
    }
  }
}

export interface AddToCalendarProps extends CrestCalendarInput {
  /** The answer's "now" (useWatches().now ?? new Date().toISOString()). */
  now: string;
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

export function AddToCalendar({ now, ...input }: AddToCalendarProps) {
  const [saved, setSaved] = useState(false);
  // The crest passed while the page sat open: the button goes away.
  const [passed, setPassed] = useState(false);

  if (passed || !isFutureCrest(input.crestIso, now)) return null;

  function save() {
    // The answer's clock, or this device's if it's later (the page may
    // have sat open since the last check).
    const nowMs = Math.max(Date.parse(now), Date.now());
    const ics = crestCalendarFile(input, nowMs);
    if (ics === null) {
      setPassed(true);
      return;
    }
    if (downloadTextFile(ics, CALENDAR_FILENAME, CALENDAR_MIME)) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      data-testid="add-to-calendar"
      className={ACTION_BUTTON}
    >
      <CalendarIcon />
      <span aria-live="polite">{saved ? copy.calendarSaved : copy.addToCalendar}</span>
    </button>
  );
}
