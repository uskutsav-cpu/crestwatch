/**
 * Places + Why resilience and accessibility (work package placeswhy).
 * The data hook and the router are mocked so each screen can be rendered
 * in a known state (loading, failed, stale, broken link) without a server.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchState } from "@/lib/use-watch";
import type { Pin } from "@/lib/pins";
import type { PinWatch } from "@/lib/watch-service";
import type { Verdict } from "@/lib/surveyor";

const hook = vi.hoisted(() => ({
  state: null as unknown,
  calls: [] as unknown[],
  search: "",
}));

vi.mock("@/lib/use-watch", () => ({
  useWatches: (override: unknown = null) => {
    hook.calls.push(override);
    return hook.state;
  },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(hook.search),
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
}));

import { copy } from "@/lib/copy";
import { encodeWatchLink } from "@/lib/watch-link";
import { PlacesClient, edgeBand } from "@/components/places/PlacesClient";
import { BROKEN_LINK, WhyClient } from "@/components/why/WhyClient";
import { WatchClient } from "@/components/watch/WatchClient";
import { staleLineFor } from "@/lib/staleness";
import { fmtTime } from "@/lib/time";
import { chartAriaLabel } from "@/components/why/StatChart";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const HOME: Pin = {
  id: "p1",
  name: "Home",
  matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
  lat: 32.3004,
  lon: -90.1884,
  elevationFt: 275.5,
};
const GRANDMA: Pin = {
  id: "p2",
  name: "Grandma",
  matchedAddress: "VICKSBURG, MS",
  lat: 32.35,
  lon: -90.88,
  elevationFt: 241.6,
  approximate: true,
};

const FRESH = { observedH: 0.5, forecastH: 3, staleObserved: false, staleForecast: false };
const OLD = { observedH: 1430.7, forecastH: 1446, staleObserved: true, staleForecast: true };

function fullVerdict(over: Partial<Extract<Verdict, { tier: "FULL" }>> = {}): Verdict {
  return {
    tier: "FULL",
    band: "UNLIKELY",
    marginFt: 38.2,
    peak: { waterElevFt: 237.3, stageFt: 3.7, t: "2026-10-25T00:00:00Z" },
    crossing: null,
    pastPeak: false,
    currentlyAbove: false,
    currentWaterElevFt: 236.6,
    stale: FRESH,
    ...over,
  };
}

function categoryVerdict(category: Extract<Verdict, { tier: "CATEGORY" }>["category"]): Verdict {
  return {
    tier: "CATEGORY",
    peakStageFt: 9.3,
    peakT: "2026-10-25T00:00:00Z",
    aboveFloodFt: -19.7,
    category,
    stale: FRESH,
  };
}

function watchFor(pin: Pin, verdict: Verdict = fullVerdict()): PinWatch {
  return {
    pinId: pin.id,
    verdict,
    gauge:
      verdict.tier === "ALERT_ONLY"
        ? null
        : {
            lid: "JACM6",
            name: "Pearl River at Jackson",
            usgsId: "02486000",
            distanceMi: 1.4,
            gaugeZeroFt: 233.6,
            gaugeDatum: "NAVD88",
            categories: { action: 15, minor: 18, moderate: 28, major: 36 },
            historicCrests: [],
            observed: [
              { t: "2026-10-23T06:00:00Z", stageFt: 3.6 },
              { t: "2026-10-23T12:00:00Z", stageFt: 3.1 },
            ],
            forecast: [
              { t: "2026-10-23T18:00:00Z", stageFt: 3.2 },
              { t: "2026-10-25T00:00:00Z", stageFt: 3.7 },
              { t: "2026-10-26T00:00:00Z", stageFt: 3.4 },
            ],
            forecastIssued: "2026-10-23T13:00:00Z",
          },
    alerts: [],
    alertsOk: true,
  };
}

function setState(over: Partial<WatchState>) {
  hook.state = {
    pins: [],
    watches: [],
    now: "2026-10-23T15:00:00Z",
    updatedAt: null,
    loading: false,
    error: false,
    refresh: () => {},
    ...over,
  } satisfies WatchState;
}

/** Visible-ish text: tags stripped, entities decoded, spaces squeezed. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

beforeEach(() => {
  hook.calls = [];
  hook.search = "";
  setState({});
});

/* ------------------------------------------------------------------ */
/* Places                                                              */
/* ------------------------------------------------------------------ */

describe("Places: the river data failed on first load (#21, #3, #67)", () => {
  beforeEach(() => setState({ pins: [HOME, GRANDMA], watches: [], error: true }));

  it("still lists every saved place by name, with rename and remove", () => {
    const html = renderToStaticMarkup(<PlacesClient />);
    const t = text(html);
    expect(t).toContain("Home");
    expect(t).toContain("Grandma");
    expect(html).toContain('aria-label="Rename Home"');
    expect(html).toContain('aria-label="Remove Home"');
    expect(html).toContain('aria-label="Rename Grandma"');
    expect(html).toContain('aria-label="Remove Grandma"');
    expect(t.split(copy.placeUnchecked).length - 1).toBe(2);
  });

  it("explains what happened above the list, with Check again", () => {
    const html = renderToStaticMarkup(<PlacesClient />);
    const t = text(html);
    expect(t).toContain(copy.riverDataDown);
    expect(t).toContain(copy.refresh);
    expect(t.indexOf(copy.riverDataDown)).toBeLessThan(t.indexOf("Home"));
    expect(t.indexOf(copy.refresh)).toBeLessThan(t.indexOf("Home"));
    // Neutral edge: an unchecked place gets no verdict colour.
    expect(html).toContain("border-left:4px solid var(--color-line)");
    expect(html).not.toContain("var(--color-dryland)");
  });

  it("never shows an empty board next to Delete all", () => {
    const t = text(renderToStaticMarkup(<PlacesClient />));
    expect(t).toContain(copy.deleteAll);
    expect(t.indexOf("Home")).toBeLessThan(t.indexOf(copy.deleteAll));
    expect(t).not.toContain(copy.placesEmpty);
  });

  it("a shared copy string reads exactly as the PM wrote it", () => {
    expect(copy.riverDataDown).toBe(
      "The river data didn't answer. Your places are still saved. Try again in a minute.",
    );
    expect(copy.brokenLink).toBe(
      "This shared link didn't open. Ask for a new link, or add your own place.",
    );
  });

  it("the shared-link outage line follows the copy rules and makes no saved claim", () => {
    const s = copy.riverDataDownLinked;
    expect(s.startsWith("The river data didn't answer.")).toBe(true);
    expect(s).not.toMatch(/!|—|\bAI\b|saved/);
    expect(s).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
  });
});

describe("Places: first load in progress", () => {
  it("names the saved places while the river is being read", () => {
    setState({ pins: [HOME], watches: [], loading: true });
    const t = text(renderToStaticMarkup(<PlacesClient />));
    expect(t).toContain("Home");
    expect(t).toContain(copy.looking);
    expect(t).not.toContain(copy.riverDataDown);
    expect(t).not.toContain(copy.placeUnchecked);
  });
});

describe("Places: a refresh fails after a good load (#29)", () => {
  it("keeps the old cards and says when they're from", () => {
    const updatedAt = Date.parse("2026-10-23T19:15:00Z"); // 2:15 PM Central
    setState({ pins: [HOME], watches: [watchFor(HOME)], error: true, updatedAt });
    const t = text(renderToStaticMarkup(<PlacesClient />));
    expect(t).toContain(copy.refreshFailedPlaces("2:15 PM CT"));
    // Same clock as the Watch page's refresh-failed line.
    expect(fmtTime(updatedAt)).toBe("2:15 PM CT");
    expect(t).toContain("This spot stays dry by about 38 ft.");
    expect(t).not.toContain(copy.riverDataDown);
  });

  it("is quiet when the refresh worked", () => {
    setState({ pins: [HOME], watches: [watchFor(HOME)], updatedAt: Date.now() });
    const t = text(renderToStaticMarkup(<PlacesClient />));
    expect(t).not.toContain("Couldn't check the river just now");
  });
});

describe("Places: Check again keeps focus while checking (#35)", () => {
  it("uses aria-disabled, never disabled", () => {
    setState({ pins: [HOME], watches: [watchFor(HOME)], loading: true });
    const html = renderToStaticMarkup(<PlacesClient />);
    const button = html.match(/<button[^>]*>Check again<\/button>/)?.[0] ?? "";
    expect(button).toContain('aria-disabled="true"');
    expect(button).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it("does not refetch when pressed mid-check", () => {
    const src = readFileSync(
      join(__dirname, "..", "components", "places", "PlacesClient.tsx"),
      "utf8",
    );
    expect(src).toContain("if (!loading) refresh();");
  });
});

describe("Places: focus after remove or delete all (#42)", () => {
  it("the page title can take focus", () => {
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    expect(renderToStaticMarkup(<PlacesClient />)).toMatch(
      /<h1[^>]*tabindex="-1"[^>]*>Your places<\/h1>/,
    );
    setState({ pins: [], watches: [] });
    expect(renderToStaticMarkup(<PlacesClient />)).toMatch(
      /<h1[^>]*tabindex="-1"[^>]*>Your places<\/h1>/,
    );
  });

  it("removing and deleting all both hand focus to the title", () => {
    const src = readFileSync(
      join(__dirname, "..", "components", "places", "PlacesClient.tsx"),
      "utf8",
    );
    const flagged = src.match(/focusHeading\.current = true;/g) ?? [];
    expect(flagged).toHaveLength(2);
    expect(src).toContain("headingRef.current?.focus()");
  });
});

describe("Places: card details", () => {
  it("speaks the river trend next to the hidden arrow (#45)", () => {
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    const html = renderToStaticMarkup(<PlacesClient />);
    expect(html).toContain('<span aria-hidden="true">↓</span>');
    expect(html).toContain(`<span class="sr-only">${copy.trendFalling}</span>`);
  });

  it("tags a town-center place (#4)", () => {
    setState({ pins: [HOME, GRANDMA], watches: [watchFor(HOME), watchFor(GRANDMA)] });
    const html = renderToStaticMarkup(<PlacesClient />);
    expect(html.split(`>${copy.approximateTag}</span>`).length - 1).toBe(1);
  });

  it("an alert two places share shows once, and a third distinct one still shows (#11)", () => {
    const base = { headline: null, severity: "Moderate", expires: null };
    const A = { ...base, event: "Flood Warning", areaDesc: "Yazoo, MS" };
    const B = { ...base, event: "Flood Watch", areaDesc: "Hinds, MS" };
    const C = { ...base, event: "Flash Flood Warning", areaDesc: "Warren, MS" };
    setState({
      pins: [HOME, GRANDMA],
      watches: [
        { ...watchFor(HOME), alerts: [A, B] },
        { ...watchFor(GRANDMA), alerts: [{ ...A }, C] },
      ],
    });
    const html = renderToStaticMarkup(<PlacesClient />);
    const shown = [...html.matchAll(/<span class="font-semibold text-risewatch">([^<]+)<\/span>/g)].map(
      (m) => m[1],
    );
    expect(shown).toEqual(["Flood Warning", "Flood Watch", "Flash Flood Warning"]);
  });

  it("the tag wraps under a long name instead of painting over it (320 px)", () => {
    for (const watches of [[watchFor(GRANDMA)], []]) {
      setState({ pins: [GRANDMA], watches, error: watches.length === 0 });
      const html = renderToStaticMarkup(<PlacesClient />);
      expect(html).toContain('<div class="flex flex-wrap items-center gap-x-2 gap-y-1">');
      expect(html).toMatch(/<p class="[^"]*\[overflow-wrap:anywhere\][^"]*">Grandma<\/p>/);
      expect(html).toMatch(/<span class="[^"]*whitespace-nowrap[^"]*">approximate spot<\/span>/);
    }
  });

  it("CATEGORY edge colour matches the Watch chip table (#68)", () => {
    expect(edgeBand(watchFor(HOME, categoryVerdict("none")))).toBe("UNLIKELY");
    expect(edgeBand(watchFor(HOME, categoryVerdict(null)))).toBe("UNLIKELY");
    expect(edgeBand(watchFor(HOME, categoryVerdict("action")))).toBe("BORDERLINE");
    expect(edgeBand(watchFor(HOME, categoryVerdict("minor")))).toBe("BORDERLINE");
    expect(edgeBand(watchFor(HOME, categoryVerdict("moderate")))).toBe("LIKELY");
    expect(edgeBand(watchFor(HOME, categoryVerdict("major")))).toBe("LIKELY");
    expect(edgeBand(watchFor(HOME, fullVerdict({ band: "LIKELY" })))).toBe("LIKELY");
  });
});

/* ------------------------------------------------------------------ */
/* Why                                                                 */
/* ------------------------------------------------------------------ */

describe("Why: the river data failed but places exist (#22, #3, #67)", () => {
  beforeEach(() => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [], error: true });
  });

  it("says the data didn't answer, offers Check again and the way back", () => {
    const html = renderToStaticMarkup(<WhyClient />);
    const t = text(html);
    expect(t).toContain(copy.riverDataDown);
    expect(t).toContain(copy.refresh);
    expect(html).toContain('href="/watch?pin=p1"');
    expect(t).toContain(copy.backToWatch);
  });

  it("never shows the add-your-first-place prompt", () => {
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).not.toContain(copy.placesEmpty);
    expect(t).not.toContain(copy.addPlace);
  });

  it("on a shared link, never claims places were saved on this device", () => {
    const wl = encodeWatchLink([HOME]);
    hook.search = `pin=wl0&wl=${wl}`;
    setState({ pins: [{ ...HOME, id: "wl0" }], watches: [], error: true });
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).toContain(copy.riverDataDownLinked);
    expect(t).not.toContain("still saved");
    expect(t).toContain(copy.refresh);
  });

  it("keeps the button on screen (aria-disabled) while retrying", () => {
    setState({ pins: [HOME], watches: [], error: true, loading: true });
    const html = renderToStaticMarkup(<WhyClient />);
    expect(text(html)).toContain(copy.riverDataDown);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"/);
  });

  it("on a shared link it never claims places are saved", () => {
    hook.search = `pin=wl0&wl=${encodeWatchLink([HOME])}`;
    setState({ pins: [{ ...HOME, id: "wl0" }], watches: [], error: true });
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).toContain(copy.riverDataDownLinked);
    expect(t).not.toContain("still saved");
  });

  it("still shows the empty prompt when there really are no places", () => {
    setState({ pins: [], watches: [], error: false });
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).toContain(copy.placesEmpty);
    expect(t).not.toContain(copy.riverDataDown);
  });
});

describe("Why: a shared link that doesn't decode (#28)", () => {
  it("shows the broken-link note with a way home, never this device's places", () => {
    hook.search = "pin=wl0&wl=W1siR3JhbmRtYSIs";
    // Even if the hook handed back local places, they must not show.
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    const html = renderToStaticMarkup(<WhyClient />);
    const t = text(html);
    expect(t).toContain(copy.brokenLink);
    expect(html).toContain('href="/"');
    expect(t).not.toContain("Home");
    expect(t).not.toContain(copy.whyTitle);
  });

  it("passes one stable empty array to the hook, render after render", () => {
    hook.search = "wl=abc";
    renderToStaticMarkup(<WhyClient />);
    renderToStaticMarkup(<WhyClient />);
    expect(hook.calls).toHaveLength(2);
    expect(hook.calls[0]).toBe(BROKEN_LINK);
    expect(hook.calls[1]).toBe(BROKEN_LINK);
    expect(BROKEN_LINK).toHaveLength(0);
  });

  it("treats an empty ?wl= as broken too", () => {
    hook.search = "wl=";
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).toContain(copy.brokenLink);
  });

  it("a good link still decodes and is passed through", () => {
    hook.search = `pin=wl0&wl=${encodeWatchLink([HOME])}`;
    setState({ pins: [{ ...HOME, id: "wl0" }], watches: [watchFor({ ...HOME, id: "wl0" })] });
    const html = renderToStaticMarkup(<WhyClient />);
    expect(text(html)).not.toContain(copy.brokenLink);
    expect(hook.calls[0]).not.toBe(BROKEN_LINK);
    expect(Array.isArray(hook.calls[0])).toBe(true);
    expect(html).toContain(`href="/watch?pin=wl0&amp;wl=${encodeWatchLink([HOME])}"`);
  });

  it("no ?wl= means this device's own places", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    renderToStaticMarkup(<WhyClient />);
    expect(hook.calls[0]).toBeNull();
  });
});

describe("Why: first load skeleton (#77)", () => {
  it("is busy, pulses only when motion is welcome, and says what it's doing", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [], loading: true });
    const html = renderToStaticMarkup(<WhyClient />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).not.toMatch(/[\s"]animate-pulse/);
    expect(text(html)).toContain(copy.looking);
  });
});

describe("Why: staleness near the verdict (#7, #69)", () => {
  it("shows the Heads up line when the data is old", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [watchFor(HOME, fullVerdict({ stale: OLD }))] });
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).toContain(copy.staleness(1446));
    expect(t.indexOf(copy.staleness(1446))).toBeLessThan(t.indexOf("The water side"));
  });

  it("stays quiet when the data is fresh", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).not.toContain(copy.staleness(0).slice(0, 10));
  });

  it("staleLineFor reads the older of the two feeds", () => {
    expect(staleLineFor(fullVerdict({ stale: OLD }))).toBe(copy.staleness(1446));
    expect(staleLineFor(fullVerdict())).toBeNull();
    expect(staleLineFor({ tier: "ALERT_ONLY" })).toBeNull();
    expect(
      staleLineFor({ ...categoryVerdict("none"), stale: { ...FRESH, staleObserved: true, observedH: 30.4 } } as Verdict),
    ).toBe(copy.staleness(30));
  });

  it("a missing forecast issue time says freshness is unknown, never 0 hours old", () => {
    const unknown = { observedH: 0.3, forecastH: null, staleObserved: false, staleForecast: true };
    expect(staleLineFor(fullVerdict({ stale: unknown }))).toBe(copy.stalenessUnknown);
    hook.search = "pin=p1";
    for (const verdict of [
      fullVerdict({ stale: unknown }),
      { ...categoryVerdict("none"), stale: { observedH: null, forecastH: null, staleObserved: true, staleForecast: true } } as Verdict,
    ]) {
      setState({ pins: [HOME], watches: [watchFor(HOME, verdict)] });
      const t = text(renderToStaticMarkup(<WhyClient />));
      expect(t).toContain(copy.stalenessUnknown);
      expect(t).not.toContain("0 hours old");
    }
  });
});

describe("Watch: a shared link during an outage", () => {
  it("never claims places were saved on this device", () => {
    hook.search = `pin=wl0&wl=${encodeWatchLink([HOME])}`;
    setState({ pins: [{ ...HOME, id: "wl0" }], watches: [], error: true });
    const t = text(renderToStaticMarkup(<WatchClient />));
    expect(t).toContain(copy.riverDataDownLinked);
    expect(t).not.toContain("still saved");
  });

  it("this device's own places keep the saved reassurance", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [], error: true });
    expect(text(renderToStaticMarkup(<WatchClient />))).toContain(copy.riverDataDown);
  });
});

describe("Why: the arithmetic (#4, #46)", () => {
  it("the two arithmetic sections are h2 headings with the same look", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    const html = renderToStaticMarkup(<WhyClient />);
    expect(html).toMatch(/<h2 class="mb-3 text-small font-semibold text-dim">\s*The water side\s*<\/h2>/);
    expect(html).toMatch(/<h2 class="mb-3 text-small font-semibold text-dim">\s*Your side\s*<\/h2>/);
  });

  it("an approximate pin says so in the math", () => {
    hook.search = "pin=p2";
    setState({ pins: [GRANDMA], watches: [watchFor(GRANDMA)] });
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).toContain(`Grandma sits at (${copy.approximateTag})`);
    expect(t).toContain(copy.approximateNote);
  });

  it("a street-address pin carries no town-center note", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    const t = text(renderToStaticMarkup(<WhyClient />));
    expect(t).not.toContain(copy.approximateNote);
    expect(t).not.toContain(`(${copy.approximateTag})`);
  });

  it("the chart's label carries the numbers it draws", () => {
    hook.search = "pin=p1";
    setState({ pins: [HOME], watches: [watchFor(HOME)] });
    const html = renderToStaticMarkup(<WhyClient />);
    const label = html.match(/<svg[^>]*role="img"[^>]*aria-label="([^"]*)"/)?.[1] ?? "";
    expect(label).toContain("Latest reading 3.1 ft.");
    expect(label).toContain("Forecast high 3.7 ft.");
    expect(label).toContain("Flood stage 18.0 ft.");
    expect(label).not.toBe("River stage: observed and forecast");
  });
});

describe("chartAriaLabel", () => {
  const obs = [{ t: "2026-10-23T06:00:00Z", stageFt: 12.04 }];
  const fc = [
    { t: "2026-10-24T06:00:00Z", stageFt: 19.26 },
    { t: "2026-10-25T06:00:00Z", stageFt: 17.5 },
  ];

  it("reads latest, forecast high and flood stage", () => {
    expect(chartAriaLabel({ observed: obs, forecast: fc, floodStageFt: 18 })).toBe(
      "River stage chart, in feet on the gauge. Latest reading 12.0 ft. Forecast high 19.3 ft. Flood stage 18.0 ft.",
    );
  });

  it("is honest about missing pieces", () => {
    expect(chartAriaLabel({ observed: [], forecast: fc, floodStageFt: null })).toBe(
      "River stage chart, in feet on the gauge. No recent readings. Forecast high 19.3 ft.",
    );
    expect(chartAriaLabel({ observed: obs, forecast: [] })).toBe(
      "River stage chart, in feet on the gauge. Latest reading 12.0 ft. No forecast.",
    );
  });
});
