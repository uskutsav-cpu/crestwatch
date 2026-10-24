/**
 * Package integration: the five new pieces wired into the screens. Watch,
 * Why and Places render to static HTML with the data hook and the router
 * stubbed, so each tier can be checked without a browser.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchState } from "@/lib/use-watch";
import type { PinWatch } from "@/lib/watch-service";
import type { Pin } from "@/lib/pins";
import type { Staleness } from "@/lib/surveyor";

const nav = vi.hoisted(() => ({ search: "" }));
const hook = vi.hoisted(() => ({ state: null as unknown as WatchState }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
}));
vi.mock("@/lib/use-watch", () => ({
  useWatches: () => hook.state,
}));

import { copy } from "@/lib/copy";
import { EXAMPLE_PINS } from "@/lib/example";
import { encodeWatchLink } from "@/lib/watch-link";
import {
  WatchClient,
  alertNotesFor,
  crestAheadIso,
  whatIfCrest,
  whatIfFor,
  whatIfKeyFor,
} from "@/components/watch/WatchClient";
import type { FloodAlert } from "@/lib/alerts";
import { WhyClient } from "@/components/why/WhyClient";
import { PlacesClient } from "@/components/places/PlacesClient";
import { WaterScene } from "@/components/watch/WaterScene";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const NOW = "2026-10-23T19:00:00Z";
const LEVEE = EXAMPLE_PINS[0]; // Levee St, 92.7 ft
const MUSEUM = EXAMPLE_PINS[1]; // Museum, 117 ft
const ZERO = 46.22; // Vicksburg's gauge zero

const FRESH: Staleness = {
  observedH: 0.5,
  forecastH: 3,
  staleObserved: false,
  staleForecast: false,
};
const OLD_FORECAST: Staleness = { ...FRESH, forecastH: 30, staleForecast: true };

/** Shaped like Vicksburg: the top three crests are the real ones. */
const CRESTS = [
  { stageFt: 57.1, time: "2011-05-19T00:00:00Z", oldDatum: false },
  { stageFt: 56.2, time: "1927-05-04T00:00:00Z", oldDatum: false },
  { stageFt: 53.2, time: "1937-02-21T00:00:00Z", oldDatum: false },
  { stageFt: 51.6, time: "1973-05-14T00:00:00Z", oldDatum: false },
  { stageFt: 50.8, time: "1983-05-30T00:00:00Z", oldDatum: false },
  { stageFt: 50.3, time: "2019-03-20T00:00:00Z", oldDatum: false },
];

function vicksburg(over: Partial<NonNullable<PinWatch["gauge"]>> = {}): NonNullable<PinWatch["gauge"]> {
  return {
    lid: "VCKM6",
    name: "Mississippi River at Vicksburg",
    usgsId: "07289000",
    distanceMi: 0.4,
    gaugeZeroFt: ZERO,
    gaugeDatum: "NGVD29",
    categories: { action: 35, minor: 43, moderate: 46, major: 50 },
    historicCrests: CRESTS,
    observed: [
      { t: "2026-10-23T18:00:00Z", stageFt: 15.0 },
      { t: "2026-10-23T18:30:00Z", stageFt: 15.0 },
    ],
    forecast: [
      { t: "2026-10-24T12:00:00Z", stageFt: 15.6 },
      { t: "2026-10-26T12:00:00Z", stageFt: 17.2 },
      { t: "2026-10-28T12:00:00Z", stageFt: 16.4 },
    ],
    forecastIssued: "2026-10-23T16:00:00Z",
    ...over,
  };
}

function fullWatch(
  pin: Pin = LEVEE,
  over: Partial<{ pastPeak: boolean; stale: Staleness; peakT: string }> = {},
): PinWatch {
  const peakStage = 17.2;
  const waterElevFt = ZERO + peakStage;
  const marginFt = pin.elevationFt - waterElevFt;
  return {
    pinId: pin.id,
    verdict: {
      tier: "FULL",
      band: marginFt <= 0.5 ? "LIKELY" : marginFt <= 3.5 ? "BORDERLINE" : "UNLIKELY",
      marginFt,
      peak: { waterElevFt, stageFt: peakStage, t: over.peakT ?? "2026-10-26T12:00:00Z" },
      crossing: null,
      pastPeak: over.pastPeak ?? false,
      currentlyAbove: false,
      currentWaterElevFt: ZERO + 15.0,
      stale: over.stale ?? FRESH,
    },
    gauge: vicksburg(),
    alerts: [],
    alertsOk: true,
  };
}

function categoryWatch(
  pin: Pin = LEVEE,
  forecast = [
    { t: "2026-10-24T12:00:00Z", stageFt: 30.1 },
    { t: "2026-10-26T12:00:00Z", stageFt: 31.0 },
  ],
): PinWatch {
  const peak = forecast.reduce((a, b) => (b.stageFt > a.stageFt ? b : a));
  return {
    pinId: pin.id,
    verdict: {
      tier: "CATEGORY",
      peakStageFt: peak.stageFt,
      peakT: peak.t,
      aboveFloodFt: peak.stageFt - 43,
      category: "none",
      stale: FRESH,
    },
    // A CATEGORY gauge can still carry a zero the Surveyor rejected.
    gauge: vicksburg({ forecast }),
    alerts: [],
    alertsOk: true,
  };
}

function alertOnlyWatch(pin: Pin = LEVEE): PinWatch {
  return { pinId: pin.id, verdict: { tier: "ALERT_ONLY" }, gauge: null, alerts: [], alertsOk: true };
}

const FLASH: FloodAlert = {
  event: "Flash Flood Warning",
  headline: "Flash Flood Warning issued for Warren County",
  severity: "Severe",
  areaDesc: "Warren, MS",
  expires: "2026-10-23T23:00:00Z",
};

/** A place a few inches above the forecast crest's water: LIKELY. */
const LOW: Pin = { ...LEVEE, id: "plow-likely", name: "Home", elevationFt: ZERO + 17.4 };

function setState(over: Partial<WatchState>) {
  hook.state = {
    pins: [LEVEE],
    watches: [],
    now: NOW,
    updatedAt: Date.parse(NOW),
    loading: false,
    error: false,
    fromSaved: false,
    refresh: () => {},
    ...over,
  };
}

function watchHtml(over: Partial<WatchState>, search = ""): string {
  nav.search = search;
  setState(over);
  return renderToStaticMarkup(<WatchClient />);
}

/** Visible text: tags stripped, entities decoded, spaces squeezed. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const src = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

beforeEach(() => {
  nav.search = "";
});

/* ------------------------------------------------------------------ */
/* Watch                                                               */
/* ------------------------------------------------------------------ */

describe("Watch, FULL tier: one page, in order", () => {
  const exampleSearch = `wl=${encodeWatchLink(EXAMPLE_PINS)}&ex=1`;
  const html = watchHtml(
    { pins: EXAMPLE_PINS, watches: [fullWatch(LEVEE), fullWatch(MUSEUM)] },
    exampleSearch,
  );

  it("runs picture, sentence, flood number, actions, past floods, example note", () => {
    const at = (needle: string) => {
      const i = html.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      at('role="img"'),
      at('data-testid="verdict-live"'),
      at('data-testid="flood-number"'),
      at('data-testid="watch-actions"'),
      at('data-testid="past-floods"'),
      at(copy.exampleNote.slice(0, 40)),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the flood number in whole feet with the levee line", () => {
    const t = text(html);
    expect(t).toContain("Your flood number about 46 ft on the Mississippi River gauge at Vicksburg.");
    expect(t).not.toContain("46.5");
    expect(t).toContain(copy.floodNumberLevees);
    expect(t).toContain(copy.floodNumberSliderLabel);
    expect(t).toContain(copy.floodNumberBack);
  });

  it("past floods is a closed native disclosure with the one-line summary showing", () => {
    expect(html).toMatch(/<details[^>]*data-testid="past-floods"/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(text(html)).toContain("All 5 of the highest crests here would have reached Levee St.");
    // The levee caveat is inside, one tap away.
    expect(text(html)).toContain(copy.pastFloodsCaveat);
  });

  it("the picture starts on the forecast crest, and the card has no what-if picture yet", () => {
    expect(html).toContain(">forecast crest</text>");
    expect(html).not.toContain(`>${copy.floodNumberSceneLabel}</text>`);
    expect(html).not.toContain('data-testid="flood-number-picture"');
  });

  it("the example note says the floodwall isn't counted", () => {
    expect(copy.exampleNote).toContain("Parts of Levee St sit behind Vicksburg's floodwall");
    expect(text(html)).toContain("which CrestWatch doesn't count");
  });

  it("groups the share actions under one accessible name, in the planned order", () => {
    expect(html).toContain(`role="group" aria-label="${copy.actionsLabel}"`);
    const group = html.slice(html.indexOf('data-testid="watch-actions"'));
    const share = group.indexOf(`>${copy.share}</button>`);
    const copyLink = group.indexOf(copy.copyLink);
    const calendar = group.indexOf('data-testid="add-to-calendar"');
    expect(share).toBeGreaterThan(-1);
    expect(copyLink).toBeGreaterThan(share);
    expect(calendar).toBeGreaterThan(copyLink);
  });

  it("Why this verdict comes before the actions and keeps its 44 px target", () => {
    expect(html.indexOf(copy.whyLink.replace("→", "")) ).toBeLessThan(
      html.indexOf('data-testid="watch-actions"'),
    );
    expect(html).toMatch(/<a[^>]*min-h-11[^>]*>Why this verdict →<\/a>/);
  });

  it("the Share button is 44 px tall now", () => {
    expect(src("components/watch/ShareButton.tsx")).toContain("!h-11");
    expect(src("components/watch/ShareButton.tsx")).not.toContain("!h-10");
  });

  it("Read it to me and Send to family wait for the browser (nothing on the server)", () => {
    expect(html).not.toContain('data-testid="read-aloud"');
    expect(html).not.toContain('data-testid="send-to-family"');
  });
});

describe("Watch: What to do now comes before the flood number", () => {
  const at = (html: string, needle: string) => {
    const i = html.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };
  const inOrder = (html: string) => {
    const order = [
      at(html, 'data-testid="verdict-live"'),
      at(html, 'data-testid="next-steps"'),
      at(html, 'data-testid="flood-number"'),
      at(html, 'data-testid="watch-actions"'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  };

  it("a LIKELY day: sentence, then what to do, then the flood number, then the actions", () => {
    const w = fullWatch(LOW);
    expect(w.verdict.tier === "FULL" && w.verdict.band).toBe("LIKELY");
    inOrder(watchHtml({ pins: [LOW], watches: [w] }));
  });

  it("an active alert on a dry-looking day: what to do still comes first", () => {
    const w = { ...fullWatch(), alerts: [FLASH] };
    const html = watchHtml({ watches: [w] });
    inOrder(html);
    expect(at(html, FLASH.event)).toBeLessThan(at(html, 'data-testid="next-steps"'));
  });
});

describe("Watch, FULL tier: approximate and edge cases", () => {
  it("an approximate pin gets a rough number and a rough past-floods label", () => {
    const pin: Pin = { ...LEVEE, id: "pa", name: "Vicksburg", approximate: true };
    const html = watchHtml({ pins: [pin], watches: [fullWatch(pin)] });
    const t = text(html);
    expect(t).toContain("Your rough flood number");
    expect(t).toContain("about 46 ft");
    expect(t).toContain("this spot");
  });

  it("no flood number when the ground sits below the gauge's zero, and nothing breaks", () => {
    const pin: Pin = { ...LEVEE, id: "plow", elevationFt: 40 };
    const html = watchHtml({ pins: [pin], watches: [fullWatch(pin)] });
    expect(html).not.toContain('data-testid="flood-number"');
    expect(html).toContain('data-testid="verdict-live"');
  });
});

describe("Watch, CATEGORY and ALERT-ONLY: no house-level extras", () => {
  it("CATEGORY shows no flood number and no past floods, even with a gauge zero on hand", () => {
    const html = watchHtml({ watches: [categoryWatch()] });
    expect(html).not.toContain('data-testid="flood-number"');
    expect(html).not.toContain('data-testid="past-floods"');
    expect(html).toContain('data-testid="watch-actions"');
    expect(text(html)).toContain(copy.copyLink);
  });

  it("ALERT-ONLY shows no flood number, past floods or calendar, and still has Copy watch link", () => {
    const html = watchHtml({ watches: [alertOnlyWatch()] });
    expect(html).not.toContain('data-testid="flood-number"');
    expect(html).not.toContain('data-testid="past-floods"');
    expect(html).not.toContain('data-testid="add-to-calendar"');
    expect(text(html)).toContain(copy.copyLink);
  });
});

describe("Add the crest to my calendar: only with a crest ahead", () => {
  const has = (w: PinWatch) =>
    watchHtml({ watches: [w] }).includes('data-testid="add-to-calendar"');

  it("FULL with a fresh forecast and a crest still coming", () => {
    expect(has(fullWatch())).toBe(true);
  });
  it("not once the river has peaked", () => {
    expect(has(fullWatch(LEVEE, { pastPeak: true }))).toBe(false);
  });
  it("not on an old forecast", () => {
    expect(has(fullWatch(LEVEE, { stale: OLD_FORECAST }))).toBe(false);
  });
  it("not for a crest time already behind us", () => {
    expect(has(fullWatch(LEVEE, { peakT: "2026-10-23T12:00:00Z" }))).toBe(false);
  });
  it("CATEGORY when the forecast still rises to a later crest", () => {
    expect(has(categoryWatch())).toBe(true);
  });
  it("not for CATEGORY when the forecast only falls (the 'peak' is the next point)", () => {
    const falling = [
      { t: "2026-10-24T12:00:00Z", stageFt: 31.0 },
      { t: "2026-10-26T12:00:00Z", stageFt: 30.1 },
    ];
    expect(has(categoryWatch(LEVEE, falling))).toBe(false);
  });
  it("never for ALERT-ONLY", () => {
    expect(has(alertOnlyWatch())).toBe(false);
  });

  it("crestAheadIso gives the crest time it saves", () => {
    expect(crestAheadIso(fullWatch(), NOW)).toBe("2026-10-26T12:00:00Z");
    expect(crestAheadIso(categoryWatch(), NOW)).toBe("2026-10-26T12:00:00Z");
    expect(crestAheadIso(alertOnlyWatch(), NOW)).toBeNull();
    // A bad clock never invents a crest.
    expect(crestAheadIso(fullWatch(), "not a time")).toBeNull();
  });
});

describe("the what-if slider draws its own picture; the main picture stays on the forecast", () => {
  const key = whatIfKeyFor("ex0", "VCKM6");

  it("uses a stage only for the place and gauge it was picked on", () => {
    expect(whatIfFor({ key, stageFt: 50 }, key, ZERO)).toBe(50);
    expect(whatIfFor({ key, stageFt: 50 }, whatIfKeyFor("ex1", "VCKM6"), ZERO)).toBeNull();
    expect(whatIfFor({ key, stageFt: 50 }, whatIfKeyFor("ex0", "GEEM6"), ZERO)).toBeNull();
    expect(whatIfFor(null, key, ZERO)).toBeNull();
    // No trusted gauge zero (the tier dropped): back to the forecast.
    expect(whatIfFor({ key, stageFt: 50 }, key, null)).toBeNull();
  });

  it("the what-if line is gauge zero + stage, labelled 'what-if level'; none on the forecast", () => {
    expect(whatIfCrest(ZERO, 50)).toEqual({
      crestElevFt: ZERO + 50,
      crestLabel: copy.floodNumberSceneLabel,
    });
    expect(copy.floodNumberSceneLabel).toBe("what-if level");
    expect(whatIfCrest(ZERO, null)).toBeNull();
    expect(whatIfCrest(null, 50)).toBeNull();
    expect(whatIfCrest(undefined, 50)).toBeNull();
    expect(whatIfCrest(ZERO, Number.NaN)).toBeNull();
  });

  it("the what-if picture has a proper name and measures the gap to that level", () => {
    const html = renderToStaticMarkup(
      <WaterScene
        markers={[{ label: LEVEE.name, elevationFt: LEVEE.elevationFt }]}
        currentWaterElevFt={ZERO + 15}
        {...whatIfCrest(ZERO, 50)!}
      />,
    );
    expect(html).toContain(`>${copy.floodNumberSceneLabel}</text>`);
    // 46.22 + 50 = 96.22, about 4 ft over Levee St's 92.7.
    expect(html).toContain('aria-label="What-if level reaches 4 ft above Levee St"');
  });

  it("the main picture always takes the forecast crest; only the card's picture takes a what-if", () => {
    const s = src("components/watch/WatchClient.tsx");
    const main = s.slice(s.indexOf("{/* The picture:"), s.indexOf("{/* The sentence."));
    expect(main).toContain("crestElevFt={verdict.peak.waterElevFt}");
    expect(main).not.toMatch(/whatIf|crestLabel/);
    const card = s.slice(s.indexOf("<FloodNumber key="), s.indexOf("</FloodNumber>"));
    expect(card).toMatch(/whatIfLine && \(\s*<WaterScene/);
    expect(card).toContain("{...whatIfLine}");
  });
});

describe("leaving the screen carries the same warnings", () => {
  it("the share card carries the refresh-failed line after a failed check", () => {
    const html = watchHtml({ watches: [fullWatch()], error: true });
    const card = html.slice(html.indexOf('data-testid="share-card"'));
    expect(text(card)).toContain("Couldn't check the river just now.");
  });

  it("Read it to me, Send to family and the calendar get the honesty notes and the alerts", () => {
    const s = src("components/watch/WatchClient.tsx");
    expect(s).toMatch(/<ReadAloud[^>]*notes=\{leavingNotes\}/);
    expect(s).toMatch(/<SendToFamily[\s\S]*?notes=\{leavingNotes\}/);
    expect(s).toMatch(/<AddToCalendar[\s\S]*?notes=\{leavingNotes\}/);
    expect(s).toMatch(
      /const alertNotes = alertNotesFor\(watch\);\s*const leavingNotes = \[\s*staleLine,\s*refreshFailedLine,\s*pin\.approximate \? copy\.approximateShare : null,\s*\.\.\.alertNotes,\s*\]/,
    );
  });

  it("an active flood alert travels with the answer, by name, once", () => {
    const w = { ...fullWatch(), alerts: [FLASH, { ...FLASH, headline: "again" }] };
    expect(alertNotesFor(w)).toEqual(["Active Weather Service alert here: Flash Flood Warning."]);
    const two = { ...w, alerts: [FLASH, { ...FLASH, event: "Flood Warning", areaDesc: "Hinds, MS" }] };
    expect(alertNotesFor(two)).toEqual([
      "Active Weather Service alerts here: Flash Flood Warning, Flood Warning.",
    ]);
    // No alerts, nothing added: the dry-day answer stays one sentence.
    expect(alertNotesFor(fullWatch())).toEqual([]);
  });

  it("ALERT-ONLY with the alert service down carries 'not an all-clear'", () => {
    expect(alertNotesFor({ ...alertOnlyWatch(), alertsOk: false })).toEqual([copy.alertServiceDown]);
    expect(alertNotesFor(alertOnlyWatch())).toEqual([]);
    // A gauge tier never claims it: it has its own answer.
    expect(alertNotesFor({ ...fullWatch(), alertsOk: false })).toEqual([]);
  });

  it("the share picture carries the alert a dry-looking FULL answer has on screen", () => {
    const html = watchHtml({ watches: [{ ...fullWatch(), alerts: [FLASH] }] });
    const card = text(html.slice(html.indexOf('data-testid="share-card"')));
    expect(card).toContain("stays dry");
    expect(card).toContain("Active Weather Service alert here: Flash Flood Warning.");
  });

  it("the share picture carries 'not an all-clear' when ALERT-ONLY couldn't check alerts", () => {
    const html = watchHtml({ watches: [{ ...alertOnlyWatch(), alertsOk: false }] });
    const card = text(html.slice(html.indexOf('data-testid="share-card"')));
    expect(card).toContain(text(copy.alertServiceDown));
  });
});

/* ------------------------------------------------------------------ */
/* Why                                                                 */
/* ------------------------------------------------------------------ */

describe("Why: the flood number in the arithmetic", () => {
  function whyHtml(w: PinWatch, pin: Pin = LEVEE) {
    nav.search = `pin=${pin.id}`;
    setState({ pins: [pin], watches: [w] });
    return renderToStaticMarkup(<WhyClient />);
  }

  it("FULL writes out ground minus gauge zero, rounded like the card", () => {
    const html = whyHtml(fullWatch());
    expect(html).toContain('data-testid="why-flood-number"');
    const block = text(html.slice(html.indexOf('data-testid="why-flood-number"')));
    expect(block).toContain("Your flood number");
    expect(block).toContain(`${copy.whyGroundLabel("Levee St")} 92.7 ft`);
    expect(block).toContain(`− ${copy.whyZeroLabel} 46.2 ft`);
    expect(block).toContain(`= ${copy.whyFloodNumberLabel} about 46 ft`);
    expect(block).not.toContain("46.5");
    expect(block).toContain(copy.floodNumberLevees);
  });

  it("an approximate pin is labelled rough there too", () => {
    const pin: Pin = { ...LEVEE, approximate: true };
    const block = text(whyHtml(fullWatch(pin), pin));
    expect(block).toContain("Your rough flood number");
    expect(block).toContain("about 46 ft");
  });

  it("CATEGORY has no flood number", () => {
    expect(whyHtml(categoryWatch())).not.toContain('data-testid="why-flood-number"');
  });
});

/* ------------------------------------------------------------------ */
/* Places                                                              */
/* ------------------------------------------------------------------ */

describe("Places: a quiet flood number line on FULL cards", () => {
  function placesHtml(pins: Pin[], watches: PinWatch[]) {
    setState({ pins, watches });
    return renderToStaticMarkup(<PlacesClient />);
  }

  it("FULL: 'floods at about 46 ft on the gauge', whole feet", () => {
    const html = placesHtml([LEVEE], [fullWatch()]);
    expect(text(html)).toContain("floods at about 46 ft on the gauge");
  });

  it("an approximate pin says roughly, next to its approximate tag", () => {
    const pin: Pin = { ...LEVEE, approximate: true };
    const t = text(placesHtml([pin], [fullWatch(pin)]));
    expect(t).toContain("floods at roughly 46 ft on the gauge");
    expect(t).toContain(copy.approximateTag);
  });

  it("CATEGORY and ALERT-ONLY cards have none", () => {
    expect(placesHtml([LEVEE], [categoryWatch()])).not.toContain("place-flood-number");
    expect(placesHtml([LEVEE], [alertOnlyWatch()])).not.toContain("place-flood-number");
  });
});

/* ------------------------------------------------------------------ */
/* Home, About, copy                                                   */
/* ------------------------------------------------------------------ */

describe("Home: the river check sits between the address box and the steps", () => {
  it("leads with the question and the address box", () => {
    const s = src("app/page.tsx");
    const setup = s.indexOf("<SetupFlow />");
    const rivers = s.indexOf('<RiverCheck className="max-w-xl" />');
    const steps = s.indexOf("copy.howItWorks");
    expect(setup).toBeGreaterThan(s.indexOf("copy.tagline"));
    expect(rivers).toBeGreaterThan(setup);
    expect(steps).toBeGreaterThan(rivers);
  });
});

describe("Levees and floodwalls are named where they matter", () => {
  it("About says it in what CrestWatch can't do", () => {
    const s = src("app/about/page.tsx");
    expect(s).toContain("{copy.honesty} {copy.aboutLevees}");
    expect(copy.aboutLevees).toContain("doesn't count levees or floodwalls");
    expect(copy.aboutLevees).toContain("a levee can also fail");
  });

  it("the glossary has a two-sentence entry", () => {
    const entry = copy.glossary.find((g) => g.term === "Levee and floodwall");
    expect(entry).toBeTruthy();
    expect(entry!.text.match(/[.?](\s|$)/g)).toHaveLength(2);
  });
});

describe("integration copy follows the deck's rules", () => {
  const strings = [
    copy.actionsLabel,
    copy.placesFloodNumber("floods at about 46 ft"),
    copy.floodNumberSceneLabel,
    copy.pastFloodsLikely,
    copy.pastFloodsTooClose,
    copy.alertsShare(["Flash Flood Warning"]),
    copy.alertsShare(["Flash Flood Warning", "Flood Warning"]),
    copy.whyGroundLabel("Home"),
    copy.whyZeroLabel,
    copy.whyFloodNumberLabel,
    copy.pastFloodsBiggerOne,
    copy.aboutLevees,
    copy.exampleNote,
    ...copy.glossary.map((g) => `${g.term} ${g.text}`),
  ];
  it("no em dashes, exclamation marks or banned words", () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/[—–!]/);
      expect(s, s).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
    }
  });
});
