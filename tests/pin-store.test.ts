import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PINS, STORAGE_KEYS } from "@/lib/config";
import { addPin, loadPins } from "@/lib/pin-store";
import type { Pin } from "@/lib/pins";

/** A Storage stand-in. `mode` lets a test make the browser refuse writes. */
function fakeStorage() {
  const data = new Map<string, string>();
  const s = {
    mode: "ok" as "ok" | "throw" | "drop",
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (s.mode === "throw") {
        throw new DOMException("blocked", "QuotaExceededError");
      }
      if (s.mode === "drop") return; // accepts the write, keeps nothing
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    raw: () => data.get(STORAGE_KEYS.pins),
    seed: (v: unknown) => data.set(STORAGE_KEYS.pins, JSON.stringify(v)),
  };
  return s;
}

function pin(id: string, name = `Place ${id}`): Pin {
  return {
    id,
    name,
    matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
    lat: 32.3,
    lon: -90.18,
    elevationFt: 275.5,
  };
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  vi.stubGlobal("localStorage", store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("addPin", () => {
  it("saves a new pin under the cap and says so", () => {
    store.seed([pin("a"), pin("b")]);
    const res = addPin(pin("c", "  Grandma's  "));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pin.name).toBe("Grandma's");
    expect(res.pins.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(loadPins().map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("fills the last slot", () => {
    store.seed(["a", "b", "c", "d"].map((id) => pin(id)));
    const res = addPin(pin("e"));
    expect(res.ok).toBe(true);
    expect(loadPins()).toHaveLength(MAX_PINS);
  });

  it("refuses a new pin when the list is full and changes nothing", () => {
    const five = ["a", "b", "c", "d", "e"].map((id) => pin(id));
    store.seed(five);
    const before = store.raw();
    const res = addPin(pin("f", "Sixth place"));
    expect(res).toEqual({ ok: false, reason: "full", pins: five });
    expect(store.raw()).toBe(before);
    expect(loadPins().some((p) => p.name === "Sixth place")).toBe(false);
  });

  it("replaces a pin with the same id in place, even when full", () => {
    store.seed(["a", "b", "c", "d", "e"].map((id) => pin(id)));
    const res = addPin(pin("c", "Renamed"));
    expect(res.ok).toBe(true);
    const ids = loadPins().map((p) => [p.id, p.name]);
    expect(ids).toHaveLength(MAX_PINS);
    expect(ids[2]).toEqual(["c", "Renamed"]);
  });

  it("reports blocked storage instead of pretending it saved", () => {
    store.mode = "throw";
    const res = addPin(pin("a", "‮Home"));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("storage");
    if (res.reason !== "storage") return;
    // The caller gets the cleaned pin back to show without storage.
    expect(res.pin.id).toBe("a");
    expect(res.pin.name).toBe("Home");
    expect(loadPins()).toEqual([]);
  });

  it("reports storage that accepts a write but keeps nothing", () => {
    store.mode = "drop";
    const res = addPin(pin("a"));
    expect(res).toMatchObject({ ok: false, reason: "storage" });
  });

  it("reports storage that can't even be read", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(addPin(pin("a"))).toMatchObject({ ok: false, reason: "storage" });
  });
});

describe("loadPins", () => {
  it("names a whitespace-only pin 'My place'", () => {
    store.seed([pin("a", "   ")]);
    expect(loadPins()[0].name).toBe("My place");
  });

  it("names a bidi-only pin 'My place'", () => {
    store.seed([pin("a", "‮‮")]);
    expect(loadPins()[0].name).toBe("My place");
  });

  it("strips bidi overrides from a stored name", () => {
    store.seed([pin("a", "‮emoh")]);
    expect(loadPins()[0].name).toBe("emoh");
  });

  it("keeps the first pin when two share an id", () => {
    store.seed([pin("a", "Home"), pin("b", "Shop"), pin("a", "Imposter")]);
    expect(loadPins().map((p) => p.name)).toEqual(["Home", "Shop"]);
  });

  it("drops duplicates before applying the cap", () => {
    store.seed([
      pin("a"),
      pin("a"),
      pin("b"),
      pin("c"),
      pin("d"),
      pin("e"),
    ]);
    expect(loadPins().map((p) => p.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("drops bad shapes and survives junk", () => {
    store.seed([pin("a"), { id: "x" }, null, pin("b")]);
    expect(loadPins().map((p) => p.id)).toEqual(["a", "b"]);
    store.seed({ not: "a list" });
    expect(loadPins()).toEqual([]);
    store.setItem(STORAGE_KEYS.pins, "{not json");
    expect(loadPins()).toEqual([]);
  });
});
