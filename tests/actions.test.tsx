/**
 * Package "actions": Read it to me, Send to family, Add the crest to my
 * calendar. The browser APIs are faked, so the logic each button runs is
 * checked here; the server render is checked with renderToStaticMarkup.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import {
  ACTION_BUTTON,
  ReadAloud,
  SPEECH_RATE,
  pickVoice,
  speakable,
  speechChunks,
  startSpeech,
  type SpeechSession,
  type UtteranceLike,
  type VoiceLike,
} from "@/components/watch/ReadAloud";
import {
  SendToFamily,
  familyShareData,
  shareOrFallback,
} from "@/components/watch/SendToFamily";
import {
  AddToCalendar,
  CALENDAR_FILENAME,
  CALENDAR_MIME,
  CREST_EVENT_MIN,
  REVOKE_AFTER_MS,
  calendarTitle,
  crestCalendarFile,
  downloadTextFile,
  isFutureCrest,
  reminderMinutesBefore,
  type DownloadEnv,
} from "@/components/watch/AddToCalendar";

const root = join(__dirname, "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

const HOUR = 3_600_000;
const NOW = "2026-10-23T19:00:00Z";
const NOW_MS = Date.parse(NOW);
const URL_ = "https://crestwatch-kalamadalas-projects.vercel.app/watch?wl=abc_-123";
const SENTENCE = "The Pearl River peaks Sunday around 12pm CT. Water likely reaches Home about 6 hours before that.";

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */
/* Read it to me                                                       */
/* ------------------------------------------------------------------ */

type Voice = VoiceLike & { name: string };
const v = (name: string, lang: string, extra: Partial<VoiceLike> = {}): Voice => ({
  name,
  lang,
  ...extra,
});

describe("pickVoice", () => {
  it("prefers the device's default en-US voice", () => {
    const voices = [
      v("UK", "en-GB", { default: true }),
      v("Online US", "en-US"),
      v("Default US", "en-US", { default: true }),
    ];
    expect(pickVoice(voices)?.name).toBe("Default US");
  });

  it("then an en-US voice that works offline, then any en-US voice", () => {
    expect(
      pickVoice([v("Online US", "en-US"), v("Local US", "en-US", { localService: true })])?.name,
    ).toBe("Local US");
    expect(pickVoice([v("Spanish", "es-MX"), v("US", "en-US")])?.name).toBe("US");
  });

  it("reads Android's en_US, in any case", () => {
    expect(pickVoice([v("UK", "en-GB"), v("Android US", "en_us")])?.name).toBe("Android US");
  });

  it("falls back to any English voice, then to none", () => {
    expect(pickVoice([v("Spanish", "es-ES"), v("UK", "en-GB")])?.name).toBe("UK");
    expect(pickVoice([v("Spanish", "es-ES")])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});

describe("speakable", () => {
  it("says feet, and foot for one", () => {
    expect(speakable("stays dry by about 12 ft.")).toBe("stays dry by about 12 feet.");
    expect(speakable("about 1 ft above")).toBe("about 1 foot above");
    expect(speakable("about 11 ft above")).toBe("about 11 feet above");
    expect(speakable("at 31.5 ft on the gauge")).toBe("at 31.5 feet on the gauge");
    expect(speakable("That 4ft gap")).toBe("That 4 feet gap");
  });

  it("says Central time and about", () => {
    expect(speakable("around 12pm CT.")).toBe("around 12pm Central time.");
    expect(speakable("in ~12h")).toBe("in about 12h");
  });

  it("leaves ordinary words alone", () => {
    expect(speakable("Water likely reaches Lift Station Rd.")).toBe(
      "Water likely reaches Lift Station Rd.",
    );
  });
});

describe("speechChunks", () => {
  it("reads one sentence at a time, in order, sentence then second line then notes", () => {
    expect(
      speechChunks([
        SENTENCE,
        "That could put about 2 ft of water here, about knee-deep on a grown-up.",
        null,
        "",
        "This is the middle of a town or street, not this house.",
      ]),
    ).toEqual([
      "The Pearl River peaks Sunday around 12pm Central time.",
      "Water likely reaches Home about 6 hours before that.",
      "That could put about 2 feet of water here, about knee-deep on a grown-up.",
      "This is the middle of a town or street, not this house.",
    ]);
  });

  it("doesn't split a decimal or a question", () => {
    expect(speechChunks(["Your spot sits 92.7 ft above sea level. Ready? Go."])).toEqual([
      "Your spot sits 92.7 feet above sea level.",
      "Ready?",
      "Go.",
    ]);
  });

  it("is empty when there's nothing to read", () => {
    expect(speechChunks([null, undefined, "", "   "])).toEqual([]);
  });
});

interface FakeUtterance extends UtteranceLike<Voice> {
  text: string;
}

function fakeSynth(opts: { speaking?: boolean; throwOnSpeak?: boolean } = {}) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: opts.speaking ?? false,
    pending: false,
    cancelled: 0,
    speak(u: FakeUtterance) {
      if (opts.throwOnSpeak) throw new Error("no voice");
      spoken.push(u);
    },
    cancel() {
      this.cancelled++;
      // Real engines report a cancel as an error on what was queued.
      for (const u of spoken) (u.onerror as (() => void) | null)?.();
    },
  };
  const makeUtterance = (text: string): FakeUtterance => ({
    text,
    lang: "",
    rate: 1,
    voice: null,
    onend: null,
    onerror: null,
  });
  return { synth, spoken, makeUtterance };
}

const fire = (fn: ((ev: never) => unknown) | null) => (fn as (() => void) | null)?.();

describe("startSpeech", () => {
  const US = v("US", "en-US", { default: true });

  it("queues every chunk in en-US at a slightly slow rate", () => {
    const { synth, spoken, makeUtterance } = fakeSynth();
    const onDone = vi.fn();
    startSpeech({ synth, makeUtterance, chunks: ["One.", "Two."], voice: US, onDone });
    expect(spoken.map((u) => u.text)).toEqual(["One.", "Two."]);
    for (const u of spoken) {
      expect(u.lang).toBe("en-US");
      expect(u.rate).toBe(SPEECH_RATE);
      expect(u.voice).toBe(US);
    }
    expect(SPEECH_RATE).toBeCloseTo(0.95);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("asks for en-US even when no voice was found, and uses an Android voice's lang", () => {
    const a = fakeSynth();
    startSpeech({ ...a, chunks: ["One."], voice: null, onDone: () => {} });
    expect(a.spoken[0].lang).toBe("en-US");
    expect(a.spoken[0].voice).toBeNull();
    const b = fakeSynth();
    startSpeech({ ...b, chunks: ["One."], voice: v("A", "en_US"), onDone: () => {} });
    expect(b.spoken[0].lang).toBe("en-US");
  });

  it("is done when the last chunk ends, not before", () => {
    const { synth, spoken, makeUtterance } = fakeSynth();
    const onDone = vi.fn();
    const s = startSpeech({ synth, makeUtterance, chunks: ["One.", "Two."], voice: US, onDone });
    expect(spoken[0].onend).toBeNull();
    fire(spoken[1].onend);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(s);
    expect(s.done).toBe(true);
  });

  it("stop() cancels and reports once, even as the engine reports the cancel", () => {
    const { synth, makeUtterance } = fakeSynth();
    const onDone = vi.fn();
    const s = startSpeech({ synth, makeUtterance, chunks: ["One.", "Two."], voice: US, onDone });
    s.stop();
    s.stop();
    expect(synth.cancelled).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(s.done).toBe(true);
  });

  it("is done on an error", () => {
    const { synth, spoken, makeUtterance } = fakeSynth();
    const onDone = vi.fn();
    startSpeech({ synth, makeUtterance, chunks: ["One.", "Two."], voice: US, onDone });
    fire(spoken[0].onerror);
    fire(spoken[1].onend);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("clears a stuck queue before speaking", () => {
    const { synth, spoken, makeUtterance } = fakeSynth({ speaking: true });
    startSpeech({ synth, makeUtterance, chunks: ["One."], voice: US, onDone: () => {} });
    expect(synth.cancelled).toBe(1);
    expect(spoken).toHaveLength(1);
  });

  it("is done at once with nothing to read, or when the engine throws", () => {
    const empty = fakeSynth();
    const onEmpty = vi.fn();
    const s1 = startSpeech({ ...empty, chunks: [], voice: US, onDone: onEmpty });
    expect(s1.done).toBe(true);
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(empty.spoken).toHaveLength(0);

    const broken = fakeSynth({ throwOnSpeak: true });
    const onBroken = vi.fn();
    const s2: SpeechSession = startSpeech({ ...broken, chunks: ["One."], voice: US, onDone: onBroken });
    expect(s2.done).toBe(true);
    expect(onBroken).toHaveBeenCalledTimes(1);
  });
});

describe("<ReadAloud />", () => {
  it("renders nothing on the server, even where speech exists", () => {
    vi.stubGlobal("window", { speechSynthesis: {}, SpeechSynthesisUtterance: function () {} });
    expect(renderToStaticMarkup(<ReadAloud sentence={SENTENCE} />)).toBe("");
  });

  it("is a toggle with aria-pressed, a 44 px target and a focus ring", () => {
    const s = src("components/watch/ReadAloud.tsx");
    expect(s.startsWith('"use client";')).toBe(true);
    expect(s).toMatch(/aria-pressed=\{speaking\}/);
    expect(s).toMatch(/copy\.readAloudStop/);
    expect(s).toMatch(/useSyncExternalStore/);
    expect(ACTION_BUTTON).toMatch(/\bmin-h-11\b/);
    expect(ACTION_BUTTON).toMatch(/\bmin-w-11\b/);
    expect(ACTION_BUTTON).toMatch(/focus-visible:outline-2/);
  });
});

/* ------------------------------------------------------------------ */
/* Send to family                                                      */
/* ------------------------------------------------------------------ */

describe("familyShareData", () => {
  it("shares the sentence and the watch link, titled with the place", () => {
    expect(familyShareData({ pinName: "Home", sentence: SENTENCE, url: URL_ })).toEqual({
      title: "Home · CrestWatch",
      text: SENTENCE,
      url: URL_,
    });
  });

  it("never sends a stale or approximate answer without its warning", () => {
    const data = familyShareData({
      pinName: "Home",
      sentence: SENTENCE,
      url: URL_,
      notes: [copy.staleness(30), null, "", copy.approximateShare],
    });
    expect(data.text).toBe(`${SENTENCE}\n${copy.staleness(30)}\n${copy.approximateShare}`);
  });
});

describe("shareOrFallback", () => {
  const DATA = { title: "Home · CrestWatch", text: SENTENCE, url: URL_ };

  it("opens the share sheet with the data", async () => {
    const share = vi.fn(async () => {});
    const onFallback = vi.fn();
    expect(await shareOrFallback(DATA, onFallback, { share })).toBe("shared");
    expect(share).toHaveBeenCalledWith(DATA);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("does nothing when the person closes the sheet", async () => {
    const onFallback = vi.fn();
    const abort = new DOMException("Share canceled", "AbortError");
    const share = vi.fn(async () => {
      throw abort;
    });
    expect(await shareOrFallback(DATA, onFallback, { share })).toBe("cancelled");
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("falls back once on any other failure", async () => {
    for (const err of [
      new DOMException("Not allowed", "NotAllowedError"),
      new TypeError("bad data"),
      "weird",
    ]) {
      const onFallback = vi.fn();
      const share = vi.fn(async () => {
        throw err;
      });
      expect(await shareOrFallback(DATA, onFallback, { share })).toBe("fallback");
      expect(onFallback).toHaveBeenCalledTimes(1);
    }
  });

  it("falls back when there's no share, or the sheet won't take this data", async () => {
    const a = vi.fn();
    expect(await shareOrFallback(DATA, a, {})).toBe("fallback");
    expect(a).toHaveBeenCalledTimes(1);
    const b = vi.fn();
    const share = vi.fn(async () => {});
    expect(await shareOrFallback(DATA, b, { share, canShare: () => false })).toBe("fallback");
    expect(share).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("<SendToFamily />", () => {
  it("renders nothing on the server, even where share exists", () => {
    vi.stubGlobal("navigator", { share: async () => {} });
    expect(
      renderToStaticMarkup(
        <SendToFamily pinName="Home" sentence={SENTENCE} url={URL_} onFallback={() => {}} />,
      ),
    ).toBe("");
  });

  it("only shows where navigator.share exists, and guards a double tap", () => {
    const s = src("components/watch/SendToFamily.tsx");
    expect(s.startsWith('"use client";')).toBe(true);
    expect(s).toMatch(/typeof navigator\.share === "function"/);
    expect(s).toMatch(/busy\.current/);
    expect(s).toMatch(/className=\{ACTION_BUTTON\}/);
  });
});

/* ------------------------------------------------------------------ */
/* Add the crest to my calendar                                        */
/* ------------------------------------------------------------------ */

describe("reminderMinutesBefore", () => {
  it("is 12 hours ahead when the crest is 12 hours away or more", () => {
    expect(reminderMinutesBefore(NOW_MS + 48 * HOUR, NOW_MS)).toBe(720);
    expect(reminderMinutesBefore(NOW_MS + 12 * HOUR, NOW_MS)).toBe(720);
  });

  it("is 1 hour ahead when the crest is under 12 hours away", () => {
    expect(reminderMinutesBefore(NOW_MS + 12 * HOUR - 60_000, NOW_MS)).toBe(60);
    expect(reminderMinutesBefore(NOW_MS + 2 * HOUR, NOW_MS)).toBe(60);
  });
});

describe("isFutureCrest", () => {
  it("is true only for a real time still ahead", () => {
    expect(isFutureCrest("2026-10-25T17:00:00Z", NOW)).toBe(true);
    expect(isFutureCrest("2026-10-25T17:00:00Z", NOW_MS)).toBe(true);
    expect(isFutureCrest(NOW, NOW)).toBe(false);
    expect(isFutureCrest("2026-10-22T17:00:00Z", NOW)).toBe(false);
    expect(isFutureCrest("", NOW)).toBe(false);
    expect(isFutureCrest("2026-10-25T17:00:00Z", "later")).toBe(false);
  });
});

describe("calendarTitle", () => {
  it("names the river and the place", () => {
    expect(calendarTitle("Pearl River", "Home")).toBe("River crest: Pearl River near Home");
  });

  it("drops the river when there's no name for it", () => {
    expect(calendarTitle(null, "Home")).toBe("River crest near Home");
    expect(calendarTitle("  ", "Home")).toBe("River crest near Home");
  });
});

const unfold = (ics: string) => ics.replace(/\r\n[ \t]/g, "");
const field = (ics: string, name: string, nth = 0) =>
  unfold(ics)
    .split("\r\n")
    .filter((l) => l.startsWith(`${name}:`))
    [nth]?.slice(name.length + 1);
const unescapeText = (s: string) =>
  s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

describe("crestCalendarFile", () => {
  const INPUT = {
    crestIso: "2026-10-25T17:00:00Z",
    riverName: "Pearl River",
    pinName: "Home",
    sentence: SENTENCE,
    url: URL_,
  };

  it("is an hour-long event at the crest, titled with river and place", () => {
    const ics = crestCalendarFile(INPUT, NOW_MS) as string;
    expect(field(ics, "DTSTART")).toBe("20261025T170000Z");
    expect(field(ics, "DTEND")).toBe("20261025T180000Z");
    expect(CREST_EVENT_MIN).toBe(60);
    expect(field(ics, "DTSTAMP")).toBe("20261023T190000Z");
    expect(unescapeText(field(ics, "SUMMARY") ?? "")).toBe("River crest: Pearl River near Home");
    expect(field(ics, "URL")).toBe(URL_);
  });

  it("describes it with the sentence, then where to check the latest", () => {
    const ics = crestCalendarFile(INPUT, NOW_MS) as string;
    expect(unescapeText(field(ics, "DESCRIPTION") ?? "")).toBe(
      `${SENTENCE}\n\nForecasts change. Check the latest: ${URL_}`,
    );
  });

  it("carries the honesty notes it's given", () => {
    const ics = crestCalendarFile(
      { ...INPUT, notes: [copy.approximateShare, null] },
      NOW_MS,
    ) as string;
    expect(unescapeText(field(ics, "DESCRIPTION") ?? "")).toBe(
      `${SENTENCE}\n\n${copy.approximateShare}\n\n${copy.calendarCheckLatest(URL_)}`,
    );
  });

  it("reminds 12 hours before, or 1 hour before when the crest is close", () => {
    const far = crestCalendarFile(INPUT, NOW_MS) as string;
    expect(field(far, "TRIGGER")).toBe("-PT12H");
    expect(unescapeText(field(far, "DESCRIPTION", 1) ?? "")).toBe(copy.calendarAlarm);
    const near = crestCalendarFile(
      { ...INPUT, crestIso: new Date(NOW_MS + 5 * HOUR).toISOString() },
      NOW_MS,
    ) as string;
    expect(field(near, "TRIGGER")).toBe("-PT1H");
  });

  it("gives the same crest the same uid, and a new crest a new one", () => {
    const a = field(crestCalendarFile(INPUT, NOW_MS) as string, "UID");
    const again = field(crestCalendarFile(INPUT, NOW_MS + HOUR) as string, "UID");
    const moved = field(
      crestCalendarFile({ ...INPUT, crestIso: "2026-10-25T20:00:00Z" }, NOW_MS) as string,
      "UID",
    );
    const elsewhere = field(crestCalendarFile({ ...INPUT, pinName: "Grandma" }, NOW_MS) as string, "UID");
    expect(a).toMatch(/^crest-20261025T170000Z-[0-9a-f]{8}@crestwatch$/);
    expect(again).toBe(a);
    expect(moved).not.toBe(a);
    expect(elsewhere).not.toBe(a);
  });

  it("is null for a crest that has passed or isn't a time", () => {
    expect(crestCalendarFile({ ...INPUT, crestIso: "2026-10-23T18:00:00Z" }, NOW_MS)).toBeNull();
    expect(crestCalendarFile({ ...INPUT, crestIso: NOW }, NOW_MS)).toBeNull();
    expect(crestCalendarFile({ ...INPUT, crestIso: "soon" }, NOW_MS)).toBeNull();
    expect(crestCalendarFile(INPUT, Number.NaN)).toBeNull();
  });
});

function fakeDownload(opts: { clickThrows?: boolean } = {}) {
  const calls: string[] = [];
  const blobs: Blob[] = [];
  const pending: Array<{ fn: () => void; ms: number }> = [];
  const anchor = {
    href: "",
    download: "",
    rel: "",
    click: vi.fn(() => {
      calls.push("click");
      if (opts.clickThrows) throw new Error("blocked");
    }),
    remove: vi.fn(() => calls.push("remove")),
  };
  const env: DownloadEnv = {
    createObjectURL: (b) => {
      blobs.push(b);
      calls.push("create");
      return "blob:crestwatch/1";
    },
    revokeObjectURL: (u) => calls.push(`revoke ${u}`),
    createAnchor: () => anchor,
    attach: () => calls.push("attach"),
    later: (fn, ms) => pending.push({ fn, ms }),
  };
  return { env, calls, blobs, pending, anchor };
}

describe("downloadTextFile", () => {
  it("saves the file through a Blob URL, then revokes it later", async () => {
    const d = fakeDownload();
    expect(downloadTextFile("BEGIN:VCALENDAR\r\n", CALENDAR_FILENAME, CALENDAR_MIME, d.env)).toBe(true);
    expect(d.anchor.href).toBe("blob:crestwatch/1");
    expect(d.anchor.download).toBe("crestwatch-crest.ics");
    expect(d.calls).toEqual(["create", "attach", "click", "remove"]);
    expect(d.blobs[0].type).toBe("text/calendar;charset=utf-8");
    expect(await d.blobs[0].text()).toBe("BEGIN:VCALENDAR\r\n");
    // Not revoked yet: revoking at once can cancel the download.
    expect(d.pending).toHaveLength(1);
    expect(d.pending[0].ms).toBe(REVOKE_AFTER_MS);
    d.pending[0].fn();
    expect(d.calls.at(-1)).toBe("revoke blob:crestwatch/1");
  });

  it("says so when the download can't start, and still revokes", () => {
    const d = fakeDownload({ clickThrows: true });
    expect(downloadTextFile("x", CALENDAR_FILENAME, CALENDAR_MIME, d.env)).toBe(false);
    expect(d.pending).toHaveLength(1);
    d.pending[0].fn();
    expect(d.calls.at(-1)).toBe("revoke blob:crestwatch/1");
  });
});

describe("<AddToCalendar />", () => {
  const props = {
    crestIso: "2026-10-25T17:00:00Z",
    riverName: "Pearl River",
    pinName: "Home",
    sentence: SENTENCE,
    url: URL_,
    now: NOW,
  };

  it("shows the button while the crest is ahead", () => {
    const html = renderToStaticMarkup(<AddToCalendar {...props} />);
    expect(html).toContain(copy.addToCalendar);
    expect(html).toContain('type="button"');
    expect(html).toContain("min-h-11");
    expect(html).toContain("focus-visible:outline-2");
    expect(html).toMatch(/<svg aria-hidden="true"/);
  });

  it("shows nothing once the crest has passed, or without a crest time", () => {
    expect(renderToStaticMarkup(<AddToCalendar {...props} crestIso="2026-10-22T17:00:00Z" />)).toBe("");
    expect(renderToStaticMarkup(<AddToCalendar {...props} crestIso={NOW} />)).toBe("");
    expect(renderToStaticMarkup(<AddToCalendar {...props} crestIso="" />)).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* Copy rules for this package's strings                               */
/* ------------------------------------------------------------------ */

describe("actions copy", () => {
  const strings = [
    copy.readAloud,
    copy.readAloudStop,
    copy.speechFeet,
    copy.speechFoot,
    copy.speechCentral,
    copy.speechAbout,
    copy.sendToFamily,
    copy.sendToFamilyTitle("Home"),
    copy.addToCalendar,
    copy.calendarSaved,
    copy.calendarTitle("Pearl River", "Home"),
    copy.calendarTitleNoRiver("Home"),
    copy.calendarCheckLatest(URL_),
    copy.calendarAlarm,
  ];

  it("follows the copy rules", () => {
    for (const s of strings) {
      expect(s).not.toMatch(/!|—|–|\bAI\b/);
      expect(s).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
    }
  });

  it("uses the button names the plan asks for", () => {
    expect(copy.readAloud).toBe("Read it to me");
    expect(copy.readAloudStop).toBe("Stop");
    expect(copy.sendToFamily).toBe("Send to family");
    expect(copy.addToCalendar).toBe("Add the crest to my calendar");
  });

  it("says in the calendar file that the forecast can change", () => {
    expect(copy.calendarCheckLatest(URL_)).toMatch(/^Forecasts change\. Check the latest: /);
    expect(copy.calendarCheckLatest(URL_).endsWith(URL_)).toBe(true);
  });

  it("keeps the package's strings in one block at the end of the deck", () => {
    const deck = src("lib/copy.ts");
    const start = deck.indexOf('// Package "actions"');
    expect(start).toBeGreaterThan(-1);
    const block = deck.slice(start, deck.lastIndexOf("} as const;"));
    for (const key of [
      "readAloud:",
      "readAloudStop:",
      "sendToFamily:",
      "sendToFamilyTitle:",
      "addToCalendar:",
      "calendarSaved:",
      "calendarTitle:",
      "calendarTitleNoRiver:",
      "calendarCheckLatest:",
      "calendarAlarm:",
    ]) {
      expect(block, key).toContain(key);
    }
  });
});
