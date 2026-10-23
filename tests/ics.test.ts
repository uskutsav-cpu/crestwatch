/**
 * lib/ics.ts: the RFC 5545 file behind "Add the crest to my calendar".
 */

import { describe, expect, it } from "vitest";
import {
  buildCrestIcs,
  escapeIcsText,
  foldIcsLine,
  icsTrigger,
  icsUtc,
  type CrestIcsInput,
} from "@/lib/ics";

const octets = (s: string) => new TextEncoder().encode(s).length;

/** Undo folding (RFC 5545 §3.1): CRLF followed by one space or tab. */
const unfold = (ics: string) => ics.replace(/\r\n[ \t]/g, "");

/** Logical content lines, unfolded, without the trailing empty one. */
const logicalLines = (ics: string) => unfold(ics).split("\r\n").filter((l) => l !== "");

/** Undo TEXT escaping, to check a value round-trips. */
const unescapeText = (s: string) =>
  s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

/** The value of the first `NAME:` line (after `from` when given). */
function prop(ics: string, name: string, from = 0): string | undefined {
  const lines = logicalLines(ics).slice(from);
  return lines.find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1);
}

const BASE: CrestIcsInput = {
  uid: "crest-20261025T170000Z-abc@crestwatch",
  title: "River crest: Pearl River near Home",
  // Noon Central (CDT, UTC-5) on Oct 25.
  startIso: "2026-10-25T12:00:00-05:00",
  durationMin: 60,
  description: "The Pearl River peaks Sunday around 12pm CT.",
  url: "https://crestwatch-kalamadalas-projects.vercel.app/watch?wl=abc_-123",
  alarmMinutesBefore: 720,
  nowIso: "2026-10-23T19:00:00Z",
};

describe("icsUtc", () => {
  it("writes UTC basic format with a Z, no milliseconds", () => {
    expect(icsUtc("2026-10-25T12:00:00-05:00")).toBe("20261025T170000Z");
    expect(icsUtc("2026-10-23T19:00:00.987Z")).toBe("20261023T190000Z");
    expect(icsUtc(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe("20260102T030405Z");
  });

  it("throws on a date it can't read", () => {
    expect(() => icsUtc("not a date")).toThrow(RangeError);
    expect(() => icsUtc(Number.NaN)).toThrow(RangeError);
  });
});

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon and comma", () => {
    expect(escapeIcsText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
  });

  it("escapes the backslash first, so a literal \\n stays literal", () => {
    // Backslash + "n" in the input is two characters, not a newline.
    expect(escapeIcsText("C:\\new")).toBe("C:\\\\new");
    expect(unescapeText(escapeIcsText("C:\\new"))).toBe("C:\\new");
  });

  it("turns every kind of newline into \\n", () => {
    expect(escapeIcsText("one\ntwo\r\nthree\rfour")).toBe("one\\ntwo\\nthree\\nfour");
  });

  it("drops control characters TEXT can't hold, and tabs become spaces", () => {
    expect(escapeIcsText("a\u0000b\u0007c\u007Fd\te")).toBe("abcd e");
  });

  it("leaves colons, quotes and non-ASCII alone", () => {
    expect(escapeIcsText('Check: "Grandma\'s" · ✓ é')).toBe('Check: "Grandma\'s" · ✓ é');
  });

  it("round-trips through unescaping", () => {
    const s = "Sentence one, with commas; and semis.\n\nCheck the latest: https://x.test/?a=1,2";
    expect(unescapeText(escapeIcsText(s))).toBe(s);
  });
});

describe("foldIcsLine", () => {
  it("leaves a line of exactly 75 octets alone", () => {
    const line = `DESCRIPTION:${"x".repeat(75 - 12)}`;
    expect(octets(line)).toBe(75);
    expect(foldIcsLine(line)).toBe(line);
  });

  it("folds at 76 octets, continuing with one space", () => {
    const line = `DESCRIPTION:${"x".repeat(76 - 12)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts).toHaveLength(2);
    expect(octets(parts[0])).toBe(75);
    expect(parts[1]).toBe(" x");
    expect(unfold(folded)).toBe(line);
  });

  it("keeps every physical line at 75 octets or less, space included", () => {
    const line = `SUMMARY:${"abcdefghij".repeat(40)}`;
    const parts = foldIcsLine(line).split("\r\n");
    expect(parts.length).toBeGreaterThan(5);
    for (const p of parts) expect(octets(p)).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) {
      expect(p.startsWith(" ")).toBe(true);
      expect(p.startsWith("  ")).toBe(false);
    }
    expect(unfold(foldIcsLine(line))).toBe(line);
  });

  it("counts octets, not characters, and never splits a character", () => {
    // ✓ is 3 octets; 🌊 is 4 (and two UTF-16 code units).
    for (const ch of ["✓", "🌊", "é"]) {
      const line = `DESCRIPTION:${ch.repeat(60)}`;
      const folded = foldIcsLine(line);
      const parts = folded.split("\r\n");
      for (const p of parts) {
        expect(octets(p)).toBeLessThanOrEqual(75);
        // No lone surrogate halves at a fold.
        expect(p).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
        expect(p).not.toMatch(/(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/);
        expect(new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(p))).toBe(p);
      }
      expect(unfold(folded)).toBe(line);
    }
  });

  it("fills a line as full as it can before folding", () => {
    // 12 ASCII octets + 21 × 3 = 75: fits. One more ✓ doesn't.
    const fits = `DESCRIPTION:${"✓".repeat(21)}`;
    expect(foldIcsLine(fits)).toBe(fits);
    const over = foldIcsLine(`DESCRIPTION:${"✓".repeat(22)}`).split("\r\n");
    expect(octets(over[0])).toBe(75);
    expect(over[1]).toBe(" ✓");
  });
});

describe("icsTrigger", () => {
  it("says hours when it can, minutes when it can't", () => {
    expect(icsTrigger(720)).toBe("-PT12H");
    expect(icsTrigger(60)).toBe("-PT1H");
    expect(icsTrigger(90)).toBe("-PT90M");
    expect(icsTrigger(2880)).toBe("-PT48H");
  });

  it("fires at the start for zero, and never after it", () => {
    expect(icsTrigger(0)).toBe("PT0M");
    expect(icsTrigger(-30)).toBe("PT0M");
  });
});

describe("buildCrestIcs", () => {
  const ics = buildCrestIcs(BASE);

  it("uses CRLF for every line break and ends with one", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("keeps every physical line at 75 octets or less", () => {
    const long = buildCrestIcs({
      ...BASE,
      title: `River crest: ${"Big Black River ".repeat(5)}near Grandma's`,
      description: `${"The forecast crest is 4 ft above flood stage, near you; ".repeat(6)}✓ 🌊`,
    });
    for (const line of long.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it("is one VCALENDAR with one VEVENT holding one VALARM", () => {
    const lines = logicalLines(ics);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    const order = ["BEGIN:VEVENT", "BEGIN:VALARM", "END:VALARM", "END:VEVENT"].map((m) =>
      lines.indexOf(m),
    );
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.filter((l) => l === "BEGIN:VALARM")).toHaveLength(1);
  });

  it("writes DTSTART, DTEND and DTSTAMP in UTC", () => {
    expect(prop(ics, "DTSTART")).toBe("20261025T170000Z");
    expect(prop(ics, "DTEND")).toBe("20261025T180000Z");
    expect(prop(ics, "DTSTAMP")).toBe("20261023T190000Z");
  });

  it("sets DTEND from the duration", () => {
    const ninety = buildCrestIcs({ ...BASE, durationMin: 90 });
    expect(prop(ninety, "DTEND")).toBe("20261025T183000Z");
  });

  it("adds a DISPLAY reminder with a relative trigger before the start", () => {
    const lines = logicalLines(ics);
    const alarmAt = lines.indexOf("BEGIN:VALARM");
    expect(prop(ics, "ACTION", alarmAt)).toBe("DISPLAY");
    expect(prop(ics, "TRIGGER", alarmAt)).toBe("-PT12H");
    // A DISPLAY alarm must carry a DESCRIPTION; it defaults to the title.
    expect(unescapeText(prop(ics, "DESCRIPTION", alarmAt) ?? "")).toBe(BASE.title);
    const hour = buildCrestIcs({ ...BASE, alarmMinutesBefore: 60, alarmText: "Check, then go." });
    const at = logicalLines(hour).indexOf("BEGIN:VALARM");
    expect(prop(hour, "TRIGGER", at)).toBe("-PT1H");
    expect(prop(hour, "DESCRIPTION", at)).toBe("Check\\, then go.");
  });

  it("escapes TEXT values and round-trips them", () => {
    const tricky = buildCrestIcs({
      ...BASE,
      uid: "a;b,c@crestwatch",
      title: "River crest: Pearl River near Mom's, Dad's; and Kim\\Lee's",
      description: "Line one, with a comma.\n\nForecasts change. Check the latest: https://x.test/?a=1,2",
    });
    expect(prop(tricky, "UID")).toBe("a\\;b\\,c@crestwatch");
    expect(prop(tricky, "SUMMARY")).toBe(
      "River crest: Pearl River near Mom's\\, Dad's\\; and Kim\\\\Lee's",
    );
    expect(unescapeText(prop(tricky, "SUMMARY") ?? "")).toBe(
      "River crest: Pearl River near Mom's, Dad's; and Kim\\Lee's",
    );
    const desc = prop(tricky, "DESCRIPTION") ?? "";
    expect(desc).not.toMatch(/[\r\n]/);
    expect(unescapeText(desc)).toBe(
      "Line one, with a comma.\n\nForecasts change. Check the latest: https://x.test/?a=1,2",
    );
  });

  it("can't be broken out of by a newline in any value", () => {
    const evil = buildCrestIcs({
      ...BASE,
      title: "Home\r\nEND:VEVENT\r\nBEGIN:VEVENT",
      description: "x\nATTENDEE:mailto:someone@example.com",
      uid: "u\nX:1",
    });
    const lines = logicalLines(evil);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(1);
    expect(lines.some((l) => l.startsWith("ATTENDEE"))).toBe(false);
    expect(lines.some((l) => l.startsWith("X:"))).toBe(false);
  });

  it("includes the URL only when it's a web link, with no spaces or control characters", () => {
    expect(prop(ics, "URL")).toBe(BASE.url);
    const spaced = buildCrestIcs({ ...BASE, url: " https://x.test/watch?wl=a b\r\nX:1 " });
    expect(prop(spaced, "URL")).toBe("https://x.test/watch?wl=abX:1");
    expect(logicalLines(spaced).some((l) => l.startsWith("X:"))).toBe(false);
    for (const url of ["javascript:alert(1)", "", "/watch?wl=abc", "data:text/html,hi"]) {
      expect(prop(buildCrestIcs({ ...BASE, url }), "URL"), url).toBeUndefined();
    }
  });

  it("doesn't mark the reader busy", () => {
    expect(prop(ics, "TRANSP")).toBe("TRANSPARENT");
  });

  it("refuses inputs that would make a broken file", () => {
    expect(() => buildCrestIcs({ ...BASE, startIso: "soon" })).toThrow(RangeError);
    expect(() => buildCrestIcs({ ...BASE, nowIso: "" })).toThrow(RangeError);
    expect(() => buildCrestIcs({ ...BASE, durationMin: 0 })).toThrow(RangeError);
    expect(() => buildCrestIcs({ ...BASE, durationMin: Number.NaN })).toThrow(RangeError);
    expect(() => buildCrestIcs({ ...BASE, alarmMinutesBefore: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
  });

  it("is deterministic: same input, same file", () => {
    expect(buildCrestIcs(BASE)).toBe(ics);
  });
});
