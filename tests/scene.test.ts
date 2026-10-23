import { describe, expect, it } from "vitest";
import { gapLabelY, sceneLayout, SCENE_H } from "@/lib/scene";

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

  it("a small gap puts its label above the higher line, never on the crest line", () => {
    for (const crest of [99.5, 100.4, 100]) {
      const s = sceneLayout({
        markers: [{ label: "Home", elevationFt: 100 }],
        currentWaterElevFt: 95,
        crestElevFt: crest,
      });
      const top = Math.min(s.markers[0].y, s.crestY!);
      expect(s.gapLabelY!).toBeLessThan(top - 4);
      expect(s.gapLabelY!).toBeGreaterThan(0);
    }
  });

  it("a roomy gap keeps its label between the pin and the crest", () => {
    const s = sceneLayout({
      markers: [{ label: "Home", elevationFt: 100 }],
      currentWaterElevFt: 90,
      crestElevFt: 94,
    });
    const top = Math.min(s.markers[0].y, s.crestY!);
    const bottom = Math.max(s.markers[0].y, s.crestY!);
    expect(s.gapLabelY!).toBeGreaterThan(top);
    expect(s.gapLabelY!).toBeLessThan(bottom);
  });

  it("lifts the label when the lines are close on screen, even past 1.5 ft", () => {
    // 3 ft of gap squeezed by a 40 ft tall scene: only a few px apart.
    expect(gapLabelY(100, 108, 3)).toBeLessThan(100);
    expect(gapLabelY(100, 160, 3)).toBe(134);
  });

  it("no crest, no gap label", () => {
    const s = sceneLayout({
      markers: [{ label: "Home", elevationFt: 100 }],
      currentWaterElevFt: 95,
      crestElevFt: null,
    });
    expect(s.gapLabelY).toBeNull();
  });
});
