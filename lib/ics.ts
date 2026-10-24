/**
 * One-event iCalendar file (RFC 5545) for "Add the crest to my calendar".
 * Pure: no clock, no DOM. `nowIso` is an input, like the Surveyor's.
 *
 * Format rules this follows:
 * - Lines end CRLF, and the file ends with one.
 * - Content lines fold at 75 octets (UTF-8 bytes, never mid-character);
 *   each continuation starts with one space.
 * - TEXT values escape backslash, semicolon, comma and newlines.
 * - DTSTART, DTEND and DTSTAMP are UTC ("...Z"), so every calendar app
 *   shows the crest in the reader's own time zone.
 * - One VALARM with ACTION:DISPLAY and a relative TRIGGER.
 */

export interface CrestIcsInput {
  /** Globally unique event id. Same uid = same event to a calendar app. */
  uid: string;
  /** SUMMARY: what the calendar shows on the day. */
  title: string;
  /** Event start (the forecast crest time), any Date-parseable ISO. */
  startIso: string;
  /** Event length in minutes (> 0). */
  durationMin: number;
  /** DESCRIPTION. Newlines are kept (escaped as \n). */
  description: string;
  /** URL property. Left out unless it is http(s). */
  url: string;
  /** Reminder this many minutes before the start (>= 0). */
  alarmMinutesBefore: number;
  /** DTSTAMP: when this file was made. */
  nowIso: string;
  /** The reminder's text. Defaults to the title. */
  alarmText?: string;
}

const CRLF = "\r\n";
const MAX_OCTETS = 75;

/** "2026-10-25T17:00:00.000Z" → "20261025T170000Z". Throws on a bad date. */
export function icsUtc(iso: string | number): string {
  const ms = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(ms)) throw new RangeError(`Not a date: ${String(iso)}`);
  return new Date(ms)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

/**
 * TEXT value escaping (RFC 5545 §3.3.11). Backslash goes first so the
 * escapes it adds aren't escaped again. Other control characters aren't
 * allowed in TEXT, so they're dropped (tab becomes a space).
 */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

const utf8 = new TextEncoder();
const octets = (s: string) => utf8.encode(s).length;

/**
 * Fold one content line (RFC 5545 §3.1): no physical line over 75
 * octets, a continuation line starts with a single space (which counts
 * toward its 75), and a multi-byte character is never split.
 */
export function foldIcsLine(line: string): string {
  if (octets(line) <= MAX_OCTETS) return line;
  const out: string[] = [];
  let cur = "";
  let curOctets = 0;
  for (const ch of line) {
    const n = octets(ch);
    if (curOctets + n > MAX_OCTETS) {
      out.push(cur);
      cur = " ";
      curOctets = 1;
    }
    cur += ch;
    curOctets += n;
  }
  out.push(cur);
  return out.join(CRLF);
}

/** "-PT12H", "-PT90M", "PT0M" (at the start). */
export function icsTrigger(minutesBefore: number): string {
  const m = Math.max(0, Math.round(minutesBefore));
  if (m === 0) return "PT0M";
  return m % 60 === 0 ? `-PT${m / 60}H` : `-PT${m}M`;
}

/** A URI value can't hold spaces or control characters, and only web links belong here. */
function cleanUrl(url: string): string | null {
  const u = url.replace(/[\s\u0000-\u001F\u007F]/g, "");
  return /^https?:\/\/[^/]/i.test(u) ? u : null;
}

function finite(n: number, name: string): number {
  if (!Number.isFinite(n)) throw new RangeError(`${name} must be a number`);
  return n;
}

/** The whole .ics file for one forecast crest, CRLF line endings. */
export function buildCrestIcs(input: CrestIcsInput): string {
  const startMs = Date.parse(input.startIso);
  if (!Number.isFinite(startMs)) {
    throw new RangeError(`Not a date: ${input.startIso}`);
  }
  const duration = finite(input.durationMin, "durationMin");
  if (duration <= 0) throw new RangeError("durationMin must be above 0");
  const alarm = finite(input.alarmMinutesBefore, "alarmMinutesBefore");
  const endMs = startMs + Math.round(duration * 60_000);
  const url = cleanUrl(input.url);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrestWatch//River crest//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${icsUtc(input.nowIso)}`,
    `DTSTART:${icsUtc(startMs)}`,
    `DTEND:${icsUtc(endMs)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    ...(url ? [`URL:${url}`] : []),
    // A reminder, not a meeting: don't mark the reader as busy.
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(input.alarmText ?? input.title)}`,
    `TRIGGER:${icsTrigger(alarm)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
