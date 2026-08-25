import { describe, expect, it } from "vitest";
import { chartLayout, CHART_H } from "@/lib/chart";

const obs = [
  { t: "2026-03-01T00:00:00Z", stageFt: 8 },
  { t: "2026-03-01T12:00:00Z", stageFt: 9 },
];
const fcst = [
  { t: "2026-03-02T00:00:00Z", stageFt: 10 },
  { t: "2026-03-03T00:00:00Z", stageFt: 11 },
];

describe("chart layout", () => {
  it("maps both series with higher stage drawn higher", () => {
    const c = chartLayout({ observed: obs, forecast: fcst, floodStageFt: 12 });
    expect(c).not.toBeNull();
    const firstY = parseFloat(c!.obsPoints.split(" ")[0].split(",")[1]);
    const lastY = parseFloat(c!.fcstPoints.split(" ").at(-1)!.split(",")[1]);
    expect(lastY).toBeLessThan(firstY); // stage 11 above stage 8
    expect(c!.floodY).not.toBeNull();
    expect(c!.floodY!).toBeLessThan(lastY); // flood stage 12 above everything
  });

  it("ignores a flood stage far outside the data range", () => {
    const c = chartLayout({ observed: obs, forecast: fcst, floodStageFt: 50 });
    expect(c!.floodY).toBeNull();
  });

  it("returns null for insufficient data", () => {
    expect(chartLayout({ observed: [], forecast: [] })).toBeNull();
    expect(chartLayout({ observed: [obs[0]], forecast: [] })).toBeNull();
  });

  it("stays inside the viewbox", () => {
    const c = chartLayout({ observed: obs, forecast: fcst, floodStageFt: 10.5 });
    for (const pair of [...c!.obsPoints.split(" "), ...c!.fcstPoints.split(" ")]) {
      const [, y] = pair.split(",").map(Number);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(CHART_H);
    }
  });

  it("marks the observed→forecast seam", () => {
    const c = chartLayout({ observed: obs, forecast: fcst });
    const seamX = c!.seamX!;
    const firstFcstX = parseFloat(c!.fcstPoints.split(" ")[0].split(",")[0]);
    expect(seamX).toBeLessThanOrEqual(firstFcstX);
  });
});
