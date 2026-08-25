import { describe, expect, it, vi } from "vitest";

/**
 * The upstream concurrency gate (lib/net.ts). One /api/watch request can
 * fan out to dozens of federal fetches; the gate keeps a burst from
 * hammering the upstreams. Barging past the cap was a real defect —
 * release() used to decrement before the woken waiter incremented.
 */

const CAP = 8;

function harness() {
  let open = 0;
  let peak = 0;
  const gates: Array<() => void> = [];
  vi.stubGlobal("fetch", async () => {
    open++;
    if (open > peak) peak = open;
    await new Promise<void>((r) => gates.push(r));
    open--;
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  });
  return { gates, peak: () => peak };
}

const tick = async (n: number) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

describe("upstream concurrency gate", () => {
  it("holds the cap at every microtask offset when a caller barges", async () => {
    const peaks: number[] = [];
    for (let offset = 0; offset <= 8; offset++) {
      vi.resetModules();
      const h = harness();
      const { fetchJson } = await import("@/lib/net");
      const go = (u: string) => {
        const p = fetchJson(u);
        p.catch(() => {});
        return p;
      };

      for (let i = 0; i < CAP; i++) go(`https://x.test/a${i}`);
      await tick(30);
      go("https://x.test/waiter");
      await tick(10);

      // Free one permit, then barge in `offset` microtasks later.
      h.gates.shift()!();
      let chain: Promise<void> = Promise.resolve();
      for (let i = 0; i < offset; i++) chain = chain.then(() => {});
      chain.then(() => go("https://x.test/barge"));
      await tick(80);
      peaks.push(h.peak());
    }
    expect(Math.max(...peaks)).toBeLessThanOrEqual(CAP);
  });

  it("returns the permit when a request throws", async () => {
    vi.resetModules();
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      throw new Error("network down");
    });
    const { fetchJson } = await import("@/lib/net");
    // Far more failures than the cap: if permits leaked, this would hang.
    for (let i = 0; i < CAP * 3; i++) {
      await expect(fetchJson(`https://x.test/f${i}`)).rejects.toThrow();
    }
    expect(calls).toBe(CAP * 3);
  });

  it("drains a queue larger than the cap without deadlocking", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }) as unknown as Response);
    const { fetchJson } = await import("@/lib/net");
    const results = await Promise.all(
      Array.from({ length: CAP * 5 }, (_, i) => fetchJson(`https://x.test/q${i}`)),
    );
    expect(results).toHaveLength(CAP * 5);
  });

  it("rejects a non-OK response without leaking the permit", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as unknown as Response);
    const { fetchJson } = await import("@/lib/net");
    await expect(fetchJson("https://x.test/down")).rejects.toThrow(/503/);
    // A follow-up call still gets a permit.
    await expect(fetchJson("https://x.test/down2")).rejects.toThrow(/503/);
  });
});
