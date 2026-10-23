import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { severityRank } from "@/lib/severity";
import type { PinWatch } from "@/lib/watch-service";

describe("release gate", () => {
  it("the site footer never claims places were saved (the example saves nothing)", () => {
    expect(copy.privacyFooter).not.toMatch(/places are (still )?saved/i);
  });

  it("an unknown flood stage sorts above a calm green card", () => {
    const cat = (category: "none" | "action" | null) =>
      ({
        pinId: "p",
        verdict: {
          tier: "CATEGORY",
          peakStageFt: 10,
          peakT: "2026-03-04T18:00:00Z",
          aboveFloodFt: null,
          category,
          stale: { observedH: 0, forecastH: 0, staleObserved: false, staleForecast: false },
        },
        gauge: null,
        alerts: [],
        alertsOk: true,
      }) as unknown as PinWatch;
    expect(severityRank(cat(null))).toBeLessThan(severityRank(cat("none")));
    expect(severityRank(cat(null))).toBeGreaterThan(severityRank(cat("action")));
  });
});
