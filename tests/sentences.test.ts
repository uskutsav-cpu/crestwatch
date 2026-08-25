import { describe, expect, it } from "vitest";
import { dayWord, riverName, statusLine, timeWord, verdictSentence } from "@/lib/sentences";
import type { Verdict } from "@/lib/surveyor";

const NOW = "2026-03-02T15:00:00Z"; // a Monday, 9am Central

const freshStale = {
  observedH: 0.5,
  forecastH: 2,
  staleObserved: false,
  staleForecast: false,
};

function fullVerdict(over: Partial<Extract<Verdict, { tier: "FULL" }>>): Verdict {
  return {
    tier: "FULL",
    band: "UNLIKELY",
    marginFt: 4.2,
    peak: { waterElevFt: 100.8, stageFt: 10.8, t: "2026-03-04T18:00:00Z" },
    crossing: null,
    pastPeak: false,
    currentlyAbove: false,
    currentWaterElevFt: 99.0,
    stale: freshStale,
    ...over,
  };
}

const gauge = {
  name: "Yazoo River at Yazoo City",
  forecastIssued: "2026-03-02T12:00:00Z",
};

describe("helpers", () => {
  it("riverName strips the location", () => {
    expect(riverName("Yazoo River at Yazoo City")).toBe("Yazoo River");
    expect(riverName("Big Black River near Bentonia")).toBe("Big Black River");
    expect(riverName("Steele Bayou")).toBe("Steele Bayou");
  });

  it("dayWord: today / tomorrow / weekday in Central time", () => {
    expect(dayWord("2026-03-02T20:00:00Z", NOW)).toBe("today");
    expect(dayWord("2026-03-03T20:00:00Z", NOW)).toBe("tomorrow");
    expect(dayWord("2026-03-04T20:00:00Z", NOW)).toBe("Wednesday");
  });

  it("timeWord formats an hour word", () => {
    expect(timeWord("2026-03-04T18:00:00Z")).toBe("12pm"); // noon CT
  });
});

describe("verdict sentences (Appendix C)", () => {
  it("UNLIKELY: river, day, stage, margin in whole feet", () => {
    const s = verdictSentence({
      pinName: "Home",
      verdict: fullVerdict({}),
      gauge,
      now: NOW,
    });
    expect(s).toContain("Yazoo River peaks Wednesday at 10.8 ft");
    expect(s).toContain("Home stays dry by about 4 ft");
    expect(s).not.toMatch(/4\.\d/); // no sub-foot precision
  });

  it("LIKELY with crossing: hours before the peak", () => {
    const s = verdictSentence({
      pinName: "The road",
      verdict: fullVerdict({
        band: "LIKELY",
        marginFt: -0.8,
        crossing: { t: "2026-03-04T08:00:00Z", hoursFromNow: 41 },
      }),
      gauge,
      now: NOW,
    });
    expect(s).toContain("The Yazoo River peaks Wednesday around 12pm.");
    expect(s).toContain("Water likely reaches The road about 10 hours before that.");
  });

  it("LIKELY past peak: coming down but still wet", () => {
    const s = verdictSentence({
      pinName: "The road",
      verdict: fullVerdict({ band: "LIKELY", pastPeak: true, currentlyAbove: true }),
      gauge,
      now: NOW,
    });
    expect(s).toContain("has peaked and is coming down");
    expect(s).toContain("The road is likely still in the water today");
  });

  it("BORDERLINE: margin + next forecast time", () => {
    const s = verdictSentence({
      pinName: "Grandma",
      verdict: fullVerdict({ band: "BORDERLINE", marginFt: 2.2 }),
      gauge,
      now: NOW,
    });
    expect(s).toContain("Grandma sits about 2 ft above the forecast peak");
    expect(s).toContain("too close to call");
  });

  it("CATEGORY above flood stage names the NWS category", () => {
    const v: Verdict = {
      tier: "CATEGORY",
      peakStageFt: 33.2,
      peakT: "2026-03-04T18:00:00Z",
      aboveFloodFt: 4.2,
      category: "moderate",
      stale: freshStale,
    };
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW });
    expect(s).toContain("4.2 ft above flood stage at Yazoo River at Yazoo City");
    expect(s).toContain("Moderate flooding");
    expect(s).toContain("can't do house-level math here");
  });

  it("CATEGORY below flood stage stays calm", () => {
    const v: Verdict = {
      tier: "CATEGORY",
      peakStageFt: 9.3,
      peakT: "2026-03-04T18:00:00Z",
      aboveFloodFt: -19.7,
      category: "none",
      stale: freshStale,
    };
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW });
    expect(s).toContain("stays below flood stage");
  });

  it("ALERT_ONLY explains the limit honestly", () => {
    const s = verdictSentence({
      pinName: "Camp",
      verdict: { tier: "ALERT_ONLY" },
      gauge: null,
      now: NOW,
    });
    expect(s).toContain("No forecast gauge watches this spot");
    expect(s).toContain("flash flooding");
  });
});

describe("statusLine (place cards)", () => {
  it("covers all bands and tiers", () => {
    expect(statusLine(fullVerdict({}))).toContain("stays dry by about 4 ft");
    expect(statusLine(fullVerdict({ band: "LIKELY" }))).toContain("likely reaches");
    expect(statusLine(fullVerdict({ band: "BORDERLINE" }))).toContain("Too close");
    expect(statusLine({ tier: "ALERT_ONLY" })).toContain("can't watch");
  });
});
