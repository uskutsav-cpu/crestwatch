"use client";

/**
 * "Add the crest to my calendar": a one-event .ics file for the forecast
 * crest, with a reminder before it. Made in the browser and saved through
 * a Blob URL, so nothing is sent anywhere and no account is needed.
 *
 * The file holds one forecast and forecasts change, so its description
 * says so and links back to the live watch. It shows only while the
 * crest is still ahead.
 *
 * The file is read later, often on another day, and the sentence says
 * "today", "tomorrow" or a weekday. So the description starts with the
 * date and time CrestWatch said it ("On Fri, Oct 23, 2:00 PM CT,
 * CrestWatch said:"), the same way a stale answer switches to dates.
 */

import { useState } from "react";
import { copy } from "@/lib/copy";
import { buildCrestIcs, icsUtc } from "@/lib/ics";
import { ACTION_BUTTON, ACTION_BUTTON_INERT } from "@/components/watch/ReadAloud";

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

const SAID_AT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * "On Fri, Oct 23, 2:00 PM CT, CrestWatch said:", for an answer that is
 * saved or sent and read later. `atMs` is the moment the sentence's day
 * words count from (the answer's now), not the moment of the tap. Null
 * when that isn't a real time.
 */
export function saidAtLine(atMs: number): string | null {
  if (!Number.isFinite(atMs)) return null;
  // Newer ICU puts a narrow no-break space before "PM"; a plain space
  // reads the same everywhere and keeps a text message plain.
  const when = SAID_AT.format(atMs).replace(/[  ]/g, " ");
  return copy.answerAsOf(`${when} CT`);
}

const nonBlank = (s: string | null | undefined): s is string =>
  typeof s === "string" && s.trim() !== "";

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
 *
 * `nowMs` is the clock the file is made by (the crest check, DTSTAMP and
 * the reminder). `saidAtMs` is when the sentence was worked out, which
 * is what its "today" and "tomorrow" mean; it leads the description.
 */
export function crestCalendarFile(
  input: CrestCalendarInput,
  nowMs: number,
  saidAtMs: number = nowMs,
): string | null {
  const crestMs = Date.parse(input.crestIso);
  if (!Number.isFinite(nowMs) || !isFutureCrest(input.crestIso, nowMs)) return null;
  // Without a date for its day words, the sentence can't go in a file.
  const said = saidAtLine(saidAtMs);
  if (said === null) return null;
  const title = calendarTitle(input.riverName, input.pinName);
  const description = [
    `${said}\n${input.sentence.trim()}`,
    ...(input.notes ?? []).filter(nonBlank),
    copy.calendarCheckLatest(input.url),
  ].join("\n\n");
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

type AnchorLike = Pick<HTMLAnchorElement, "href" | "download" | "rel" | "click"> & { remove: () => void };

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
  /**
   * The answer's "now", the same one the sentence was built with
   * (useWatches().now ?? new Date().toISOString()).
   */
  now: string;
}

/**
 * - "hidden": no crest ahead by the answer's clock, so no button.
 * - "passed": a tap found this crest already gone by the device clock.
 *   The button stays (so focus isn't dropped) and says so, until new
 *   data brings a different crest or the answer's clock passes it too.
 * - "ready": the button.
 */
export type CalendarButtonState = "hidden" | "passed" | "ready";

export function calendarButtonState(
  crestIso: string,
  now: string,
  passedCrest: string | null,
): CalendarButtonState {
  if (!isFutureCrest(crestIso, now)) return "hidden";
  return passedCrest === crestIso ? "passed" : "ready";
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
  // The crest a tap found already gone (the page sat open past it). Tied
  // to that crest, so a refresh that brings a later crest (a second rise)
  // brings the button back.
  const [passedCrest, setPassedCrest] = useState<string | null>(null);

  const state = calendarButtonState(input.crestIso, now, passedCrest);
  if (state === "hidden") return null;
  const passed = state === "passed";

  function save() {
    if (passed) return;
    const saidAtMs = Date.parse(now);
    // The answer's clock, or this device's if it's later (the page may
    // have sat open since the last check).
    const nowMs = Math.max(saidAtMs, Date.now());
    const ics = crestCalendarFile(input, nowMs, saidAtMs);
    if (ics === null) {
      setPassedCrest(input.crestIso);
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
      aria-disabled={passed || undefined}
      data-testid="add-to-calendar"
      className={passed ? ACTION_BUTTON_INERT : ACTION_BUTTON}
    >
      <CalendarIcon />
      <span aria-live="polite">
        {passed ? copy.calendarPassed : saved ? copy.calendarSaved : copy.addToCalendar}
      </span>
    </button>
  );
}
