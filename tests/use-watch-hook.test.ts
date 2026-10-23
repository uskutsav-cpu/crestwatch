/**
 * useWatches end to end with the last saved answer (package lastanswer).
 * There's no DOM here, so React's hooks are swapped for a tiny
 * single-component stand-in: state lives in slots, useCallback and
 * useEffect compare their deps the way React does, and effects run after
 * each render. That's enough to drive the real hook through mount, fetch,
 * failure, refresh and the 12-hour timer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rt = vi.hoisted(() => {
  type Deps = readonly unknown[] | undefined;
  type EffectSlot = { kind: "effect"; deps: Deps; cleanup: void | (() => void) };
  const slots: unknown[] = [];
  let pending: Array<() => void> = [];
  let i = 0;
  const changed = (a: Deps, b: Deps) =>
    !a || !b || a.length !== b.length || a.some((x, j) => !Object.is(x, b[j]));
  return {
    slots,
    changed,
    next: () => i++,
    begin: () => {
      i = 0;
      pending = [];
    },
    schedule: (fn: () => void) => pending.push(fn),
    /** Run the effects this render scheduled, like React's commit. */
    commit: () => {
      const run = pending;
      pending = [];
      for (const fn of run) fn();
    },
    unmount: () => {
      for (const s of slots) {
        const e = s as EffectSlot | undefined;
        if (e?.kind === "effect" && typeof e.cleanup === "function") e.cleanup();
      }
    },
    reset: () => {
      slots.length = 0;
      pending = [];
      i = 0;
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
  useCallback: (fn: unknown, deps?: readonly unknown[]) => {
    const k = rt.next();
    const prev = rt.slots[k] as { fn: unknown; deps?: readonly unknown[] } | undefined;
    if (prev && !rt.changed(deps, prev.deps)) return prev.fn;
    rt.slots[k] = { fn, deps };
    return fn;
  },
  useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => {
    const k = rt.next();
    const prev = rt.slots[k] as
      | { kind: "effect"; deps?: readonly unknown[]; cleanup: void | (() => void) }
      | undefined;
    if (prev && !rt.changed(deps, prev.deps)) return;
    rt.schedule(() => {
      if (typeof prev?.cleanup === "function") prev.cleanup();
      rt.slots[k] = { kind: "effect", deps, cleanup: fn() };
    });
  },
}));

import { STORAGE_KEYS } from "@/lib/config";
import { LAST_ANSWER_KEY, saveLastAnswer } from "@/lib/last-answer";
import { removePin } from "@/lib/pin-store";
import { useWatches } from "@/lib/use-watch";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";

const NOW = "2026-10-23T19:00:00Z";
const T0 = Date.parse(NOW);
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
};

const watchFor = (pin: Pin): PinWatch => ({
  pinId: pin.id,
  verdict: { tier: "ALERT_ONLY" },
  gauge: null,
  alerts: [],
  alertsOk: true,
});
const WATCH = watchFor(HOME);

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
const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
  if (!online) throw new TypeError("Failed to fetch");
  const { pins } = JSON.parse(String(init?.body)) as { pins: Pin[] };
  return {
    json: async () => ({ ok: true, now: NOW, watches: pins.map(watchFor) }),
  } as unknown as Response;
});

/* driving the hook ------------------------------------------------- */

function render(override: Pin[] | null) {
  rt.begin();
  // The stand-in renderer above plays React here; this is one "render".
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const s = useWatches(override);
  rt.commit();
  return s;
}

async function settle() {
  for (let n = 0; n < 20; n++) await Promise.resolve();
}

/** Mount: first render (its effect checks the river), settle, render again. */
async function mount(override: Pin[] | null = null) {
  render(override);
  await settle();
  return render(override);
}

/** Check again, let it finish, render. */
async function refreshed(s: { refresh: () => void }, override: Pin[] | null = null) {
  s.refresh();
  await settle();
  return render(override);
}

beforeEach(() => {
  rt.reset();
  data.clear();
  log.length = 0;
  online = true;
  fetchMock.mockClear();
  vi.useFakeTimers({
    toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(T0);
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  rt.unmount();
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
    s = await refreshed(s);
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
    s = await refreshed(s);
    expect(s).toMatchObject({ watches: [], error: true, fromSaved: false, updatedAt: null });
  });

  it("it comes down at exactly 12 hours even when no check runs then", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    // Ten minutes left; the next 15-minute check is after that.
    vi.setSystemTime(T0 + 11 * HOUR + 50 * MIN);
    online = false;
    let s = await mount();
    expect(s).toMatchObject({ fromSaved: true, updatedAt: T0 });
    const checks = fetchMock.mock.calls.length;

    vi.advanceTimersByTime(10 * MIN - 1);
    s = render(null);
    expect(s.fromSaved).toBe(true);

    vi.advanceTimersByTime(1);
    s = render(null);
    expect(s).toMatchObject({ watches: [], error: true, fromSaved: false, updatedAt: null });
    // No network was needed to take it down.
    expect(fetchMock.mock.calls.length).toBe(checks);
  });

  it("the 12-hour timer is dropped once a fresh answer is up", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    saveLastAnswer([HOME], [WATCH], NOW, T0);
    vi.setSystemTime(T0 + 11 * HOUR + 50 * MIN);
    online = false;
    let s = await mount();
    expect(s.fromSaved).toBe(true);
    online = true;
    s = await refreshed(s);
    expect(s).toMatchObject({ fromSaved: false, error: false });

    vi.advanceTimersByTime(10 * MIN);
    s = render(null);
    expect(s).toMatchObject({ watches: [WATCH], fromSaved: false, error: false });
  });

  it("after a place is removed offline, the saved answer comes down instead of freezing", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME, SHOP]));
    saveLastAnswer([HOME, SHOP], [watchFor(HOME), watchFor(SHOP)], NOW, T0);
    vi.setSystemTime(T0 + HOUR);
    online = false;
    let s = await mount();
    expect(s).toMatchObject({ fromSaved: true, updatedAt: T0 });
    expect(s.watches.map((w) => w.pinId)).toEqual([HOME.id, SHOP.id]);

    // Places removes Shop, then checks again (still no signal).
    removePin(SHOP.id);
    s = await refreshed(s);
    expect(s.pins).toEqual([HOME]);
    expect(s).toMatchObject({ watches: [], error: true, fromSaved: false, updatedAt: null });

    // A day later, still nothing old passes for an answer.
    vi.setSystemTime(T0 + 20 * HOUR);
    s = await refreshed(s);
    expect(s).toMatchObject({ watches: [], error: true, fromSaved: false, updatedAt: null });
  });

  it("an answer from this visit stays up through a failed refresh, as before", async () => {
    data.set(STORAGE_KEYS.pins, JSON.stringify([HOME]));
    let s = await mount();
    online = false;
    log.length = 0;
    vi.setSystemTime(T0 + HOUR);
    s = await refreshed(s);
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
    s = await refreshed(s, linked);
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
