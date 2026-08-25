import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchJson } from "@/lib/net";

let live = 0;
let peak = 0;

function installFetch(delay = 0) {
  vi.stubGlobal("fetch", async () => {
    live++;
    if (live > peak) peak = live;
    await new Promise((r) => setTimeout(r, delay));
    live--;
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as unknown as Response;
  });
}

beforeEach(() => {
  live = 0;
  peak = 0;
});

describe("semaphore", () => {
  it("A: plain burst of 40, all started synchronously", async () => {
    installFetch(5);
    await Promise.all(
      Array.from({ length: 40 }, (_, i) => fetchJson(`https://x.test/${i}`)),
    );
    console.log("A peak =", peak);
    expect(peak).toBeLessThanOrEqual(8);
  });

  it("B: burst + stragglers arriving from already-queued microtasks", async () => {
    installFetch(5);
    // Saturate
    const first = Array.from({ length: 12 }, (_, i) =>
      fetchJson(`https://x.test/a${i}`),
    );
    // Callers whose acquire() runs from a microtask that was queued
    // BEFORE any release() microtask — the barge window.
    const later: Promise<unknown>[] = [];
    for (let i = 0; i < 20; i++) {
      later.push(
        Promise.resolve().then(() => fetchJson(`https://x.test/b${i}`)),
      );
    }
    await Promise.all([...first, ...later]);
    console.log("B peak =", peak);
    expect(peak).toBeLessThanOrEqual(8);
  });

  it("C: staggered arrivals via timers (many independent 'requests')", async () => {
    installFetch(3);
    const all: Promise<unknown>[] = [];
    for (let r = 0; r < 30; r++) {
      all.push(
        new Promise((res) =>
          setTimeout(
            () =>
              res(
                Promise.all(
                  Array.from({ length: 4 }, (_, i) =>
                    fetchJson(`https://x.test/r${r}-${i}`),
                  ),
                ),
              ),
            r % 7,
          ),
        ),
      );
    }
    await Promise.all(all);
    console.log("C peak =", peak);
    expect(peak).toBeLessThanOrEqual(8);
  });

  it("D: failures (non-ok / throw) do not leak permits", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      live++;
      if (live > peak) peak = live;
      await new Promise((r) => setTimeout(r, 1));
      live--;
      if (n % 3 === 0) throw new Error("network down");
      return {
        ok: n % 5 !== 0,
        status: n % 5 === 0 ? 503 : 200,
        json: async () => ({}),
      } as unknown as Response;
    });
    await Promise.allSettled(
      Array.from({ length: 60 }, (_, i) => fetchJson(`https://x.test/f${i}`)),
    );
    // If permits leaked, a fresh saturating burst would run at reduced
    // concurrency or hang.
    peak = 0;
    const t = Date.now();
    await Promise.all(
      Array.from({ length: 16 }, (_, i) => fetchJson(`https://x.test/g${i}`)),
    ).catch(() => {});
    console.log("D peak after failures =", peak, "ms", Date.now() - t);
    expect(peak).toBeGreaterThan(0);
  });
});
