import { describe, expect, it } from "vitest";
import { trendOf } from "@/lib/trend";
import { heightGloss } from "@/lib/kid-scale";

const s = (pairs: Array<[number, number]>) =>
  pairs.map(([h, v]) => ({
    t: new Date(Date.parse("2026-03-01T12:00:00Z") + h * 3_600_000).toISOString(),
    stageFt: v,
  }));

describe("trendOf", () => {
  it("calls a half-foot climb over six hours rising", () => {
    expect(trendOf(s([[-6, 9.0], [-3, 9.2], [0, 9.5]]))).toBe("rising");
  });

  it("calls a drop falling", () => {
    expect(trendOf(s([[-6, 9.5], [0, 9.0]]))).toBe("falling");
  });

  it("ignores noise smaller than two tenths", () => {
    expect(trendOf(s([[-6, 9.0], [0, 9.1]]))).toBe("steady");
  });

  it("uses the oldest point when the series is short", () => {
    expect(trendOf(s([[-1, 9.0], [0, 9.4]]))).toBe("rising");
  });

  it("returns null without enough data", () => {
    expect(trendOf([])).toBeNull();
    expect(trendOf(s([[0, 9.0]]))).toBeNull();
  });

  it("survives unparseable timestamps", () => {
    expect(
      trendOf([{ t: "garbage", stageFt: 1 }, ...s([[-6, 9.0], [0, 9.5]])]),
    ).toBe("rising");
  });
});

describe("heightGloss", () => {
  it("maps heights to things a kid can picture", () => {
    expect(heightGloss(1)).toContain("knee-high");
    expect(heightGloss(2)).toContain("kitchen table");
    expect(heightGloss(3)).toContain("chest-high");
    expect(heightGloss(5)).toContain("as tall as a grown-up");
    expect(heightGloss(10)).toContain("basketball hoop");
    expect(heightGloss(15)).toContain("two-story house");
    expect(heightGloss(40)).toContain("trees");
  });

  it("stays quiet for tiny or huge numbers", () => {
    expect(heightGloss(0.2)).toBeNull();
    expect(heightGloss(98)).toBeNull();
  });

  it("uses the size, not the sign", () => {
    expect(heightGloss(-3)).toBe(heightGloss(3));
  });
});
