import { describe, it, expect } from "vitest";
import { replaySummary, splitDailySegments } from "@/lib/replay-summary";
describe("Historical daily record summary", () => {
  const points = [
    { t: "2020-02-01", stageFt: 27 },
    { t: "2020-02-02", stageFt: 28 },
    { t: "2020-02-04", stageFt: 30 },
    { t: "2020-02-05", stageFt: 27 },
  ];
  it("counts only supplied dates and reports gaps instead of claiming continuous inundation", () => {
    const r = replaySummary(points, 28);
    expect(r.samplesAbove).toBe(2);
    expect(r.missingDays).toBe(1);
    expect(r.firstAbove?.t).toBe("2020-02-02");
    expect(r.lastAbove?.t).toBe("2020-02-04");
  });
  it("sorts dates and removes duplicate samples before counting", () => {
    const r = replaySummary([points[3], ...points], 28);
    expect(r.samples).toBe(4);
    expect(r.peak?.stageFt).toBe(30);
  });
  it("makes no above-stage count without a compatible flood stage", () => {
    expect(replaySummary(points, null).samplesAbove).toBeNull();
    expect(replaySummary([], 28).peak).toBeNull();
  });
  it("breaks the plotted line at a missing daily date without splitting valid consecutive dates", () => {
    expect(splitDailySegments(points).map((g) => g.map((p) => p.t))).toEqual([
      ["2020-02-01", "2020-02-02"],
      ["2020-02-04", "2020-02-05"],
    ]);
  });
  it("leaves timestamped live series intact and treats a non-finite flood stage as unknown", () => {
    expect(
      splitDailySegments([
        { t: "2026-10-20T00:00:00Z", stageFt: 1 },
        { t: "2026-10-22T00:00:00Z", stageFt: 2 },
      ]),
    ).toHaveLength(1);
    expect(replaySummary(points, NaN).samplesAbove).toBeNull();
  });
});
