import { describe, expect, it } from "vitest";
import { cached, clearCache } from "@/lib/cache";
import { lookupAddress } from "@/lib/watch-service";

describe("failures are never cached", () => {
  it("shouldCache=false serves the value without storing it", async () => {
    clearCache();
    let calls = 0;
    const run = () =>
      cached("k", 60_000, async () => { calls++; return null; }, (v) => v !== null);
    expect(await run()).toBeNull();
    expect(await run()).toBeNull();
    expect(calls).toBe(2); // re-asked, not pinned
  });

  it("recovers immediately once the upstream comes back", async () => {
    clearCache();
    let up = false;
    let calls = 0;
    const run = () =>
      cached("k2", 60_000, async () => { calls++; return up ? "data" : null; }, (v) => v !== null);
    expect(await run()).toBeNull();
    up = true;
    expect(await run()).toBe("data");
    expect(await run()).toBe("data"); // now cached
    expect(calls).toBe(2);
  });

  it("a geocoder outage is not pinned for the day", async () => {
    clearCache();
    let down = true;
    const fetchers = {
      json: async (url: string) => {
        if (down) throw new Error("census down");
        if (url.includes("epqs")) return { value: 275.5 };
        return { result: { addressMatches: [{ matchedAddress: "1 MAIN ST", coordinates: { x: -90.2, y: 32.3 } }] } };
      },
      text: async () => "",
    };
    const first = await lookupAddress("1 Main St", fetchers);
    expect(first).toEqual({ ok: false, error: "UPSTREAM" });
    down = false;
    const second = await lookupAddress("1 Main St", fetchers);
    expect(second.ok).toBe(true); // recovered, not serving the cached failure
  });
});
