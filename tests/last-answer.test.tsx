/**
 * The last good answer, kept for when the signal drops (package
 * lastanswer): save, load, age, mismatch, linked-never, clear-on-delete,
 * blocked storage. localStorage is a stub; nothing here needs a browser.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/config";
import {
  LAST_ANSWER_KEY,
  LAST_ANSWER_MAX_AGE_MS,
  agedWatch,
  clearLastAnswer,
  lastAnswerTooOld,
  loadLastAnswer,
  pinsKeyFor,
  saveLastAnswer,
} from "@/lib/last-answer";
import { addPin, clearAllPins, removePin, renamePin } from "@/lib/pin-store";
import { fetchWatches, settleCheck, useWatches } from "@/lib/use-watch";
import { verdictSentence } from "@/lib/sentences";
import { staleInfo, staleLineFor } from "@/lib/staleness";
import { copy } from "@/lib/copy";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";
import type { FullVerdict, Staleness } from "@/lib/surveyor";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const NOW = "2026-10-23T19:00:00Z";
const SAVED_AT = Date.parse(NOW);
const MIN = 60_000;
const HOUR = 60 * MIN;

const HOME: Pin = {
  id: "phome",
  name: "Home",
  matchedAddress: "100 E CAPITOL ST, JACKSON, MS, 39201",
  lat: 32.300441828077,
  lon: -90.188419699815,
  elevationFt: 262.2,
};
const SHOP: Pin = {
  id: "pshop",
  name: "Shop",
  matchedAddress: "1400 WASHINGTON ST, VICKSBURG, MS",
  lat: 32.349033641592,
  lon: -90.882368787159,
  elevationFt: 193.1,
  approximate: true,
};
const PINS = [HOME, SHOP];

const FRESH: Staleness = {
  observedH: 0.5,
  forecastH: 3,
  staleObserved: false,
  staleForecast: false,
};

function gauge() {
  return {
    lid: "JACM6",
    name: "Pearl River at Jackson",
    usgsId: "02486000",
    distanceMi: 1.2,
    gaugeZeroFt: 233.39,
    gaugeDatum: "NGVD29",
    categories: { action: 25, minor: 28, moderate: 36, major: 38 },
    historicCrests: [{ stageFt: 43.2, time: "1979-04-17T00:00:00Z" }],
    observed: [
      { t: "2026-10-23T18:15:00Z", stageFt: 16.5 },
      { t: "2026-10-23T18:30:00Z", stageFt: 16.6 },
    ],
    forecast: [
      { t: "2026-10-24T00:00:00Z", stageFt: 20 },
      { t: "2026-10-24T12:00:00Z", stageFt: 30 },
    ],
    forecastIssued: "2026-10-23T16:00:00Z",
  };
}

/** Water likely: the forecast crosses Home's ground about 10 h from NOW. */
function homeWatch(): PinWatch {
  return {
    pinId: HOME.id,
    verdict: {
      tier: "FULL",
      band: "LIKELY",
      marginFt: -1.2,
      peak: { waterElevFt: 263.39, stageFt: 30, t: "2026-10-24T12:00:00Z" },
      crossing: { t: "2026-10-24T05:00:00Z", hoursFromNow: 10 },
      pastPeak: false,
      currentlyAbove: false,
      currentWaterElevFt: 249.99,
      stale: FRESH,
    },
    gauge: gauge(),
    alerts: [
      {
        event: "Flood Warning",
        headline: null,
        severity: "Moderate",
        areaDesc: "Hinds, MS",
        expires: "2026-10-25T00:00:00Z",
      },
    ],
    alertsOk: true,
  };
}

function shopWatch(): PinWatch {
  return {
    pinId: SHOP.id,
    verdict: {
      tier: "CATEGORY",
      peakStageFt: 30,
      peakT: "2026-10-24T12:00:00Z",
      aboveFloodFt: 2,
      category: "minor",
      stale: FRESH,
    },
    gauge: gauge(),
    alerts: [],
    alertsOk: true,
  };
}

const WATCHES = () => [homeWatch(), shopWatch()];

/* ------------------------------------------------------------------ */
/* A localStorage stand-in that logs every access                      */
/* ------------------------------------------------------------------ */

type Mode = "ok" | "throw";

function fakeStorage() {
  const data = new Map<string, string>();
  const log: Array<[op: "get" | "set" | "remove", key: string]> = [];
  const s = {
    mode: "ok" as Mode,
    data,
    log,
    getItem: (k: string) => {
      log.push(["get", k]);
      if (s.mode === "throw") throw new DOMException("denied", "SecurityError");
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      log.push(["set", k]);
      if (s.mode === "throw") throw new DOMException("full", "QuotaExceededError");
      data.set(k, v);
    },
    removeItem: (k: string) => {
      log.push(["remove", k]);
      if (s.mode === "throw") throw new DOMException("denied", "SecurityError");
      data.delete(k);
    },
    touched: (k: string) => log.some(([, key]) => key === k),
    savePins: (pins: Pin[]) => data.set(STORAGE_KEYS.pins, JSON.stringify(pins)),
    saved: () => {
      const raw = data.get(LAST_ANSWER_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    },
  };
  return s;
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  vi.stubGlobal("localStorage", store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Save the standard answer for PINS, then forget the log. */
function seedSaved(savedAt = SAVED_AT, pins: Pin[] = PINS, watches = WATCHES()) {
  expect(saveLastAnswer(pins, watches, NOW, savedAt)).toBe(true);
  store.log.length = 0;
}

const full = (w: PinWatch) => w.verdict as FullVerdict;

/* ------------------------------------------------------------------ */

describe("saving and loading the last answer", () => {
  it("saves under crestwatch.lastAnswer with the pin set, the answer and both clocks", () => {
    seedSaved();
    const s = store.saved();
    expect(LAST_ANSWER_KEY).toBe("crestwatch.lastAnswer");
    expect(s).toEqual({
      pinsKey: pinsKeyFor(PINS),
      watches: WATCHES(),
      now: NOW,
      savedAt: SAVED_AT,
    });
  });

  it("gives the answer back for the same places, with when it arrived", () => {
    seedSaved();
    const got = loadLastAnswer(PINS, SAVED_AT + 5 * MIN);
    expect(got).not.toBeNull();
    expect(got!.savedAt).toBe(SAVED_AT);
    expect(got!.watches.map((w) => w.pinId)).toEqual([HOME.id, SHOP.id]);
    // The verdict itself is untouched: same band, margin, peak, alerts.
    const v = full(got!.watches[0]);
    expect(v.band).toBe("LIKELY");
    expect(v.marginFt).toBe(-1.2);
    expect(v.peak).toEqual(full(homeWatch()).peak);
    expect(got!.watches[0].alerts).toEqual(homeWatch().alerts);
    expect(got!.watches[0].gauge).toEqual(gauge());
    // Its clock moved forward by the answer's age.
    expect(got!.now).toBe("2026-10-23T19:05:00.000Z");
  });

  it("works right up to 12 hours, and never at 12 hours or later", () => {
    seedSaved();
    expect(LAST_ANSWER_MAX_AGE_MS).toBe(12 * HOUR);
    expect(loadLastAnswer(PINS, SAVED_AT + 12 * HOUR - MIN)).not.toBeNull();
    expect(loadLastAnswer(PINS, SAVED_AT + 12 * HOUR)).toBeNull();
    // A copy that can never be shown again is removed.
    expect(store.saved()).toBeNull();
  });

  it("ignores a copy from the future (the device clock went back)", () => {
    seedSaved();
    expect(loadLastAnswer(PINS, SAVED_AT - MIN)).toBeNull();
  });

  it("ignores a copy made for other places", () => {
    const changes: Pin[][] = [
      [{ ...HOME, elevationFt: 262.3 }, SHOP],
      [{ ...HOME, lat: HOME.lat + 0.0001 }, SHOP],
      [{ ...HOME, lon: HOME.lon - 0.0001 }, SHOP],
      [{ ...HOME, id: "pother" }, SHOP],
      [HOME],
      [HOME, SHOP, { ...SHOP, id: "pthird" }],
      [SHOP, HOME],
    ];
    for (const pins of changes) {
      seedSaved();
      expect(loadLastAnswer(pins, SAVED_AT + MIN)).toBeNull();
    }
  });

  it("a new name alone doesn't change which places these are", () => {
    seedSaved();
    expect(loadLastAnswer([{ ...HOME, name: "Grandma's" }, SHOP], SAVED_AT + MIN)).not.toBeNull();
  });

  it("drops a damaged or hand-edited copy instead of showing it", () => {
    const bad: unknown[] = [
      "{not json",
      JSON.stringify(null),
      JSON.stringify([]),
      JSON.stringify({ pinsKey: pinsKeyFor(PINS), watches: [], now: NOW, savedAt: SAVED_AT }),
      JSON.stringify({ pinsKey: pinsKeyFor(PINS), watches: WATCHES(), now: NOW, savedAt: "yesterday" }),
      JSON.stringify({
        pinsKey: pinsKeyFor(PINS),
        watches: [{ ...homeWatch(), verdict: { tier: "FULL", band: "LIKELY" } }],
        now: NOW,
        savedAt: SAVED_AT,
      }),
      JSON.stringify({
        pinsKey: pinsKeyFor(PINS),
        watches: [{ ...homeWatch(), pinId: "pstranger" }],
        now: NOW,
        savedAt: SAVED_AT,
      }),
      JSON.stringify({
        pinsKey: pinsKeyFor(PINS),
        watches: [{ ...shopWatch(), gauge: { ...gauge(), observed: [{ t: 1 }] } }],
        now: NOW,
        savedAt: SAVED_AT,
      }),
      JSON.stringify({
        pinsKey: pinsKeyFor(PINS),
        watches: [{ ...shopWatch(), verdict: { ...shopWatch().verdict, stale: undefined } }],
        now: NOW,
        savedAt: SAVED_AT,
      }),
    ];
    for (const raw of bad) {
      store.data.set(LAST_ANSWER_KEY, raw as string);
      expect(loadLastAnswer(PINS, SAVED_AT + MIN)).toBeNull();
      expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
    }
  });

  it("keeps nothing for no places or no answers", () => {
    expect(saveLastAnswer([], WATCHES(), NOW)).toBe(false);
    expect(saveLastAnswer(PINS, [], NOW)).toBe(false);
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
    expect(loadLastAnswer([], SAVED_AT)).toBeNull();
  });
});

describe("an old answer reads as old, never as live", () => {
  it("under the usual limits it's shown just as it was", () => {
    seedSaved();
    const got = loadLastAnswer(PINS, SAVED_AT + 30 * MIN)!;
    const v = full(got.watches[0]);
    expect(v.stale).toEqual({
      observedH: 1,
      forecastH: 3.5,
      staleObserved: false,
      staleForecast: false,
    });
    expect(staleLineFor(v)).toBeNull();
  });

  it("three hours on, the reading is stale and every screen says so", () => {
    seedSaved();
    const got = loadLastAnswer(PINS, SAVED_AT + 3 * HOUR)!;
    const [home, shop] = got.watches;
    const v = full(home);
    expect(v.stale).toEqual({
      observedH: 3.5,
      forecastH: 6,
      staleObserved: true,
      staleForecast: false,
    });
    // Same flags on the flood-stage-only answer.
    expect(shop.verdict.tier === "CATEGORY" && shop.verdict.stale.staleObserved).toBe(true);

    // The "Heads up" line and "data delayed" chip key off staleInfo.
    expect(staleInfo(v)).toEqual({ stale: true, hours: 6 });
    expect(staleLineFor(v)).toBe(copy.staleness(6));

    // The sentence names what the last forecast said, with a calendar
    // date, instead of "tomorrow" from a clock that has moved on.
    const fresh = verdictSentence({
      pinName: HOME.name,
      verdict: homeWatch().verdict,
      gauge: home.gauge,
      now: NOW,
    });
    const aged = verdictSentence({
      pinName: HOME.name,
      verdict: v,
      gauge: home.gauge,
      now: got.now,
    });
    expect(fresh).toMatch(/peaks tomorrow/);
    expect(aged).toMatch(/^The last forecast had the Pearl River peaking on Oct 24/);
    expect(aged).not.toMatch(/today|tomorrow|now/);
  });

  it("counts 'hours from now' to the moment it's shown", () => {
    seedSaved();
    expect(full(loadLastAnswer(PINS, SAVED_AT + 3 * HOUR)!.watches[0]).crossing).toEqual({
      t: "2026-10-24T05:00:00Z",
      hoursFromNow: 7,
    });
    // Past the crossing time, the countdown is spent (screens hide <= 0).
    expect(
      full(loadLastAnswer(PINS, SAVED_AT + 11 * HOUR)!.watches[0]).crossing!.hoursFromNow,
    ).toBe(-1);
  });

  it("counts age on this browser's clock even when the server's clock differs", () => {
    // The server's clock ran an hour ahead of this browser's.
    const serverNow = "2026-10-23T20:00:00Z";
    expect(saveLastAnswer(PINS, WATCHES(), serverNow, SAVED_AT)).toBe(true);
    const got = loadLastAnswer(PINS, SAVED_AT + 2 * HOUR)!;
    expect(got.now).toBe("2026-10-23T22:00:00.000Z");
    expect(full(got.watches[0]).stale.observedH).toBe(2.5);
    expect(full(got.watches[0]).crossing!.hoursFromNow).toBe(7);
  });

  it("stale stays stale, and an answer with no gauge is left alone", () => {
    const stale: Staleness = {
      observedH: null,
      forecastH: null,
      staleObserved: true,
      staleForecast: true,
    };
    const w = { ...shopWatch(), verdict: { ...shopWatch().verdict, stale } } as PinWatch;
    const out = agedWatch(w, 10 * MIN, SAVED_AT + 10 * MIN);
    expect(out.verdict.tier === "CATEGORY" && out.verdict.stale).toEqual(stale);

    const alertOnly: PinWatch = {
      pinId: HOME.id,
      verdict: { tier: "ALERT_ONLY" },
      gauge: null,
      alerts: [],
      alertsOk: true,
    };
    expect(agedWatch(alertOnly, 5 * HOUR, SAVED_AT + 5 * HOUR)).toBe(alertOnly);
  });
});

describe("settleCheck: when the saved answer is read and written", () => {
  const answer = () => ({ now: NOW, watches: WATCHES() });

  it("own places: a good answer is saved", () => {
    store.savePins(PINS);
    const out = settleCheck({ pins: PINS, linked: false, answer: answer(), onScreen: null, nowMs: SAVED_AT });
    expect(out).toEqual({ kind: "fresh", watches: WATCHES(), now: NOW, updatedAt: SAVED_AT });
    expect(store.saved()).toMatchObject({ pinsKey: pinsKeyFor(PINS), savedAt: SAVED_AT, now: NOW });
  });

  it("own places: a good answer that lands after Delete all my data isn't saved", () => {
    // The check started with PINS; the visitor deleted everything meanwhile.
    const out = settleCheck({ pins: PINS, linked: false, answer: answer(), onScreen: null, nowMs: SAVED_AT });
    expect(out.kind).toBe("fresh");
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
  });

  it("a shared or example link never reads or writes it", () => {
    store.savePins(PINS);
    seedSaved();
    const before = store.data.get(LAST_ANSWER_KEY);

    const ok = settleCheck({ pins: PINS, linked: true, answer: answer(), onScreen: null, nowMs: SAVED_AT + HOUR });
    expect(ok.kind).toBe("fresh");
    const failed = settleCheck({ pins: PINS, linked: true, answer: null, onScreen: null, nowMs: SAVED_AT + HOUR });
    expect(failed).toEqual({ kind: "failed" });

    expect(store.touched(LAST_ANSWER_KEY)).toBe(false);
    expect(store.log).toEqual([]);
    expect(store.data.get(LAST_ANSWER_KEY)).toBe(before);
  });

  it("own places: a failed first check shows the saved answer, marked old", () => {
    seedSaved();
    const out = settleCheck({ pins: PINS, linked: false, answer: null, onScreen: null, nowMs: SAVED_AT + 2 * HOUR });
    expect(out.kind).toBe("saved");
    if (out.kind !== "saved") return;
    expect(out.updatedAt).toBe(SAVED_AT);
    expect(out.now).toBe("2026-10-23T21:00:00.000Z");
    expect(out.watches.map((w) => w.pinId)).toEqual([HOME.id, SHOP.id]);
  });

  it("own places: an old or mismatched copy is ignored", () => {
    seedSaved();
    expect(
      settleCheck({ pins: PINS, linked: false, answer: null, onScreen: null, nowMs: SAVED_AT + 13 * HOUR }),
    ).toEqual({ kind: "failed" });
    seedSaved();
    expect(
      settleCheck({ pins: [HOME], linked: false, answer: null, onScreen: null, nowMs: SAVED_AT + HOUR }),
    ).toEqual({ kind: "failed" });
  });

  it("own places: a fresh answer already on screen stays, and the copy isn't read", () => {
    seedSaved();
    const out = settleCheck({
      pins: PINS,
      linked: false,
      answer: null,
      onScreen: { key: pinsKeyFor(PINS), saved: false },
      nowMs: SAVED_AT + HOUR,
    });
    expect(out).toEqual({ kind: "failed" });
    expect(store.touched(LAST_ANSWER_KEY)).toBe(false);
  });

  it("own places: an answer on screen for other places doesn't count", () => {
    seedSaved();
    const out = settleCheck({
      pins: PINS,
      linked: false,
      answer: null,
      onScreen: { key: pinsKeyFor([HOME]), saved: false },
      nowMs: SAVED_AT + HOUR,
    });
    expect(out.kind).toBe("saved");
  });

  it("own places: a saved answer on screen ages, then goes at 12 hours", () => {
    seedSaved();
    const onScreen = { key: pinsKeyFor(PINS), saved: true };
    const later = settleCheck({ pins: PINS, linked: false, answer: null, onScreen, nowMs: SAVED_AT + 6 * HOUR });
    expect(later.kind).toBe("saved");
    if (later.kind === "saved") {
      expect(full(later.watches[0]).stale.staleObserved).toBe(true);
    }
    expect(
      settleCheck({ pins: PINS, linked: false, answer: null, onScreen, nowMs: SAVED_AT + 12 * HOUR }),
    ).toEqual({ kind: "expired" });
  });

  it("own places: a saved answer on screen comes down once a place is removed, at any age", () => {
    store.savePins(PINS);
    seedSaved();
    // On screen: the saved answer for both places. Then Shop is removed.
    const onScreen = { key: pinsKeyFor(PINS), saved: true };
    const left = removePin(SHOP.id);
    expect(left).toEqual([HOME]);
    for (const age of [MIN, HOUR, 11 * HOUR, 20 * HOUR, 48 * HOUR]) {
      expect(
        settleCheck({ pins: left, linked: false, answer: null, onScreen, nowMs: SAVED_AT + age }),
      ).toEqual({ kind: "expired" });
    }
  });

  it("own places: a saved answer on screen for other places is replaced by one that fits", () => {
    // Another tab saved an answer for just Home; the screen shows the old pair.
    seedSaved(SAVED_AT + HOUR, [HOME], [homeWatch()]);
    const out = settleCheck({
      pins: [HOME],
      linked: false,
      answer: null,
      onScreen: { key: pinsKeyFor(PINS), saved: true },
      nowMs: SAVED_AT + 2 * HOUR,
    });
    expect(out.kind).toBe("saved");
    if (out.kind === "saved") {
      expect(out.updatedAt).toBe(SAVED_AT + HOUR);
      expect(out.watches.map((w) => w.pinId)).toEqual([HOME.id]);
    }
  });

  it("own places: blocked storage takes a saved answer on screen down", () => {
    seedSaved();
    store.mode = "throw";
    expect(
      settleCheck({
        pins: PINS,
        linked: false,
        answer: null,
        onScreen: { key: pinsKeyFor(PINS), saved: true },
        nowMs: SAVED_AT + HOUR,
      }),
    ).toEqual({ kind: "expired" });
  });
});

describe("lastAnswerTooOld", () => {
  it("is false under 12 hours, true at 12 hours or later and for a copy from the future", () => {
    expect(lastAnswerTooOld(SAVED_AT, SAVED_AT)).toBe(false);
    expect(lastAnswerTooOld(SAVED_AT, SAVED_AT + 12 * HOUR - 1)).toBe(false);
    expect(lastAnswerTooOld(SAVED_AT, SAVED_AT + 12 * HOUR)).toBe(true);
    expect(lastAnswerTooOld(SAVED_AT, SAVED_AT + 30 * HOUR)).toBe(true);
    expect(lastAnswerTooOld(SAVED_AT, SAVED_AT - 1)).toBe(true);
  });
});

describe("clearing it", () => {
  beforeEach(() => {
    store.savePins(PINS);
    seedSaved();
  });

  it("Delete all my data removes the places and the saved answer", () => {
    clearAllPins();
    expect(store.data.has(STORAGE_KEYS.pins)).toBe(false);
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
  });

  it("removing a place clears it", () => {
    removePin(SHOP.id);
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
  });

  it("renaming a place clears it", () => {
    renamePin(HOME.id, "Grandma's");
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
  });

  it("adding a place clears it", () => {
    const res = addPin({ ...HOME, id: "pnew", name: "School" });
    expect(res.ok).toBe(true);
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
  });

  it("clearLastAnswer leaves the places alone", () => {
    clearLastAnswer();
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
    expect(store.data.has(STORAGE_KEYS.pins)).toBe(true);
  });
});

describe("blocked storage breaks nothing", () => {
  it("every call returns quietly when storage throws", () => {
    store.mode = "throw";
    expect(saveLastAnswer(PINS, WATCHES(), NOW, SAVED_AT)).toBe(false);
    expect(loadLastAnswer(PINS, SAVED_AT)).toBeNull();
    expect(() => clearLastAnswer()).not.toThrow();
    expect(() => clearAllPins()).not.toThrow();
    expect(() => removePin(HOME.id)).not.toThrow();
    expect(
      settleCheck({ pins: PINS, linked: false, answer: { now: NOW, watches: WATCHES() }, onScreen: null }).kind,
    ).toBe("fresh");
    expect(settleCheck({ pins: PINS, linked: false, answer: null, onScreen: null })).toEqual({
      kind: "failed",
    });
  });

  it("works when there is no localStorage at all", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(saveLastAnswer(PINS, WATCHES(), NOW, SAVED_AT)).toBe(false);
    expect(loadLastAnswer(PINS, SAVED_AT)).toBeNull();
    expect(() => clearLastAnswer()).not.toThrow();
  });

  it("a write that doesn't fit removes the older copy instead of keeping it", () => {
    seedSaved();
    const quota = vi.spyOn(store, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(saveLastAnswer(PINS, WATCHES(), NOW, SAVED_AT + HOUR)).toBe(false);
    expect(store.data.has(LAST_ANSWER_KEY)).toBe(false);
    quota.mockRestore();
  });
});

describe("fetchWatches", () => {
  const reply = (body: unknown) =>
    vi.fn(async () => ({ json: async () => body }) as unknown as Response);

  it("returns the answer when the server says ok", async () => {
    const f = reply({ ok: true, now: NOW, watches: WATCHES() });
    expect(await fetchWatches(PINS, f)).toEqual({ now: NOW, watches: WATCHES() });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/watch");
    expect(JSON.parse(init.body as string)).toEqual({ pins: PINS });
  });

  it("returns null for a refusal, a broken body or no network", async () => {
    expect(await fetchWatches(PINS, reply({ ok: false, error: "UPSTREAM" }))).toBeNull();
    expect(await fetchWatches(PINS, reply({ ok: true, watches: "nope" }))).toBeNull();
    const notJson = vi.fn(
      async () =>
        ({
          json: async () => {
            throw new SyntaxError("Unexpected token <");
          },
        }) as unknown as Response,
    );
    expect(await fetchWatches(PINS, notJson)).toBeNull();
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchWatches(PINS, offline)).toBeNull();
  });
});

describe("useWatches on the server", () => {
  it("first render touches no storage and claims nothing saved (no hydration mismatch)", () => {
    seedSaved();
    store.savePins(PINS);
    store.log.length = 0;
    function Probe() {
      const s = useWatches();
      return (
        <p>
          {JSON.stringify({
            watches: s.watches.length,
            loading: s.loading,
            error: s.error,
            fromSaved: s.fromSaved,
            updatedAt: s.updatedAt,
          })}
        </p>
      );
    }
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain(
      JSON.stringify({ watches: 0, loading: true, error: false, fromSaved: false, updatedAt: null })
        .replace(/"/g, "&quot;"),
    );
    expect(store.log).toEqual([]);
  });
});
