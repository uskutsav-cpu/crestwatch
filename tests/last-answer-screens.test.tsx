/**
 * The last saved answer on screen (package lastanswer): Watch and Why must
 * read it as an older answer after a failed check, never as a live one.
 * The data hook and the router are stubbed, so each state renders to
 * static HTML without a browser.
 */

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
import { fmtTime } from "@/lib/time";
import { WatchClient } from "@/components/watch/WatchClient";
import { WhyClient } from "@/components/why/WhyClient";

const NOW = "2026-10-23T19:00:00Z";
/** When the saved answer arrived: an hour before NOW. */
const SAVED_AT = Date.parse("2026-10-23T18:00:00Z");

const HOME: Pin = {
  id: "phome",
  name: "Home",
  matchedAddress: "100 E CAPITOL ST, JACKSON, MS, 39201",
  lat: 32.300441828077,
  lon: -90.188419699815,
  elevationFt: 275.5,
};

/** An hour old: still under the 2-hour "data delayed" limit. */
const RECENT: Staleness = {
  observedH: 1.5,
  forecastH: 4,
  staleObserved: false,
  staleForecast: false,
};

function fullWatch(): PinWatch {
  return {
    pinId: HOME.id,
    verdict: {
      tier: "FULL",
      band: "UNLIKELY",
      marginFt: 38.4,
      peak: { waterElevFt: 237.1, stageFt: 3.7, t: "2026-10-26T00:00:00Z" },
      crossing: null,
      pastPeak: false,
      currentlyAbove: false,
      currentWaterElevFt: 236.9,
      stale: RECENT,
    },
    gauge: {
      lid: "JACM6",
      name: "Pearl River at Jackson",
      usgsId: "02486000",
      distanceMi: 1.2,
      gaugeZeroFt: 233.39,
      gaugeDatum: "NGVD29",
      categories: { action: 25, minor: 28, moderate: 36, major: 38 },
      historicCrests: [],
      observed: [
        { t: "2026-10-23T17:15:00Z", stageFt: 3.5 },
        { t: "2026-10-23T17:30:00Z", stageFt: 3.5 },
      ],
      forecast: [{ t: "2026-10-26T00:00:00Z", stageFt: 3.7 }],
      forecastIssued: "2026-10-23T15:00:00Z",
    },
    alerts: [],
    alertsOk: true,
  };
}

function alertOnlyWatch(): PinWatch {
  return {
    pinId: HOME.id,
    verdict: { tier: "ALERT_ONLY" },
    gauge: null,
    alerts: [],
    alertsOk: true,
  };
}

/** The saved answer, shown after a failed check (what useWatches gives). */
function saved(watch: PinWatch): Partial<WatchState> {
  return { watches: [watch], updatedAt: SAVED_AT, error: true, fromSaved: true };
}
/** The same answer from a check that just worked. */
function fresh(watch: PinWatch): Partial<WatchState> {
  return { watches: [watch], updatedAt: SAVED_AT, error: false, fromSaved: false };
}

function render(screen: "watch" | "why", over: Partial<WatchState>): string {
  nav.search = "";
  hook.state = {
    pins: [HOME],
    watches: [],
    now: NOW,
    updatedAt: null,
    loading: false,
    error: false,
    fromSaved: false,
    refresh: () => {},
    ...over,
  };
  return renderToStaticMarkup(screen === "watch" ? <WatchClient /> : <WhyClient />);
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

const failedLine = copy.refreshFailed(fmtTime(SAVED_AT));
const NO_ALERTS_NOW = "No flood alerts are active for this spot right now.";

beforeEach(() => {
  nav.search = "";
});

describe("Why with the saved answer", () => {
  it("says the check failed and when the answer is from, every tier", () => {
    for (const w of [fullWatch(), alertOnlyWatch()]) {
      const t = text(render("why", saved(w)));
      expect(t).toContain(failedLine);
    }
  });

  it("an alerts-only place never says 'no alerts right now' from an old answer", () => {
    const t = text(render("why", saved(alertOnlyWatch())));
    expect(t).not.toContain(NO_ALERTS_NOW);
    // It says what it can't vouch for instead.
    expect(t).toContain("That is not an all-clear.");
  });

  it("a failed refresh during the visit is treated the same way", () => {
    const t = text(render("why", { ...saved(alertOnlyWatch()), fromSaved: false }));
    expect(t).toContain(failedLine);
    expect(t).not.toContain(NO_ALERTS_NOW);
  });

  it("after a check that worked, nothing changes", () => {
    const tAlert = text(render("why", fresh(alertOnlyWatch())));
    expect(tAlert).toContain(NO_ALERTS_NOW);
    expect(tAlert).not.toContain("Couldn't check the river");
    const tFull = text(render("why", fresh(fullWatch())));
    expect(tFull).not.toContain("Couldn't check the river");
  });
});

describe("Watch with the saved answer", () => {
  it("never shows the live chip next to 'Couldn't check the river just now'", () => {
    const html = render("watch", saved(fullWatch()));
    const t = text(html);
    expect(t).toContain(failedLine);
    expect(t).not.toMatch(/live · updated/);
    // The verdict itself is still there.
    expect(t).toMatch(/stays dry by about 38 ft/);
  });

  it("the same after a failed refresh during the visit", () => {
    const t = text(render("watch", { ...saved(fullWatch()), fromSaved: false }));
    expect(t).not.toMatch(/live · updated/);
    expect(t).toContain(failedLine);
  });

  it("an alerts-only place keeps 'alerts checked {time}', which is still true", () => {
    const t = text(render("watch", saved(alertOnlyWatch())));
    expect(t).toContain(copy.alertsCheckedChip(fmtTime(SAVED_AT)));
    expect(t).toContain(failedLine);
  });

  it("after a check that worked, the live chip is back", () => {
    const t = text(render("watch", fresh(fullWatch())));
    expect(t).toContain(copy.liveChip(fmtTime("2026-10-23T17:30:00Z")));
    expect(t).not.toContain("Couldn't check the river");
  });
});
