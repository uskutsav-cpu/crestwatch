import { describe, expect, it } from "vitest";
import { sceneLayout, SCENE_H } from "@/lib/scene";

describe("WaterScene geometry", () => {
  const base = {
    markers: [
      { label: "Home", elevationFt: 100 },
      { label: "Road", elevationFt: 96 },
    ],
    currentWaterElevFt: 94,
    crestElevFt: 98,
  };

  it("higher elevation → smaller y (drawn higher)", () => {
    const s = sceneLayout(base);
    expect(s.markers[0].y).toBeLessThan(s.markers[1].y);
    expect(s.y(100)).toBeLessThan(s.y(94));
  });

  it("water and crest sit between the markers correctly", () => {
    const s = sceneLayout(base);
    // crest (98) above road (96), below home (100)
    expect(s.crestY!).toBeLessThan(s.markers[1].y);
    expect(s.crestY!).toBeGreaterThan(s.markers[0].y);
    // water (94) below everything
    expect(s.waterY!).toBeGreaterThan(s.markers[1].y);
  });

  it("gap is focused-pin elevation minus crest", () => {
    expect(sceneLayout(base).gapFt).toBeCloseTo(2, 5);
    expect(
      sceneLayout({ ...base, crestElevFt: 101.5 }).gapFt,
    ).toBeCloseTo(-1.5, 5);
  });

  it("handles a single marker and missing series", () => {
    const s = sceneLayout({
      markers: [{ label: "Home", elevationFt: 100 }],
      currentWaterElevFt: null,
      crestElevFt: null,
    });
    expect(s.waterY).toBeNull();
    expect(s.crestY).toBeNull();
    expect(s.gapFt).toBeNull();
    expect(s.groundPath).toContain("M 0");
  });

  it("flat scenes get a minimum relief so lines never overlap the frame", () => {
    const s = sceneLayout({
      markers: [{ label: "Home", elevationFt: 100 }],
      currentWaterElevFt: 100.2,
      crestElevFt: 100.4,
    });
    expect(s.waterY!).toBeGreaterThan(0);
    expect(s.waterY!).toBeLessThan(SCENE_H);
    expect(Math.abs(s.waterY! - s.crestY!)).toBeGreaterThan(0.5);
  });
});
