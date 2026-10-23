/**
 * useWatches end to end with the last saved answer (package lastanswer).
 * There's no DOM here, so React's hooks are swapped for a tiny
 * single-component stand-in: state lives in slots, effects run when the
 * test says so. That's enough to drive the real hook through mount,
 * fetch, failure and refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rt = vi.hoisted(() => {
  const slots: unknown[] = [];
  const effects: Array<() => void | (() => void)> = [];
  let i = 0;
  let mounted = false;
  return {
    slots,
    effects,
    next: () => i++,
    begin: () => {
      i = 0;
    },
    mounted: () => mounted,
    setMounted: () => {
      mounted = true;
    },
    reset: () => {
      slots.length = 0;
      effects.length = 0;
      i = 0;
      mounted = false;
    },
  };
});

vi.mock("react", () => ({
  useState: (init: unknown) => {
    const k = rt.next();
    if (!(k in rt.slots)) rt.slots[k] = init;
    const set = (v: unknown) => {
      rt.slots[k] = typeof v === "function" ? (v as (p: unknown) => unknown)(rt.slots[k]) : v;
    };
    return [rt.slots[k], set];
  },
  useRef: (init: unknown) => {
    const k = rt.next();
    if (!(k in rt.slots)) rt.slots[k] = { current: init };
    return rt.slots[k];
  },
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void | (() => void)) => {
    if (!rt.mounted()) rt.effects.push(fn);
  },
}));

import { STORAGE_KEYS } from "@/lib/config";
import { LAST_ANSWER_KEY, saveLastAnswer } from "@/lib/last-answer";
import { useWatches } from "@/lib/use-watch";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";

const NOW = "2026-10-23T19:00:00Z";
const T0 = Date.parse(NOW);
const HOUR = 3_600_000;

const HOME: Pin = {
  id: "phome",
  name: "Home",
  matchedAddress: "100 E CAPITOL ST, JACKSON, MS, 39201",
  lat: 32.300441828077,
  lon: -90.188419699815,
  elevationFt: 262.2,
};

const WATCH: PinWatch = {
  pinId: HOME.id,
  verdict: { tier: "ALERT_ONLY" },
  gauge: null,
  alerts: [],
  alertsOk: true,
};

/* storage + network stand-ins ------------------------------------- */

const data = new Map<string, string>();
const log: string[] = [];
const storage = {
  getItem: (k: string) => (log.push(`get ${k}`), data.get(k) ?? null),
  setItem: (k: string, v: string) => (log.push(`set ${k}`), void data.set(k, v)),
  removeItem: (k: string) => (log.push(`remove ${k}`), void data.delete(k)),
};
const lastAnswerTouched = () => log.some((l) => l.endsWith(LAST_ANSWER_KEY));

let online = true;
const fetchMock = vi.fn(async () => {
  if (!online) throw new TypeError("Failed to fetch");
  return { json: async () => ({ ok: true, now: NOW, watches: [WATCH] }) } as unknown as Response;
});

/* driving the hook ------------------------------------------------- */

let cleanup: void | (() => void);

function render(override: Pin[] | null) {
  rt.begin();
  // The stand-in renderer above plays React here; this is one "render".
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWatches(override);
}

async function settle() {
  for (let n = 0; n < 20; n++) await Promise.resolve();
}

/** Mount: first render, run the effect (which checks the river), settle. */
async function mount(override: Pin[] | null = null) {
  render(override);
  rt.setMounted();
  cleanup = rt.effects[0]?.();
  await settle();
  return render(override);
}

beforeEach(() => {
  rt.reset();
  data.clear();
  log.length = 0;
  online = true;
  fetchMock.mockClear();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(T0);
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  if (typeof cleanup === "function") cleanup();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useWatches with the last saved answer", () => {
  it("saves a good answer for this visitor's own places", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    const s = await mount();
    expect(s.watches).toEqual([WATCH]);
    expect(s).toMatchObject({ error: false, fromSaved: false, updatedAt: T0, loading: false });
    expect(JSON.parse(data.get(LAST_ANSWER_KEY)!)).toMatchObject({ savedAt: T0, now: NOW });
  });

  it("when the signal drops before anything shows, the saved answer comes back marked old", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    vi.setSystemTime(T0 + 2 * HOUR);
    online = false;
    const s = await mount();
    expect(s.watches.map((w) => w.pinId)).toEqual([HOME.id]);
    expect(s).toMatchObject({ error: true, fromSaved: true, updatedAt: T0, loading: false });
    expect(s.now).toBe("2026-10-23T21:00:00.000Z");
  });

  it("a fresh answer later replaces it", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    vi.setSystemTime(T0 + HOUR);
    online = false;
    let s = await mount();
    expect(s.fromSaved).toBe(true);
    online = true;
    s.refresh();
    await settle();
    s = render(null);
    expect(s).toMatchObject({ error: false, fromSaved: false, updatedAt: T0 + HOUR });
  });

  it("a saved answer on screen goes away once it turns 12 hours old", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    vi.setSystemTime(T0 + 11 * HOUR);
    online = false;
    let s = await mount();
    expect(s.fromSaved).toBe(true);
    vi.setSystemTime(T0 + 12 * HOUR);
    s.refresh();
    await settle();
    s = render(null);
    expect(s).toMatchObject({ watches: [], error: true, fromSaved: false, updatedAt: null });
  });

  it("an answer from this visit stays up through a failed refresh, as before", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    let s = await mount();
    online = false;
    log.length = 0;
    vi.setSystemTime(T0 + HOUR);
    s.refresh();
    await settle();
    s = render(null);
    expect(s).toMatchObject({ watches: [WATCH], error: true, fromSaved: false, updatedAt: T0 });
    expect(lastAnswerTouched()).toBe(false);
  });

  it("a shared or example link never reads or writes it, success or failure", async () => {
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    const before = data.get(LAST_ANSWER_KEY);
    log.length = 0;
    const linked = [{ ...HOME }];

    let s = await mount(linked);
    expect(s).toMatchObject({ watches: [WATCH], error: false, fromSaved: false });

    online = false;
    s.refresh();
    await settle();
    s = render(linked);
    expect(s.error).toBe(true);
    expect(s.fromSaved).toBe(false);

    // Not one storage call: not the pins, not the saved answer.
    expect(log).toEqual([]);
    expect(data.get(LAST_ANSWER_KEY)).toBe(before);
  });

  it("a linked first load that fails shows nothing saved, even for the same places", async () => {
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    log.length = 0;
    online = false;
    const s = await mount([{ ...HOME }]);
    expect(s).toMatchObject({ watches: [], error: true, fromSaved: false });
    expect(lastAnswerTouched()).toBe(false);
  });

  it("a broken link (no places) leaves the saved answer alone", async () => {
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    log.length = 0;
    await mount([]);
    expect(log).toEqual([]);
    expect(data.has(LAST_ANSWER_KEY)).toBe(true);
  });

  it("no saved places: the saved answer is cleared too", async () => {
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    const s = await mount();
    expect(s.pins).toEqual([]);
    expect(data.has(LAST_ANSWER_KEY)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
