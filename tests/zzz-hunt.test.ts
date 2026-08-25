import { describe, it } from "vitest";
import { dayWord, statusLine, verdictSentence } from "@/lib/sentences";
import { survey, type Verdict, type CategoryLevel } from "@/lib/surveyor";

const G = { name: "Yazoo River at Yazoo City", forecastIssued: "2026-03-02T12:00:00Z" };
const NOW = "2026-03-02T15:00:00Z"; // Mon 9am CT
const fresh = { observedH: 0.5, forecastH: 2, staleObserved: false, staleForecast: false };

function flags(s: string) {
  const f: string[] = [];
  if (!s.trim()) f.push("EMPTY");
  if (/\bthe The\b|\bThe The\b/.test(s)) f.push("DOUBLE-ARTICLE");
  if (/ {2,}/.test(s)) f.push("DOUBLE-SPACE");
  if (/undefined|null|NaN|Invalid/.test(s)) f.push("PLACEHOLDER");
  if (/!/.test(s)) f.push("EXCLAMATION");
  if (/\b(catastrophic|danger|dangerous|panic|guaranteed|exact)\b/i.test(s)) f.push("BANNED-WORD");
  if (/\b\d+\.\d\s*ft\b/.test(s)) f.push("SUBFOOT?");
  return f.length ? "   <<< " + f.join(",") : "";
}

/* ---------------- (a) CATEGORY combination space ---------------- */
describe("CATEGORY enumeration", () => {
  it("prints", () => {
    const cats: Array<CategoryLevel | null> = [null, "none", "action", "minor", "moderate", "major"];
    const margins = [null, -3, -0.4, 0, 0.05, 0.4, 3.2];
    for (const c of cats) {
      for (const m of margins) {
        for (const g of [G, null]) {
          const v: Verdict = {
            tier: "CATEGORY",
            peakStageFt: 28.4,
            peakT: "2026-03-04T18:00:00Z",
            aboveFloodFt: m,
            category: c,
            stale: fresh,
          };
          const s = verdictSentence({ pinName: "Home", verdict: v, gauge: g, now: NOW });
          const sl = statusLine(v);
          console.log(`CAT cat=${c} above=${m} gauge=${g ? "yes" : "NULL"}\n  S: ${s}${flags(s)}\n  L: ${sl}${flags(sl)}`);
        }
      }
    }
  });
});

/* ---------------- (a) FULL combination space ---------------- */
describe("FULL enumeration", () => {
  it("prints", () => {
    const bandMargins: Array<[Verdict extends never ? never : "LIKELY" | "BORDERLINE" | "UNLIKELY", number]> = [
      ["LIKELY", -6], ["LIKELY", -0.2], ["LIKELY", 0], ["LIKELY", 0.4],
      ["BORDERLINE", 0.6], ["BORDERLINE", 3.4],
      ["UNLIKELY", 3.6], ["UNLIKELY", 12.3],
    ];
    const crossings = [null, { t: "2026-03-04T12:00:00Z", hoursFromNow: 45 }];
    const peakTs = ["2026-03-04T18:00:00Z", "2026-02-27T18:00:00Z"]; // future / bygone
    for (const [band, marginFt] of bandMargins)
      for (const cr of crossings)
        for (const pastPeak of [false, true])
          for (const currentlyAbove of [false, true])
            for (const peakT of peakTs)
              for (const g of [G, null]) {
                const v: Verdict = {
                  tier: "FULL",
                  band,
                  marginFt,
                  peak: { waterElevFt: 100 - marginFt, stageFt: 10.8, t: peakT },
                  crossing: cr,
                  pastPeak,
                  currentlyAbove,
                  currentWaterElevFt: currentlyAbove ? 101 : 98,
                  stale: fresh,
                };
                const s = verdictSentence({ pinName: "Home", verdict: v, gauge: g, now: NOW });
                const sl = statusLine(v);
                const key = `FULL ${band} m=${marginFt} cross=${cr ? "y" : "n"} past=${pastPeak} above=${currentlyAbove} peakT=${peakT.slice(0, 10)} g=${g ? "y" : "N"}`;
                console.log(`${key}\n  S: ${s}${flags(s)}\n  L: ${sl}${flags(sl)}`);
              }
  });
});

/* ---------------- (b) dayWord ---------------- */
describe("dayWord", () => {
  it("prints", () => {
    const cases: Array<[string, string, string]> = [
      ["spring-forward eve late CT", "2026-03-08T08:00:00Z", "2026-03-08T05:30:00Z"],
      ["spring-forward day+1", "2026-03-09T18:00:00Z", "2026-03-08T05:30:00Z"],
      ["fall-back eve late CT", "2026-11-01T18:00:00Z", "2026-11-01T04:30:00Z"],
      ["fall-back day+1", "2026-11-02T18:00:00Z", "2026-11-01T04:30:00Z"],
      ["year boundary", "2027-01-01T18:00:00Z", "2026-12-31T18:00:00Z"],
      ["year boundary late CT now", "2027-01-01T18:00:00Z", "2027-01-01T05:30:00Z"],
      ["month boundary Feb->Mar", "2026-03-01T18:00:00Z", "2026-02-28T18:00:00Z"],
      ["leap Feb28->Feb29", "2028-02-29T18:00:00Z", "2028-02-28T18:00:00Z"],
      ["leap Feb29->Mar1", "2028-03-01T18:00:00Z", "2028-02-29T18:00:00Z"],
      ["PAST: yesterday", "2026-03-01T18:00:00Z", NOW],
      ["PAST: 3 days ago (Fri)", "2026-02-27T18:00:00Z", NOW],
      ["PAST: 6 days ago", "2026-02-24T18:00:00Z", NOW],
      ["FUTURE: 8 days out", "2026-03-10T18:00:00Z", NOW],
    ];
    for (const [label, t, now] of cases) {
      console.log(`DAYWORD ${label}: target=${t} now=${now} -> "${dayWord(t, now)}"`);
    }
  });
});

/* ---------------- end-to-end: does survey() actually reach the bad combos? ---------------- */
describe("survey() reachability", () => {
  const cats = { action: 8, minor: 10, moderate: 14, major: 18 };
  it("falling river, family currently underwater", () => {
    const now = "2026-03-02T15:00:00Z";
    // gauge zero 90 ft; pin at 100 ft. Water now 101 ft (stage 11) => underwater.
    // Forecast still holds the bygone crest, then falls hard to stage 6 (96 ft).
    const gauge = {
      observed: [
        { t: "2026-03-02T13:00:00Z", stageFt: 12 },
        { t: "2026-03-02T14:45:00Z", stageFt: 11 },
      ],
      forecast: [
        { t: "2026-03-01T12:00:00Z", stageFt: 13 }, // bygone crest
        { t: "2026-03-02T12:00:00Z", stageFt: 11.5 },
        { t: "2026-03-03T12:00:00Z", stageFt: 8 },
        { t: "2026-03-04T12:00:00Z", stageFt: 6 },
      ],
      forecastIssued: "2026-03-02T12:00:00Z",
      categories: cats,
      gaugeZeroFt: 90,
      gaugeDatum: "NAVD88",
    };
    const v = survey({ pinElevationFt: 100, gauge, now });
    console.log("E2E-falling verdict:", JSON.stringify(v));
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge: G, now });
    console.log("E2E-falling S:", s, flags(s));
    console.log("E2E-falling L:", statusLine(v));
  });

  it("falling river, borderline while underwater", () => {
    const now = "2026-03-02T15:00:00Z";
    const gauge = {
      observed: [{ t: "2026-03-02T14:45:00Z", stageFt: 10.5 }],
      forecast: [
        { t: "2026-03-01T12:00:00Z", stageFt: 13 },
        { t: "2026-03-02T12:00:00Z", stageFt: 10.8 },
        { t: "2026-03-03T12:00:00Z", stageFt: 8.5 },
        { t: "2026-03-04T12:00:00Z", stageFt: 8 },
      ],
      forecastIssued: "2026-03-02T12:00:00Z",
      categories: cats,
      gaugeZeroFt: 90,
      gaugeDatum: "NAVD88",
    };
    const v = survey({ pinElevationFt: 100.4, gauge, now });
    console.log("E2E-borderline verdict:", JSON.stringify(v));
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge: G, now });
    console.log("E2E-borderline S:", s, flags(s));
    console.log("E2E-borderline L:", statusLine(v));
  });

  it("pastPeak LIKELY but water never reached the pin", () => {
    const now = "2026-03-02T15:00:00Z";
    const gauge = {
      observed: [{ t: "2026-03-02T14:45:00Z", stageFt: 9.8 }], // 99.8 ft, pin 100
      forecast: [
        { t: "2026-03-02T12:00:00Z", stageFt: 9.8 },
        { t: "2026-03-03T12:00:00Z", stageFt: 9.6 }, // future peak 99.6
        { t: "2026-03-04T12:00:00Z", stageFt: 9.0 },
      ],
      forecastIssued: "2026-03-02T12:00:00Z",
      categories: cats,
      gaugeZeroFt: 90,
      gaugeDatum: "NAVD88",
    };
    const v = survey({ pinElevationFt: 100, gauge, now });
    console.log("E2E-pastpeak-dry verdict:", JSON.stringify(v));
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge: G, now });
    console.log("E2E-pastpeak-dry S:", s, flags(s));
    console.log("E2E-pastpeak-dry L:", statusLine(v));
  });

  it("stale, entirely-past forecast (bygone crest) -> dayWord", () => {
    const now = "2026-03-02T15:00:00Z";
    const gauge = {
      observed: [{ t: "2026-02-27T14:45:00Z", stageFt: 5 }],
      forecast: [
        { t: "2026-02-26T12:00:00Z", stageFt: 6 },
        { t: "2026-02-27T12:00:00Z", stageFt: 10.8 }, // crest last Friday
        { t: "2026-02-28T12:00:00Z", stageFt: 7 },
      ],
      forecastIssued: "2026-02-26T12:00:00Z",
      categories: cats,
      gaugeZeroFt: 90,
      gaugeDatum: "NAVD88",
    };
    const v = survey({ pinElevationFt: 105, gauge, now });
    console.log("E2E-bygone verdict:", JSON.stringify(v));
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge: G, now });
    console.log("E2E-bygone S:", s, flags(s));
    console.log("E2E-bygone L:", statusLine(v));
  });

  it("CATEGORY: crest 0.1 ft over minor -> sub-foot?", () => {
    const now = "2026-03-02T15:00:00Z";
    const gauge = {
      observed: [{ t: "2026-03-02T14:45:00Z", stageFt: 9 }],
      forecast: [
        { t: "2026-03-03T12:00:00Z", stageFt: 10.1 },
        { t: "2026-03-04T12:00:00Z", stageFt: 9 },
      ],
      forecastIssued: "2026-03-02T12:00:00Z",
      categories: cats,
      gaugeZeroFt: null,
      gaugeDatum: null,
    };
    const v = survey({ pinElevationFt: 100, gauge, now });
    console.log("E2E-cat0.1 verdict:", JSON.stringify(v));
    const s = verdictSentence({ pinName: "Home", verdict: v, gauge: G, now });
    console.log("E2E-cat0.1 S:", s, flags(s));
  });

  it("en-CA date shape sanity", () => {
    console.log(
      "en-CA:",
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date("2026-08-25T18:00:00Z")),
    );
  });
});
