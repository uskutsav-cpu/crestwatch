import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { dayWord, riverName, statusLine, timeWord, verdictSentence } from "@/lib/sentences";
import { survey, type Verdict } from "@/lib/surveyor";

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

  it("timeWord formats an hour word, labeled CT like the live chip (#18)", () => {
    expect(timeWord("2026-03-04T18:00:00Z")).toBe("12pm CT"); // noon CT
  });

  it("dayWord survives the CT spring-forward (23-hour day)", () => {
    // DST starts 2026-03-08 in Central time. From Sat Mar 7, Sunday Mar 8
    // is "tomorrow" and Monday Mar 9 must NOT also read as "tomorrow".
    const sat = "2026-03-07T18:00:00Z"; // Sat noon CT
    expect(dayWord("2026-03-08T18:00:00Z", sat)).toBe("tomorrow");
    expect(dayWord("2026-03-09T18:00:00Z", sat)).toBe("Monday");
  });

  it("dayWord survives the CT fall-back (25-hour day)", () => {
    // DST ends 2026-11-01. From Sat Oct 31, Nov 1 is tomorrow, Nov 2 isn't.
    const sat = "2026-10-31T17:00:00Z";
    expect(dayWord("2026-11-01T18:00:00Z", sat)).toBe("tomorrow");
    expect(dayWord("2026-11-02T18:00:00Z", sat)).toBe("Monday");
  });

  it("dayWord names a calendar date for a past day, never a weekday (#69)", () => {
    // The fixture crest: Aug 25 00:00Z is Mon Aug 24, 7pm Central. Read on
    // Fri Oct 23 it used to come out as "Monday", i.e. next Monday.
    expect(dayWord("2026-08-25T00:00:00Z", "2026-10-23T19:14:00Z")).toBe("on Aug 24");
    expect(dayWord("2026-02-24T20:00:00Z", NOW)).toBe("on Feb 24");
    // Yesterday in Central time even though it's the same UTC date.
    expect(dayWord("2026-03-02T03:00:00Z", NOW)).toBe("on Mar 1");
  });

  it("dayWord keeps weekdays to the coming week", () => {
    expect(dayWord("2026-03-08T18:00:00Z", NOW)).toBe("Sunday"); // 6 days out
    expect(dayWord("2026-03-09T18:00:00Z", NOW)).toBe("on Mar 9"); // 7 days out
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
    // #71: a stage number now always says "on the river gauge", so the
    // reader can't mistake 10.8 ft for height above sea level.
    expect(s).toContain("Yazoo River peaks Wednesday at 10.8 ft on the river gauge.");
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
    expect(s).toContain("The Yazoo River peaks Wednesday around 12pm CT.");
    expect(s).toContain("Water likely reaches The road about 10 hours before that.");
  });

  it("LIKELY past peak: coming down but still wet (gauge falling)", () => {
    const s = verdictSentence({
      pinName: "The road",
      verdict: fullVerdict({ band: "LIKELY", pastPeak: true, currentlyAbove: true }),
      gauge,
      now: NOW,
      observedTrend: "falling",
    });
    expect(s).toContain("has peaked and is coming down");
    expect(s).toContain("The road is likely still in the water today");
  });

  it("LIKELY past peak never says 'coming down' beside a steady or unknown gauge", () => {
    for (const observedTrend of [null, "steady"] as const) {
      const s = verdictSentence({
        pinName: "The road",
        verdict: fullVerdict({ band: "LIKELY", pastPeak: true, currentlyAbove: true }),
        gauge,
        now: NOW,
        observedTrend,
      });
      expect(s).toBe(
        "The forecast says the Yazoo River won't go any higher, but The road is likely still in the water today.",
      );
    }
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
    // Issued 12:00Z + 8h = 20:00Z = 2pm Central, still ahead of 9am.
    expect(s).toContain("Check back after the next forecast, around 2pm CT.");
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
    expect(s).toContain("moderate flooding");
    expect(s).toContain("closely enough to do house-level math here");
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
    expect(s).toBe(
      "The forecast crest at Yazoo River at Yazoo City stays below flood stage. Low areas near the river should stay passable.",
    );
    expect(statusLine(v)).toBe("below flood stage at the nearest gauge");
  });

  it("LIKELY currently-above outranks every other phrasing", () => {
    const s = verdictSentence({
      pinName: "The road",
      verdict: fullVerdict({
        band: "LIKELY",
        marginFt: -2.6,
        currentlyAbove: true,
        crossing: null,
      }),
      gauge,
      now: NOW,
    });
    expect(s).toContain("The road is in the water now");
    expect(s).not.toContain("within a foot");
  });

  it("LIKELY fallback claims 'within a foot' only when the peak stays below", () => {
    const below = verdictSentence({
      pinName: "Home",
      verdict: fullVerdict({ band: "LIKELY", marginFt: 0.4, crossing: null }),
      gauge,
      now: NOW,
    });
    expect(below).toBe(
      "Water likely reaches this spot. The forecast peak comes within a foot of Home.",
    );
    const above = verdictSentence({
      pinName: "Home",
      verdict: fullVerdict({ band: "LIKELY", marginFt: -2.0, crossing: null }),
      gauge,
      now: NOW,
    });
    expect(above).toBe("Water likely reaches this spot. Check back after the next forecast.");
    // The copy deck spells these out; they still open with the band label.
    expect(below.startsWith(copy.bandLikely)).toBe(true);
    expect(above.startsWith(copy.bandLikely)).toBe(true);
  });

  it("CATEGORY major with no published minor stage still says flooding", () => {
    const v: Verdict = {
      tier: "CATEGORY",
      peakStageFt: 44,
      peakT: "2026-03-04T18:00:00Z",
      aboveFloodFt: null, // minor stage unpublished
      category: "major",
      stale: freshStale,
    };
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW });
    expect(s).toContain("major flooding");
    expect(s).not.toContain("stays below flood stage");
  });

  it("CATEGORY at exactly flood stage is flooding, not below it", () => {
    const v: Verdict = {
      tier: "CATEGORY",
      peakStageFt: 29,
      peakT: "2026-03-04T18:00:00Z",
      aboveFloodFt: 0,
      category: "minor",
      stale: freshStale,
    };
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW });
    expect(s).toContain("minor flooding");
    expect(s).not.toContain("stays below flood stage");
  });

  it("CATEGORY action stays calm but never claims passable roads as fact", () => {
    const v: Verdict = {
      tier: "CATEGORY",
      peakStageFt: 28.5,
      peakT: "2026-03-04T18:00:00Z",
      aboveFloodFt: -0.5,
      category: "action",
      stale: freshStale,
    };
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW });
    expect(s).toContain("close to flood stage");
    expect(statusLine(v)).toContain("close to flood stage");
  });

  it("ALERT_ONLY explains the limit honestly", () => {
    const s = verdictSentence({
      pinName: "Camp",
      verdict: { tier: "ALERT_ONLY" },
      gauge: null,
      now: NOW,
    });
    expect(s).toContain("No forecast gauge watches this spot");
    expect(s).toContain("flash floods");
  });
});

describe("CATEGORY with no published flood stage", () => {
  it("never says 'below flood stage' or 'passable' when no stage is published", () => {
    const v: Verdict = {
      tier: "CATEGORY",
      peakStageFt: 12,
      peakT: "2026-03-04T18:00:00Z",
      aboveFloodFt: null,
      category: null,
      stale: freshStale,
    };
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW });
    expect(s).toContain("No flood stage is published for Yazoo River at Yazoo City");
    expect(s).not.toMatch(/below flood stage|passable/);
  });
});

describe("statusLine (place cards)", () => {
  it("covers all bands and tiers", () => {
    expect(statusLine(fullVerdict({}))).toContain("stays dry by about 4 ft");
    expect(statusLine(fullVerdict({ band: "LIKELY" }))).toContain("likely reaches");
    expect(statusLine(fullVerdict({ band: "BORDERLINE" }))).toContain("Too close");
    expect(statusLine({ tier: "ALERT_ONLY" })).toContain("can't watch");
  });

  it("CATEGORY lines come from the copy deck, wording unchanged", () => {
    const cat = (category: "action" | "moderate" | "none" | null): Verdict => ({
      tier: "CATEGORY",
      peakStageFt: 30,
      peakT: "2026-03-04T18:00:00Z",
      aboveFloodFt: 1,
      category,
      stale: freshStale,
    });
    expect(statusLine(cat("action"))).toBe("close to flood stage at the nearest gauge");
    expect(statusLine(cat("moderate"))).toBe("moderate flooding forecast near the gauge");
    expect(statusLine(cat("none"))).toBe("below flood stage at the nearest gauge");
    expect(statusLine(cat(null))).toBe("no flood stage published at the nearest gauge");
  });

  it("lib/sentences.ts builds no visitor sentence inline", () => {
    const src = readFileSync(join(__dirname, "..", "lib", "sentences.ts"), "utf8");
    // Strip comments, then look for string literals that read like prose.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const literals = code.match(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g) ?? [];
    const prose = literals.filter((l) => /[a-z]{2,} [a-z]{2,} [a-z]{2,}/i.test(l));
    expect(prose).toEqual([]);
  });
});

describe("forecast vs live gauge disagreement", () => {
  it("says both when the forecast claims a peak but the gauge is rising", () => {
    const s = verdictSentence({
      pinName: "The road",
      verdict: fullVerdict({ band: "LIKELY", pastPeak: true, currentlyAbove: true }),
      gauge,
      now: NOW,
      observedTrend: "rising",
    });
    expect(s).toContain("forecast says");
    expect(s).toContain("still shows it rising");
    expect(s).not.toContain("coming down");
  });

  it("keeps the plain past-peak sentence when the gauge agrees", () => {
    const s = verdictSentence({
      pinName: "The road",
      verdict: fullVerdict({ band: "LIKELY", pastPeak: true, currentlyAbove: true }),
      gauge,
      now: NOW,
      observedTrend: "falling",
    });
    expect(s).toContain("has peaked and is coming down");
  });
});

/* ---- review fixes: #6/#70, #7/#69, #13, #71 ------------------------- */

const staleBoth = {
  observedH: 1430.7,
  forecastH: 1446,
  staleObserved: true,
  staleForecast: true,
};
const staleFcstOnly = { ...freshStale, forecastH: 30, staleForecast: true };
const staleObsOnly = { ...freshStale, observedH: 5, staleObserved: true };
const WEEKDAY = /\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/;
const NOW_WORD = /\bnow\b/i;
const TODAY_WORD = /\btoday\b/i;

describe("falling river (UNLIKELY past peak, #6/#70)", () => {
  // Vicksburg-shaped: the crest is the latest reading and the forecast
  // only goes down from here.
  const fallingPeak = { waterElevFt: 100.8, stageFt: 10.8, t: "2026-03-02T14:00:00Z" };
  const falling = fullVerdict({ pastPeak: true, peak: fallingPeak, currentWaterElevFt: 100.8 });

  it("pastPeak with the crest still ahead of the reading says 'peaks', not 'is at'", () => {
    // The next forecast point is the crest, above the last reading.
    const v = fullVerdict({
      pastPeak: true,
      peak: { waterElevFt: 100.8, stageFt: 10.8, t: "2026-03-03T00:00:00Z" },
      currentWaterElevFt: 100.4,
    });
    for (const observedTrend of [null, "steady"] as const) {
      const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW, observedTrend });
      expect(s).toBe(
        "The Yazoo River peaks today at 10.8 ft on the river gauge. Home stays dry by about 4 ft.",
      );
      expect(s).not.toContain("is at");
    }
    // Next to a "river falling" chip, a small last bump is never "peaks".
    const f = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW, observedTrend: "falling" });
    expect(f).toBe("The forecast says the Yazoo River won't go above 10.8 ft on the river gauge. Home stays dry by about 4 ft.");
  });

  it("a falling reading that is the highest water never says 'peaks', even without pastPeak", () => {
    // A later forecast bump stays below the reading, so pastPeak is false.
    const v = fullVerdict({ pastPeak: false, peak: fallingPeak, currentWaterElevFt: 100.8 });
    const s = verdictSentence({
      pinName: "Home",
      verdict: v,
      gauge,
      now: NOW,
      observedTrend: "falling",
    });
    expect(s).toBe(
      "The forecast says the Yazoo River won't go above 10.8 ft on the river gauge. Home stays dry by about 4 ft.",
    );
    expect(s).not.toContain("peaks");
  });

  describe("from real survey() output", () => {
    const at = (h: number) => new Date(Date.parse(NOW) + h * 3.6e6).toISOString();
    const pts = (p: Array<[number, number]>) => p.map(([h, stageFt]) => ({ t: at(h), stageFt }));
    const run = (obs: Array<[number, number]>, fcst: Array<[number, number]>, trend: "steady" | "falling") => {
      const v = survey({
        pinElevationFt: 100,
        gauge: {
          observed: pts(obs),
          forecast: pts(fcst),
          forecastIssued: at(-1),
          categories: { action: 28, minor: 29, moderate: 36, major: 43 },
          gaugeZeroFt: 70,
          gaugeDatum: "NAVD88",
        },
        now: NOW,
      });
      return verdictSentence({
        pinName: "Home",
        verdict: v,
        gauge: { name: "Mississippi River at Vicksburg", forecastIssued: at(-1) },
        now: NOW,
        observedTrend: trend,
      });
    };

    it("reading 14.5, crest 14.9 still to come: peaks, never 'is at 14.9'", () => {
      const s = run([[-0.5, 14.5]], [[9, 14.9], [15, 14.6], [21, 14.2]], "steady");
      expect(s).toContain("Mississippi River peaks today at 14.9 ft on the river gauge.");
      expect(s).not.toContain("is at");
    });

    it("forecast entirely behind us, above the reading: never 'is at' that high point", () => {
      const s = run([[-0.5, 14.2]], [[-10, 15.0], [-6, 15.5], [-2, 15.1]], "steady");
      expect(s).not.toContain("is at");
      expect(s).not.toContain("coming down");
    });

    it("falling reading with a lower bump ahead: never 'peaks today'", () => {
      const s = run([[-0.5, 15.0]], [[3, 14.0], [9, 14.5], [15, 13.0]], "falling");
      expect(s).toBe(
        "The forecast says the Mississippi River won't go above 15.0 ft on the river gauge. Home stays dry by about 15 ft.",
      );
    });

    it("Vicksburg, Oct 23: reading 14.94, next forecast point 15.0, chip 'falling'", () => {
      for (const trend of ["falling", "steady"] as const) {
        const s = run([[-0.5, 14.94]], [[2, 15.0], [8, 14.8], [14, 14.6]], trend);
        expect(s).toBe(
          "The forecast says the Mississippi River won't go above 15.0 ft on the river gauge. Home stays dry by about 15 ft.",
        );
        expect(s).not.toMatch(/peaks|coming down|is at/);
      }
    });
  });

  it.each([null, "falling", "steady"] as const)(
    "says the forecast shows nothing higher, never 'peaks' (trend %s)",
    (observedTrend) => {
      const s = verdictSentence({
        pinName: "Home",
        verdict: falling,
        gauge,
        now: NOW,
        observedTrend,
      });
      expect(s).toBe(
        "The forecast says the Yazoo River won't go above 10.8 ft on the river gauge. Home stays dry by about 4 ft.",
      );
      expect(s).not.toContain("peaks");
    },
  );

  it("a gauge rising past the forecast says so, never 'peaks' on a past day", () => {
    // The high point is the reading itself (14:00Z, before NOW).
    const s = verdictSentence({
      pinName: "Home",
      verdict: falling,
      gauge,
      now: NOW,
      observedTrend: "rising",
    });
    expect(s).toBe(
      "The Yazoo River is at 10.8 ft on the river gauge and still rising. Right now Home stays dry by about 4 ft.",
    );
    // Just after midnight CT the reading's date is "yesterday": still no "peaks".
    const late = verdictSentence({
      pinName: "Home",
      verdict: fullVerdict({
        pastPeak: true,
        peak: { waterElevFt: 100.8, stageFt: 10.8, t: "2026-03-03T05:45:00Z" },
        currentWaterElevFt: 100.8,
      }),
      gauge,
      now: "2026-03-03T06:30:00Z",
      observedTrend: "rising",
    });
    expect(late).not.toMatch(/peaks/);
  });

  it("an exact 0.3 ft forecast rise counts as a crest despite float rounding", () => {
    const v = fullVerdict({
      pastPeak: true,
      peak: { waterElevFt: 46.22 + 15.3, stageFt: 15.3, t: "2026-03-03T00:00:00Z" },
      currentWaterElevFt: 46.22 + 15.0,
      marginFt: 30,
    });
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW, observedTrend: "steady" });
    expect(s).toContain("peaks today at 15.3 ft");
  });

  it("without pastPeak the sentence is unchanged", () => {
    const s = verdictSentence({
      pinName: "Home",
      verdict: fullVerdict({}),
      gauge,
      now: NOW,
      observedTrend: "falling",
    });
    expect(s).toBe(
      "The Yazoo River peaks Wednesday at 10.8 ft on the river gauge. Home stays dry by about 4 ft.",
    );
  });

  it("a 'rising' trend passed with a stale reading is ignored", () => {
    const s = verdictSentence({
      pinName: "Home",
      verdict: fullVerdict({ pastPeak: true, peak: fallingPeak, stale: staleObsOnly }),
      gauge,
      now: NOW,
      observedTrend: "rising",
    });
    expect(s).not.toContain("rising");
    expect(s).toContain("The last forecast had");
  });

  it("place card margin matches the sentence", () => {
    const s = verdictSentence({ pinName: "Home", verdict: falling, gauge, now: NOW });
    expect(s).toContain("stays dry by about 4 ft");
    expect(statusLine(falling)).toBe("This spot stays dry by about 4 ft.");
  });
});

describe("stale data never says today or now (#7/#69)", () => {
  const NOW_OCT = "2026-10-23T19:14:00Z"; // Fri, 2:14pm Central
  const pearl = { name: "Pearl River at Jackson", forecastIssued: "2026-08-24T13:15:00Z" };

  it("UNLIKELY from 60-day-old data: last forecast, calendar date, no weekday", () => {
    const v = fullVerdict({
      marginFt: 38.4,
      pastPeak: true,
      peak: { waterElevFt: 237.1, stageFt: 3.7, t: "2026-08-25T00:00:00Z" },
      stale: staleBoth,
    });
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge: pearl, now: NOW_OCT });
    expect(s).toBe(
      "The last forecast had the Pearl River peaking on Aug 24 at 3.7 ft on the river gauge. By that forecast, Home stays dry by about 38 ft.",
    );
    expect(s).not.toMatch(WEEKDAY);
    expect(s).not.toMatch(TODAY_WORD);
    expect(s).not.toMatch(NOW_WORD);
    expect(s).not.toContain("coming down");
    // e2e (fixture data is stale) matches this phrase on /watch.
    expect(s).toMatch(/stays dry by about \d+ ft/);
    expect(statusLine(v)).toBe("This spot stays dry by about 38 ft.");
  });

  it("UNLIKELY when the stale reading is the highest water: credits the reading", () => {
    // Vicksburg-shaped, gauge quiet for 5h: the crest IS the last reading.
    const v = fullVerdict({
      marginFt: 153.6,
      pastPeak: true,
      peak: { waterElevFt: 87.94, stageFt: 14.94, t: "2026-10-23T14:00:00Z" },
      currentWaterElevFt: 87.94,
      stale: staleObsOnly,
    });
    const s = verdictSentence({
      pinName: "Home",
      verdict: v,
      gauge: { name: "Mississippi River at Vicksburg", forecastIssued: "2026-10-23T14:37:00Z" },
      now: NOW_OCT,
    });
    expect(s).toBe(
      "The last reading had the Mississippi River at 14.9 ft on the river gauge. By that reading, Home stays dry by about 154 ft.",
    );
    expect(s).not.toMatch(TODAY_WORD);
    expect(s).not.toMatch(NOW_WORD);
    expect(statusLine(v)).toBe("This spot stays dry by about 154 ft.");
  });

  it("UNLIKELY with a stale forecast and a crest later today names the date", () => {
    const v = fullVerdict({
      peak: { waterElevFt: 100.8, stageFt: 10.8, t: "2026-03-02T22:00:00Z" },
      stale: staleFcstOnly,
    });
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW });
    expect(s).toContain("peaking on Mar 2 at 10.8 ft on the river gauge");
    expect(s).not.toMatch(TODAY_WORD);
  });

  it("LIKELY past peak from stale data drops 'still in the water today'", () => {
    const v = fullVerdict({
      band: "LIKELY",
      marginFt: -2,
      pastPeak: true,
      currentlyAbove: true,
      peak: { waterElevFt: 237.1, stageFt: 3.7, t: "2026-08-25T00:00:00Z" },
      stale: staleBoth,
    });
    const s = verdictSentence({ pinName: "Boat ramp", verdict: v, gauge: pearl, now: NOW_OCT });
    expect(s).toBe(
      "The last forecast had the Pearl River coming down from its peak, with Boat ramp likely still in the water. Check back after the next forecast.",
    );
    expect(s).not.toMatch(TODAY_WORD);
    expect(s).not.toMatch(NOW_WORD);
  });

  it("LIKELY past peak, fresh rising gauge, stale forecast: says both, no 'today'", () => {
    const v = fullVerdict({
      band: "LIKELY",
      marginFt: -1,
      pastPeak: true,
      currentlyAbove: true,
      stale: staleFcstOnly,
    });
    const s = verdictSentence({
      pinName: "The road",
      verdict: v,
      gauge,
      now: NOW,
      observedTrend: "rising",
    });
    expect(s).toContain("The last forecast had the Yazoo River past its peak");
    expect(s).toContain("the gauge shows it still rising");
    expect(s).not.toContain("coming down");
    expect(s).not.toMatch(TODAY_WORD);
    expect(s).not.toMatch(NOW_WORD);
  });

  it("LIKELY crossing from a stale forecast: last forecast, calendar date", () => {
    const v = fullVerdict({
      band: "LIKELY",
      marginFt: -0.8,
      peak: { waterElevFt: 100.8, stageFt: 10.8, t: "2026-03-02T22:00:00Z" },
      crossing: { t: "2026-03-02T21:00:00Z", hoursFromNow: 6 },
      stale: staleFcstOnly,
    });
    const s = verdictSentence({ pinName: "The road", verdict: v, gauge, now: NOW });
    expect(s).toBe(
      "The last forecast had the Yazoo River peaking on Mar 2 around 4pm CT. By that forecast, water likely reaches The road about 1 hour before that.",
    );
    expect(s).not.toMatch(TODAY_WORD);
  });

  it("a stale reading never claims 'in the water now'", () => {
    const v = fullVerdict({
      band: "LIKELY",
      marginFt: -2.6,
      currentlyAbove: true,
      stale: staleObsOnly,
    });
    const s = verdictSentence({ pinName: "The road", verdict: v, gauge, now: NOW });
    expect(s).not.toMatch(NOW_WORD);
  });

  it("a fresh reading under a stale forecast drops 'now' too", () => {
    const v = fullVerdict({
      band: "LIKELY",
      marginFt: -2.6,
      currentlyAbove: true,
      stale: staleFcstOnly,
    });
    const s = verdictSentence({
      pinName: "Home",
      verdict: v,
      gauge: { name: "Mississippi River at Vicksburg", forecastIssued: null },
      now: NOW,
      observedTrend: "rising",
    });
    expect(s).toBe(
      "The gauge shows Home in the water, and the Mississippi River is still up. Stay off flooded roads and check back after the next forecast.",
    );
    expect(s).not.toMatch(NOW_WORD);
    expect(s).not.toMatch(TODAY_WORD);
  });

  it("no stale FULL sentence says today or now, or a weekday", () => {
    const bands = [
      { band: "LIKELY", marginFt: -1 },
      { band: "BORDERLINE", marginFt: 2 },
      { band: "UNLIKELY", marginFt: 6 },
    ] as const;
    // A crest later today: the fresh wording would say "today".
    const peak = { waterElevFt: 100.8, stageFt: 10.8, t: "2026-03-02T22:00:00Z" };
    for (const stale of [staleBoth, staleFcstOnly, staleObsOnly]) {
      for (const b of bands) {
        for (const pastPeak of [false, true]) {
          for (const crossing of [null, { t: "2026-03-02T20:00:00Z", hoursFromNow: 5 }]) {
            for (const currentlyAbove of [false, true]) {
              for (const observedTrend of [null, "rising", "falling"] as const) {
                const v = fullVerdict({ ...b, peak, pastPeak, crossing, currentlyAbove, stale });
                const s = verdictSentence({ pinName: "Home", verdict: v, gauge, now: NOW, observedTrend });
                const label = JSON.stringify({ stale, b, pastPeak, crossing, currentlyAbove, observedTrend, s });
                expect(s, label).not.toMatch(TODAY_WORD);
                expect(s, label).not.toMatch(NOW_WORD);
                expect(s, label).not.toMatch(WEEKDAY);
              }
            }
          }
        }
      }
    }
  });
});

describe("staleness wording switches to days past 48 hours (#69)", () => {
  it.each([
    [1, "data delayed 1h", "Heads up: this data is 1 hour old. The river may have moved."],
    [47, "data delayed 47h", "Heads up: this data is 47 hours old. The river may have moved."],
    [48, "data delayed 48h", "Heads up: this data is 48 hours old. The river may have moved."],
    [49, "data delayed 2 days", "Heads up: this data is 2 days old. The river may have moved."],
    [1446, "data delayed 60 days", "Heads up: this data is 60 days old. The river may have moved."],
  ])("%ih", (n, chip, line) => {
    expect(copy.delayedChip(n)).toBe(chip);
    expect(copy.staleness(n)).toBe(line);
  });
});

describe("BORDERLINE next-forecast time (#13)", () => {
  const borderline = fullVerdict({ band: "BORDERLINE", marginFt: 2.2 });

  it("names the clock time while it's still ahead", () => {
    const s = verdictSentence({ pinName: "Grandma", verdict: borderline, gauge, now: NOW });
    expect(s).toBe(
      "Grandma sits about 2 ft above the forecast peak. That's too close to call. Check back after the next forecast, around 2pm CT.",
    );
  });

  it("says 'the next update' once that time has passed", () => {
    // Issued 8am Central; at 9pm the 4pm reissue is already behind us.
    const s = verdictSentence({
      pinName: "Grandma",
      verdict: borderline,
      gauge: { ...gauge, forecastIssued: "2026-03-02T14:00:00Z" },
      now: "2026-03-03T03:00:00Z",
    });
    expect(s).toBe(
      "Grandma sits about 2 ft above the forecast peak. That's too close to call. Check back after the next update.",
    );
    expect(s).not.toMatch(/around \d/);
  });

  it("an Aug 24 forecast read on Oct 23 names no clock time", () => {
    const s = verdictSentence({
      pinName: "Grandma",
      verdict: fullVerdict({ band: "BORDERLINE", marginFt: 2.2, stale: staleBoth }),
      gauge: { ...gauge, forecastIssued: "2026-08-24T13:15:00Z" },
      now: "2026-10-23T19:14:00Z",
    });
    expect(s).toContain("Check back after the next update.");
    expect(s).not.toContain("4pm");
  });

  it("an unknown issue time reads naturally too", () => {
    const s = verdictSentence({
      pinName: "Grandma",
      verdict: borderline,
      gauge: { ...gauge, forecastIssued: null },
      now: NOW,
    });
    expect(s).toContain("Check back after the next update.");
    expect(s).not.toContain("around the next update");
  });
});

describe("stage numbers say 'on the river gauge' (#71)", () => {
  it("every FULL sentence that quotes a stage says so", () => {
    const cases: Array<Partial<Extract<Verdict, { tier: "FULL" }>>> = [
      {},
      { pastPeak: true },
      { stale: staleBoth },
      { pastPeak: true, stale: staleFcstOnly },
      { pastPeak: true, stale: staleObsOnly, currentWaterElevFt: 100.8 }, // last reading
    ];
    for (const over of cases) {
      for (const observedTrend of [null, "rising", "falling"] as const) {
        const s = verdictSentence({
          pinName: "Home",
          verdict: fullVerdict(over),
          gauge,
          now: NOW,
          observedTrend,
        });
        expect(s).toContain("10.8 ft on the river gauge");
      }
    }
  });
});

describe("sentence edge cases", () => {
  it("no gauge name: 'The river', never 'The The river'", () => {
    const s = verdictSentence({ pinName: "Home", verdict: fullVerdict({}), gauge: null, now: NOW });
    expect(s).toMatch(/^The river peaks Wednesday/);
    expect(s).not.toContain("The The");
  });

  it("one hour before the peak is 'about 1 hour', not '1 hours'", () => {
    const s = verdictSentence({
      pinName: "The road",
      verdict: fullVerdict({
        band: "LIKELY",
        marginFt: -0.2,
        crossing: { t: "2026-03-04T17:00:00Z", hoursFromNow: 50 },
      }),
      gauge,
      now: NOW,
    });
    expect(s).toContain("about 1 hour before that.");
  });
});
