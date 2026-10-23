import { describe, expect, it } from "vitest";
import { EXAMPLE_HREF, EXAMPLE_PINS } from "@/lib/example";
import { decodeWatchLink } from "@/lib/watch-link";

describe("the example place", () => {
  it("round-trips through a real Watch Link", () => {
    const wl = new URL(EXAMPLE_HREF, "https://x.test").searchParams.get("wl");
    expect(wl).toBeTruthy();
    const pins = decodeWatchLink(wl as string);
    expect(pins?.map((p) => p.name)).toEqual(EXAMPLE_PINS.map((p) => p.name));
    expect(pins?.every((p) => !p.approximate)).toBe(true);
  });

  it("keeps both spots close enough in height to share one picture", () => {
    const [a, b] = EXAMPLE_PINS;
    // WatchClient only draws a second marker within 40 ft.
    expect(Math.abs(a.elevationFt - b.elevationFt)).toBeLessThan(40);
  });

  it("marks itself as an example", () => {
    expect(EXAMPLE_HREF).toMatch(/&ex=1$/);
  });
});
