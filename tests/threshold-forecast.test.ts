import { describe, it, expect } from "vitest";
import { thresholdForecast, nearestImpact } from "@/lib/threshold-forecast";
const now = Date.parse("2026-10-25T12:00:00Z");
const issued = "2026-10-25T10:00:00Z";
const series = [
  { t: "2026-10-25T11:00:00Z", stageFt: 60 },
  { t: "2026-10-25T18:00:00Z", stageFt: 42 },
  { t: "2026-10-25T15:00:00Z", stageFt: 40 },
  { t: "2026-10-25T21:00:00Z", stageFt: 43 },
];
describe("Forecast threshold comparison", () => {
  it("uses only future finite samples and sorts them before finding the first at or above", () => {
    const r = thresholdForecast(
      [
        ...series,
        { t: "bad", stageFt: 100 },
        { t: "2026-10-26T00:00:00Z", stageFt: NaN },
      ],
      issued,
      42,
      now,
    );
    expect(r.status).toBe("reached");
    expect(r.first?.t).toBe("2026-10-25T18:00:00Z");
    expect(r.high?.stageFt).toBe(43);
    expect(r.count).toBe(3);
  });
  it("does not invent a crossing above the complete forecast window", () => {
    const r = thresholdForecast(series, issued, 44, now);
    expect(r.status).toBe("below");
    expect(r.first).toBeNull();
    expect(r.end).toBe("2026-10-25T21:00:00Z");
  });
  it("rejects older, missing, and future-dated issue times for current comparisons", () => {
    for (const time of ["2026-10-23T10:00:00Z", null, "2026-10-26T10:00:00Z"]) {
      const r = thresholdForecast(series, time, 42, now);
      expect(r.status).toBe("older");
      expect(r.first).toBeNull();
      expect(r.high).toBeNull();
    }
  });
  it("treats absent future samples and invalid thresholds as unavailable", () => {
    expect(thresholdForecast([], issued, 42, now).status).toBe("unavailable");
    expect(thresholdForecast(series.slice(0, 1), issued, 42, now).status).toBe(
      "unavailable",
    );
    expect(thresholdForecast(series, issued, NaN, now).status).toBe(
      "unavailable",
    );
  });
  it("does not extend a forecast beyond its published end", () => {
    expect(
      thresholdForecast(series, issued, 42, Date.parse("2026-10-26T00:00:00Z"))
        .status,
    ).toBe("unavailable");
  });
  it("selects the nearest published threshold at or below a level, or the first when below all", () => {
    const notes = [
      { stage: 54, statement: "High" },
      { stage: 36.5, statement: "First" },
      { stage: 43, statement: "Flood" },
    ];
    expect(nearestImpact(40, notes)?.stage).toBe(36.5);
    expect(nearestImpact(10, notes)?.stage).toBe(36.5);
    expect(nearestImpact(54, notes)?.stage).toBe(54);
    expect(nearestImpact(40, [])).toBeNull();
  });
});
