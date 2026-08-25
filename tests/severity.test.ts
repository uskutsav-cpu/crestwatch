import { describe, expect, it } from "vitest";
import { severityRank, sortWorstFirst } from "@/lib/severity";
import type { PinWatch } from "@/lib/watch-service";
import type { Verdict } from "@/lib/surveyor";

const stale = {
  observedH: 0,
  forecastH: 0,
  staleObserved: false,
  staleForecast: false,
};

function watch(pinId: string, verdict: Verdict, alerts = 0): PinWatch {
  return {
    pinId,
    verdict,
    gauge: null,
    alerts: Array.from({ length: alerts }, () => ({
      event: "Flood Warning",
      headline: null,
      severity: null,
      areaDesc: null,
      expires: null,
    })),
  };
}

const full = (band: "LIKELY" | "BORDERLINE" | "UNLIKELY"): Verdict => ({
  tier: "FULL",
  band,
  marginFt: 0,
  peak: { waterElevFt: 0, stageFt: 0, t: "2026-01-01T00:00:00Z" },
  crossing: null,
  pastPeak: false,
  currentlyAbove: false,
  currentWaterElevFt: null,
  stale,
});

const category = (
  cat: "major" | "moderate" | "minor" | "action" | "none",
): Verdict => ({
  tier: "CATEGORY",
  peakStageFt: 0,
  peakT: "2026-01-01T00:00:00Z",
  aboveFloodFt: null,
  category: cat,
  stale,
});

describe("severity ordering (worst first)", () => {
  it("ranks the full ladder", () => {
    const order = [
      watch("likely", full("LIKELY")),
      watch("cat-major", category("major")),
      watch("cat-moderate", category("moderate")),
      watch("cat-minor", category("minor")),
      watch("borderline", full("BORDERLINE")),
      watch("cat-action", category("action")),
      watch("alert-active", { tier: "ALERT_ONLY" }, 1),
      watch("cat-none", category("none")),
      watch("unlikely", full("UNLIKELY")),
      watch("alert-quiet", { tier: "ALERT_ONLY" }),
    ];
    const ranks = order.map(severityRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("sortWorstFirst puts the wet house on top", () => {
    const sorted = sortWorstFirst([
      watch("dry", full("UNLIKELY")),
      watch("wet", full("LIKELY")),
      watch("close", full("BORDERLINE")),
    ]);
    expect(sorted.map((w) => w.pinId)).toEqual(["wet", "close", "dry"]);
  });
});
