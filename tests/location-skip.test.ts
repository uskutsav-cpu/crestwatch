import { describe, it, expect } from "vitest";
import { groundHeightOrSkip } from "@/lib/location-save";
describe("Skip optional ground lookup", () => {
  const point = { lat: 32.3, lon: -90.8 };
  const waiting: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Canceled", "AbortError")),
        { once: true },
      );
    });
  it("returns null promptly when explicitly skipped and releases the skip callback", async () => {
    let skip: (() => void) | null = null;
    const p = groundHeightOrSkip(
      point,
      waiting,
      new AbortController().signal,
      (fn) => (skip = fn),
    );
    expect(skip).not.toBeNull();
    (skip as unknown as () => void)();
    expect(await p).toBeNull();
    expect(skip).toBeNull();
  });
  it("propagates cancellation rather than treating it as permission to continue saving", async () => {
    const c = new AbortController();
    const p = groundHeightOrSkip(point, waiting, c.signal, () => {});
    c.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
  it("preserves a successful ground height and clears its callback", async () => {
    let callback: unknown;
    const fetcher: typeof fetch = async () =>
      Response.json({ ok: true, elevationFt: 92.7 });
    expect(
      await groundHeightOrSkip(
        point,
        fetcher,
        new AbortController().signal,
        (fn) => (callback = fn),
      ),
    ).toBe(92.7);
    expect(callback).toBeNull();
  });
  it("does not start a lookup after cancellation", async () => {
    const c = new AbortController();
    c.abort();
    let called = false;
    await expect(
      groundHeightOrSkip(
        point,
        async () => {
          called = true;
          return Response.json({});
        },
        c.signal,
        () => {},
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(called).toBe(false);
  });
});
