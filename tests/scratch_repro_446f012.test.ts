import { describe, it, expect } from "vitest";
import { survey } from "@/lib/surveyor";
import { verdictSentence, statusLine } from "@/lib/sentences";
import { severityRank } from "@/lib/severity";

const NOW = "2026-08-25T18:00:00Z";
const at = (h: number) =>
  new Date(Date.parse(NOW) + h * 3_600_000).toISOString();

describe("scratch: CATEGORY tier + future-only peak", () => {
  it("in-progress moderate flood receding within horizon", () => {
    const gauge = {
      observed: [
        { t: at(-3), stageFt: 15.0 },
        { t: at(-0.5), stageFt: 14.5 },
      ],
      forecast: [
        { t: at(-3), stageFt: 15.0 },
        { t: at(3), stageFt: 7.5 },
        { t: at(9), stageFt: 6.0 },
        { t: at(21), stageFt: 5.5 },
      ],
      forecastIssued: at(-1),
      categories: { action: 8, minor: 10, moderate: 13, major: 16 },
      gaugeZeroFt: null,
      gaugeDatum: null,
    };

    const v = survey({ pinElevationFt: 120, gauge, now: NOW });
    console.log("VERDICT:", JSON.stringify(v, null, 2));

    const s = verdictSentence({
      pinName: "your house",
      verdict: v,
      gauge: { name: "Cypress Creek at Vaughan", forecastIssued: at(-1) },
      now: NOW,
    });
    console.log("SENTENCE:", s);
    console.log("STATUSLINE:", statusLine(v));
    console.log(
      "SEVERITY RANK:",
      severityRank({ verdict: v, alerts: [] } as never),
    );

    expect(v.tier).toBe("CATEGORY");
  });
});
