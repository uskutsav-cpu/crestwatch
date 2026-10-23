/**
 * /watch failure states, honesty and next steps (work package "watch").
 * Renders WatchClient to static HTML with the data hook and the router
 * stubbed, so each screen state can be checked without a browser.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchState } from "@/lib/use-watch";
import type { PinWatch } from "@/lib/watch-service";
import type { Pin } from "@/lib/pins";
import type { Staleness } from "@/lib/surveyor";

const nav = vi.hoisted(() => ({ search: "" }));
const hook = vi.hoisted(() => ({
  state: null as unknown as WatchState,
  calls: [] as Array<Pin[] | null>,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/use-watch", () => ({
  useWatches: (override: Pin[] | null) => {
    hook.calls.push(override);
    return hook.state;
  },
}));

import { copy } from "@/lib/copy";
import { encodeWatchLink } from "@/lib/watch-link";
import { verdictSentence } from "@/lib/sentences";
import { heightGloss } from "@/lib/kid-scale";
import {
  WatchClient,
  chipFor,
  copyWithFallback,
  fmtTime,
  freshnessChip,
  glossLineFor,
  latestReadingIso,
  saveLinkedPins,
  shownFeet,
  staleLineFor,
} from "@/components/watch/WatchClient";
import { AlertStrip, dedupeAlerts } from "@/components/watch/AlertStrip";
import {
  NEXT_STEP_LINKS,
  NextSteps,
  needsNextSteps,
} from "@/components/watch/NextSteps";
import { shareStamp } from "@/components/watch/ShareButton";
import { MAX_PINS, STORAGE_KEYS } from "@/lib/config";
import type { FloodAlert } from "@/lib/alerts";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const NOW = "2026-10-23T19:00:00Z";
const HOME: Pin = {
  id: "phome",
  name: "Home",
  matchedAddress: "100 E CAPITOL ST, JACKSON, MS, 39201",
  lat: 32.300441828077,
  lon: -90.188419699815,
  elevationFt: 275.5,
};

const FRESH: Staleness = {
  observedH: 0.5,
  forecastH: 3,
  staleObserved: false,
  staleForecast: false,
};
const STALE: Staleness = {
  observedH: 1430.7,
  forecastH: 1446,
  staleObserved: true,
  staleForecast: true,
};

function gauge(observed = [
  { t: "2026-10-23T18:15:00Z", stageFt: 3.5 },
  { t: "2026-10-23T18:30:00Z", stageFt: 3.5 },
]) {
  return {
    lid: "JACM6",
    name: "Pearl River at Jackson",
    usgsId: "02486000",
    distanceMi: 1.2,
    gaugeZeroFt: 233.39,
    gaugeDatum: "NGVD29",
    categories: { action: 25, minor: 28, moderate: 36, major: 38 },
    historicCrests: [],
    observed,
    forecast: [{ t: "2026-10-26T00:00:00Z", stageFt: 3.7 }],
    forecastIssued: "2026-10-23T16:00:00Z",
  };
}

function fullWatch(
  over: Partial<{
    band: "LIKELY" | "BORDERLINE" | "UNLIKELY";
    marginFt: number;
    stale: Staleness;
    alerts: FloodAlert[];
  }> = {},
): PinWatch {
  return {
    pinId: HOME.id,
    verdict: {
      tier: "FULL",
      band: over.band ?? "UNLIKELY",
      marginFt: over.marginFt ?? 38.4,
      peak: { waterElevFt: 237.1, stageFt: 3.7, t: "2026-10-26T00:00:00Z" },
      crossing: null,
      pastPeak: false,
      currentlyAbove: false,
      currentWaterElevFt: 236.9,
      stale: over.stale ?? FRESH,
    },
    gauge: gauge(),
    alerts: over.alerts ?? [],
    alertsOk: true,
  };
}

function categoryWatch(
  category: "none" | "action" | "minor" | "moderate" | "major" | null,
): PinWatch {
  return {
    pinId: HOME.id,
    verdict: {
      tier: "CATEGORY",
      peakStageFt: 9.3,
      peakT: "2026-10-26T00:00:00Z",
      aboveFloodFt: -19.7,
      category,
      stale: FRESH,
    },
    gauge: gauge(),
    alerts: [],
    alertsOk: true,
  };
}

function alertOnlyWatch(alertsOk = true, alerts: FloodAlert[] = []): PinWatch {
  return {
    pinId: HOME.id,
    verdict: { tier: "ALERT_ONLY" },
    gauge: null,
    alerts,
    alertsOk,
  };
}

const UPDATED_AT = Date.parse("2026-10-23T18:45:00Z");

function state(over: Partial<WatchState> = {}): WatchState {
  return {
    pins: [HOME],
    watches: [fullWatch()],
    now: NOW,
    updatedAt: UPDATED_AT,
    loading: false,
    error: false,
    refresh: () => {},
    ...over,
  };
}

function render(over: Partial<WatchState> = {}, search = ""): string {
  nav.search = search;
  hook.state = state(over);
  return renderToStaticMarkup(<WatchClient />);
}

/** Visible page text with the offscreen share card removed. */
function pageOnly(html: string): string {
  const i = html.indexOf('data-testid="share-card"');
  return i === -1 ? html : html.slice(0, i);
}
function shareCard(html: string): string {
  const i = html.indexOf('data-testid="share-card"');
  return i === -1 ? "" : html.slice(i);
}
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

beforeEach(() => {
  hook.calls = [];
});

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

describe("watch copy keys", () => {
  it("uses the PM's exact shared error text", () => {
    expect(copy.riverDataDown).toBe(
      "The river data didn't answer. Your places are still saved. Try again in a minute.",
    );
    expect(copy.brokenLink).toBe(
      "This shared link didn't open. Ask for a new link, or add your own place.",
    );
  });

  it("keeps the CATEGORY chip labels from the PM table", () => {
    expect(copy.chipCategoryNone).toBe("below flood stage");
    expect(copy.chipCategoryAction).toBe("near flood stage");
    expect(copy.chipCategoryMinor).toBe("minor flooding");
    expect(copy.chipCategoryModerate).toBe("moderate flooding");
    expect(copy.chipCategoryMajor).toBe("major flooding");
  });

  it("follows the copy deck voice rules", () => {
    const strings = [
      copy.riverDataDown,
      copy.brokenLink,
      copy.refreshFailed("2:15 PM CT"),
      copy.alertsCheckedChip("2:15 PM CT"),
      copy.saveLinkedPins,
      copy.storageBlocked,
      copy.approximateShare,
      copy.stalenessUnknown,
      copy.nextStepsTitle,
      ...copy.nextSteps,
      copy.nextStepsLinkNws,
      copy.nextStepsLinkMsema,
      copy.nextStepsLinkMdot,
    ];
    for (const s of strings) {
      expect(s).not.toMatch(/!|—|\bAI\b/);
      expect(s).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
    }
    expect(copy.nextSteps).toHaveLength(3);
  });
});

/* ------------------------------------------------------------------ */
/* #26 / #29 failure states, #77 skeleton, #28 broken link             */
/* ------------------------------------------------------------------ */

describe("failure states", () => {
  it("#26: a failed first load says so and offers Check again", () => {
    const html = render({ watches: [], updatedAt: null, error: true });
    expect(html).toContain(esc(copy.riverDataDown));
    expect(html).toMatch(/<button[^>]*>Check again<\/button>/);
    expect(html).not.toContain("Try again in a minute.</div>");
  });

  it("#26/#35: while the retry runs, the button stays focusable (aria-disabled, not disabled)", () => {
    const html = render({
      watches: [],
      updatedAt: null,
      error: true,
      loading: true,
    });
    // The error state stays mounted so focus isn't dropped to <body>.
    expect(html).toContain(esc(copy.riverDataDown));
    const btn = html.match(/<button[^>]*>Check again<\/button>/)?.[0] ?? "";
    expect(btn).toContain('aria-disabled="true"');
    expect(btn).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it("#29: a failed refresh after a good load shows when the answer is from", () => {
    const html = render({ error: true });
    expect(html).toContain(esc(copy.refreshFailed(fmtTime(UPDATED_AT))));
    expect(html).toContain("CT.");
    // The last good verdict is still on screen.
    expect(html).toMatch(/stays dry by about 38 ft/);
  });

  it("#29: no refresh-failed line when the last check worked", () => {
    const html = render();
    expect(html).not.toContain("Couldn&#x27;t check the river");
  });

  it("#77: the first load is a pulsing skeleton that screen readers can read", () => {
    const html = render({ watches: [], updatedAt: null, loading: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).toContain("aspect-[20/11]");
    expect(html).toMatch(/role="status"[^>]*>.*Reading the river…/);
    // The status text is not hidden from assistive tech.
    const status = html.slice(html.indexOf('role="status"') - 200);
    expect(status.slice(0, 200)).not.toContain('aria-hidden="true" role');
  });

  it("#28: a truncated ?wl= shows the broken-link message, never this device's places", () => {
    const good = encodeWatchLink([{ ...HOME, name: "Grandma" }]);
    const html = render(
      { pins: [], watches: [], loading: true },
      `wl=${good.slice(0, -3)}`,
    );
    expect(html).toContain(esc(copy.brokenLink));
    expect(html).toContain('href="/"');
    expect(html).not.toContain("Home");
    expect(html).not.toContain(esc(copy.placesEmpty));
    // The hook got an empty override, so it never reads localStorage.
    expect(hook.calls.at(-1)).toEqual([]);
  });

  it("#28: an empty ?wl= is a broken link too", () => {
    const html = render({ pins: [], watches: [], loading: false }, "wl=");
    expect(html).toContain(esc(copy.brokenLink));
  });

  it("#28: the broken-link sentinel is one stable module-level array", () => {
    hook.calls = [];
    render({ pins: [], watches: [] }, "wl=abc");
    render({ pins: [], watches: [] }, "wl=abc");
    render({ pins: [], watches: [] }, "wl=xyz!");
    const [a, b, c] = hook.calls;
    expect(a).toEqual([]);
    // Same identity across renders, so useWatches' refresh never re-fires.
    expect(a).toBe(b);
    expect(a).toBe(c);
    const src = readFileSync(
      join(__dirname, "..", "components", "watch", "WatchClient.tsx"),
      "utf8",
    );
    expect(src).toMatch(/^const BROKEN_LINK: Pin\[\] = \[\];$/m);
  });

  it("a valid ?wl= still renders the sender's place", () => {
    const html = render({}, `wl=${encodeWatchLink([HOME])}`);
    expect(html).toContain("viewing a shared watch link");
    expect(hook.calls.at(-1)?.[0]?.name).toBe("Home");
  });
});

/* ------------------------------------------------------------------ */
/* #35 live region                                                     */
/* ------------------------------------------------------------------ */

describe("#35 announcing a changed verdict", () => {
  it("wraps the sentence in a polite, atomic live region", () => {
    const html = render();
    expect(html).toMatch(
      /<div aria-live="polite" aria-atomic="true" data-testid="verdict-live"><p[^>]*>The Pearl River peaks/,
    );
  });

  it("keeps the same region (and the Check again name) during a refresh", () => {
    const html = render({ loading: true });
    expect(html).toContain('data-testid="verdict-live"');
    const btn = html.match(/<button[^>]*>Check again<\/button>/)?.[0] ?? "";
    expect(btn).toContain('aria-disabled="true"');
    expect(btn).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(html).not.toContain(">…</button>");
  });
});

/* ------------------------------------------------------------------ */
/* #68 CATEGORY chips, #74 freshness chip                              */
/* ------------------------------------------------------------------ */

describe("#68 CATEGORY chip table", () => {
  it.each([
    ["none", "UNLIKELY", "below flood stage"],
    [null, "UNLIKELY", "below flood stage"],
    ["action", "BORDERLINE", "near flood stage"],
    ["minor", "BORDERLINE", "minor flooding"],
    ["moderate", "LIKELY", "moderate flooding"],
    ["major", "LIKELY", "major flooding"],
  ] as const)("%s → %s '%s'", (category, band, label) => {
    expect(chipFor(categoryWatch(category))).toEqual({ band, label });
  });

  it("drops the internal tier badge and 'category mode' from /watch", () => {
    const html = render({ watches: [categoryWatch("none")] });
    expect(html).toContain(">below flood stage</span>");
    expect(html).not.toContain(">CATEGORY<");
    expect(html).not.toContain("category mode");
    // UNLIKELY (green) chip, not amber.
    expect(html).toContain("background-color:var(--color-dryland)");
  });
});

describe("#74 freshness chip", () => {
  it("FULL uses the newest observed reading, in CT", () => {
    const w = fullWatch();
    expect(freshnessChip(w, UPDATED_AT)).toEqual({
      live: true,
      label: `live · updated ${fmtTime("2026-10-23T18:30:00Z")}`,
    });
  });

  it("CATEGORY uses the newest reading too (not 'now')", () => {
    const chip = freshnessChip(categoryWatch("none"), UPDATED_AT);
    expect(chip?.label).toBe("live · updated 1:30 PM CT");
  });

  it("finds the newest reading even out of order", () => {
    expect(
      latestReadingIso([
        { t: "2026-10-23T18:30:00Z", stageFt: 1 },
        { t: "bad", stageFt: 1 },
        { t: "2026-10-23T17:00:00Z", stageFt: 1 },
      ]),
    ).toBe("2026-10-23T18:30:00Z");
    expect(latestReadingIso([])).toBeNull();
  });

  it("ALERT-ONLY says when alerts were checked, never 'live · updated now'", () => {
    expect(freshnessChip(alertOnlyWatch(), UPDATED_AT)).toEqual({
      live: false,
      label: "alerts checked 1:45 PM CT",
    });
    const html = render({ watches: [alertOnlyWatch()] });
    expect(html).toContain("alerts checked 1:45 PM CT");
    expect(html).not.toContain("updated now");
    expect(html).not.toContain(">ALERT-ONLY<");
  });

  it("ALERT-ONLY with the alert service down claims no check at all", () => {
    expect(freshnessChip(alertOnlyWatch(false), UPDATED_AT)).toBeNull();
  });

  it("stale data shows the delayed chip", () => {
    expect(freshnessChip(fullWatch({ stale: STALE }), UPDATED_AT)).toEqual({
      live: false,
      label: copy.delayedChip(1446),
    });
  });
});

/* ------------------------------------------------------------------ */
/* #7/#69 staleness, #4 approximate share card, #18 CT                 */
/* ------------------------------------------------------------------ */

describe("#7/#69 stale data reads as stale", () => {
  it("shows copy.staleness under the sentence and on the share card", () => {
    const html = render({ watches: [fullWatch({ stale: STALE })] });
    const line = esc(copy.staleness(1446));
    expect(pageOnly(html)).toContain(line);
    expect(shareCard(html)).toContain(line);
  });

  it("fresh data has no Heads up line", () => {
    expect(render()).not.toContain("Heads up");
    expect(staleLineFor(fullWatch().verdict)).toBeNull();
    expect(staleLineFor(alertOnlyWatch().verdict)).toBeNull();
  });

  it("stale data of unknown age still warns, without inventing '0 hours'", () => {
    const v = fullWatch({
      stale: {
        observedH: null,
        forecastH: null,
        staleObserved: true,
        staleForecast: true,
      },
    }).verdict;
    expect(staleLineFor(v)).toBe(copy.stalenessUnknown);
  });
});

describe("#4 approximate pins on the share card", () => {
  it("carries the town-center line on the card", () => {
    const pin = { ...HOME, approximate: true };
    const html = render({ pins: [pin] });
    expect(shareCard(html)).toContain(
      esc(`${copy.approximateTag}: ${copy.approximateShare}`),
    );
  });

  it("an exact address carries no such line", () => {
    expect(shareCard(render())).not.toContain(copy.approximateTag);
  });
});

describe("#18 times name their zone", () => {
  it("fmtTime ends in CT", () => {
    expect(fmtTime("2026-10-23T18:30:00Z")).toBe("1:30 PM CT");
    expect(fmtTime(Date.parse("2026-01-15T18:30:00Z"))).toBe("12:30 PM CT");
  });

  it("the share card footer ends in CT", () => {
    expect(shareStamp(new Date("2026-10-23T19:09:00Z"))).toBe("Oct 23, 2:09 PM CT");
    expect(shareCard(render())).toMatch(/public federal data · [A-Z][a-z]{2} \d+, \d+:\d{2} [AP]M CT/);
  });
});

/* ------------------------------------------------------------------ */
/* #14 one rounded margin                                              */
/* ------------------------------------------------------------------ */

describe("#14 sentence and gloss share one whole-foot number", () => {
  it("3.6 ft and 4.1 ft of water both read '4 ft' with the same picture", () => {
    const a = glossLineFor(fullWatch({ band: "LIKELY", marginFt: -3.6 }).verdict);
    const b = glossLineFor(fullWatch({ band: "LIKELY", marginFt: -4.1 }).verdict);
    expect(a).toBe(`That could put about 4 ft of water here, ${heightGloss(4)}.`);
    expect(a).toBe(b);
  });

  it("the gloss number always equals the sentence number", () => {
    for (let m = 0.5; m <= 70; m += 0.05) {
      const band = m <= 3.5 ? "BORDERLINE" : "UNLIKELY";
      const v = fullWatch({ band, marginFt: m }).verdict;
      const gloss = glossLineFor(v);
      if (gloss === null) continue;
      const sentence = verdictSentence({
        pinName: "Home",
        verdict: v,
        gauge: { name: "Pearl River at Jackson", forecastIssued: null },
        now: NOW,
      });
      const glossFt = gloss.match(/That (\d+) ft gap/)?.[1];
      const sentenceFt = sentence.match(/about (\d+) ft/)?.[1];
      expect(glossFt).toBe(String(shownFeet(m)));
      expect(sentenceFt).toBe(glossFt);
      // The picture matches the number shown, not the raw margin.
      expect(gloss).toContain(heightGloss(shownFeet(m)) as string);
    }
  });

  it("no picture for a sub-half-foot margin", () => {
    expect(glossLineFor(fullWatch({ band: "LIKELY", marginFt: 0.3 }).verdict)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* #80 NextSteps                                                       */
/* ------------------------------------------------------------------ */

const ALERT: FloodAlert = {
  event: "Flood Warning",
  headline: null,
  severity: "Moderate",
  areaDesc: "Hinds, MS",
  expires: null,
};

describe("#80 NextSteps card", () => {
  it.each([
    ["FULL LIKELY", fullWatch({ band: "LIKELY", marginFt: -2 }), true],
    ["FULL BORDERLINE", fullWatch({ band: "BORDERLINE", marginFt: 2 }), true],
    ["FULL UNLIKELY", fullWatch(), false],
    ["FULL UNLIKELY + alert", fullWatch({ alerts: [ALERT] }), true],
    ["CATEGORY none", categoryWatch("none"), false],
    ["CATEGORY missing", categoryWatch(null), false],
    ["CATEGORY action", categoryWatch("action"), false],
    ["CATEGORY minor", categoryWatch("minor"), true],
    ["CATEGORY moderate", categoryWatch("moderate"), true],
    ["CATEGORY major", categoryWatch("major"), true],
    ["ALERT-ONLY quiet", alertOnlyWatch(), false],
    ["ALERT-ONLY + alert", alertOnlyWatch(true, [ALERT]), true],
  ])("%s → %s", (_name, w, expected) => {
    expect(needsNextSteps(w)).toBe(expected);
  });

  it("renders three lines and the three official links", () => {
    const html = renderToStaticMarkup(<NextSteps />);
    for (const line of copy.nextSteps) expect(html).toContain(esc(line));
    expect(NEXT_STEP_LINKS.map((l) => l.href)).toEqual([
      "https://www.weather.gov/jan/",
      "https://www.msema.org/",
      "https://www.mdottraffic.com/",
    ]);
    for (const l of NEXT_STEP_LINKS) expect(html).toContain(`href="${l.href}"`);
  });

  it("appears on /watch only when there's something to act on", () => {
    expect(render({ watches: [fullWatch({ band: "LIKELY", marginFt: -2 })] })).toContain(
      'data-testid="next-steps"',
    );
    expect(render()).not.toContain('data-testid="next-steps"');
  });
});

/* ------------------------------------------------------------------ */
/* #11 / #44 AlertStrip                                                */
/* ------------------------------------------------------------------ */

describe("#11/#44 AlertStrip", () => {
  const A = { ...ALERT, event: "Flash Flood Warning", areaDesc: "Kane, UT" };
  const B = { ...ALERT, event: "Flood Warning", areaDesc: "Jones, SD" };
  const C = { ...ALERT, event: "Flood Watch", areaDesc: "Yazoo, MS" };

  it("dedupes identical alerts (same event and area) before slicing", () => {
    expect(dedupeAlerts([A, A, B, { ...A }, C])).toEqual([A, B, C]);
    const html = renderToStaticMarkup(<AlertStrip alerts={[A, { ...A }, B, A, C]} />);
    expect(html.match(/role="status"/g)).toHaveLength(3);
    expect(html).toContain("Flood Watch");
  });

  it("keeps different areas for the same event", () => {
    const A2 = { ...A, areaDesc: "Garfield, UT" };
    expect(dedupeAlerts([A, A2])).toHaveLength(2);
  });

  it("area text uses the full-contrast token", () => {
    const html = renderToStaticMarkup(<AlertStrip alerts={[A]} />);
    expect(html).toContain('<span class="text-fg"> · Kane, UT</span>');
    expect(html).not.toContain("text-dim");
  });
});

/* ------------------------------------------------------------------ */
/* #16/#30 clipboard fallback                                          */
/* ------------------------------------------------------------------ */

describe("#16/#30 Copy watch link", () => {
  const URL_ = "https://crestwatch.example/watch?wl=abc";

  it("copies and confirms when the clipboard works", async () => {
    const onCopied = vi.fn();
    const prompt = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    await copyWithFallback(URL_, onCopied, { clipboard: { writeText }, prompt });
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(onCopied).toHaveBeenCalledOnce();
    expect(prompt).not.toHaveBeenCalled();
  });

  it("falls back to a prompt with the URL when the write is refused", async () => {
    const onCopied = vi.fn();
    const prompt = vi.fn();
    const writeText = vi
      .fn()
      .mockRejectedValue(new DOMException("Write permission denied.", "NotAllowedError"));
    await expect(
      copyWithFallback(URL_, onCopied, { clipboard: { writeText }, prompt }),
    ).resolves.toBeUndefined();
    expect(prompt).toHaveBeenCalledWith(copy.copyLinkPrompt, URL_);
    expect(onCopied).not.toHaveBeenCalled();
  });

  it("falls back when there is no clipboard at all (plain http)", async () => {
    const prompt = vi.fn();
    await copyWithFallback(URL_, vi.fn(), { clipboard: undefined, prompt });
    expect(prompt).toHaveBeenCalledWith(copy.copyLinkPrompt, URL_);
  });

  it("never rejects, even if the prompt itself throws", async () => {
    await expect(
      copyWithFallback(URL_, vi.fn(), {
        clipboard: undefined,
        prompt: () => {
          throw new Error("blocked");
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("keeps the button name the e2e test clicks", () => {
    expect(render()).toMatch(/<button[^>]*><span aria-live="polite">Copy watch link<\/span><\/button>/);
  });
});

/* ------------------------------------------------------------------ */
/* #12 Save to this device                                             */
/* ------------------------------------------------------------------ */

describe("#12 shared and example links", () => {
  it("hide 'Your places →' and offer Save to this device", () => {
    for (const q of [`wl=${encodeWatchLink([HOME])}`, `wl=${encodeWatchLink([HOME])}&ex=1`]) {
      const html = render({}, q);
      expect(html).toContain(`>${copy.saveLinkedPins}</button>`);
      expect(html).not.toContain(`${esc(copy.placesTitle)} →`);
    }
  });

  it("own places keep the 'Your places →' link and no Save button", () => {
    const html = render();
    expect(html).toContain(`${esc(copy.placesTitle)} →`);
    expect(html).not.toContain(copy.saveLinkedPins);
  });

  it("a place setup couldn't save says why and offers no Save button", () => {
    const html = render({}, `wl=${encodeWatchLink([HOME])}&nosave=1`);
    // The verdict still shows.
    expect(html).toMatch(/stays dry by about 38 ft/);
    expect(html).toContain(esc(copy.storageBlocked));
    expect(html).not.toContain("viewing a shared watch link");
    expect(html).not.toContain(copy.saveLinkedPins);
    // Your places would be empty on this browser.
    expect(html).not.toContain(`${esc(copy.placesTitle)} →`);
  });

  it("nosave means nothing without a watch link", () => {
    const html = render({}, "nosave=1");
    expect(html).not.toContain(esc(copy.storageBlocked));
    expect(html).toContain(`${esc(copy.placesTitle)} →`);
  });
});

describe("#12 saveLinkedPins", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const saved = (): Pin[] => JSON.parse(store.get(STORAGE_KEYS.pins) ?? "[]");
  const linked = (n: number): Pin[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `wl${i}`,
      name: `Spot ${i}`,
      matchedAddress: `${i} MAIN ST, VICKSBURG, MS`,
      lat: 32.35 + i / 100,
      lon: -90.88,
      elevationFt: 200 + i,
    }));

  it("adds linked places with fresh ids", () => {
    expect(saveLinkedPins(linked(2))).toBe(2);
    const pins = saved();
    expect(pins.map((p) => p.name)).toEqual(["Spot 0", "Spot 1"]);
    for (const p of pins) expect(p.id).not.toMatch(/^wl\d$/);
  });

  it("skips a place already saved (same address and spot to 4 decimals)", () => {
    // Already saved at full precision; the link carries 5 decimals.
    store.set(STORAGE_KEYS.pins, JSON.stringify([{ ...HOME }]));
    const fromLink: Pin = {
      ...HOME,
      id: "wl0",
      name: "Grandma's",
      lat: Math.round(HOME.lat * 1e5) / 1e5,
      lon: Math.round(HOME.lon * 1e5) / 1e5,
    };
    expect(saveLinkedPins([fromLink, ...linked(1)])).toBe(1);
    expect(saved().map((p) => p.name)).toEqual(["Home", "Spot 0"]);
  });

  it("never replaces an earlier saved link pin that also had id wl0", () => {
    saveLinkedPins(linked(1));
    saveLinkedPins([{ ...linked(2)[1], id: "wl0" }]);
    expect(saved().map((p) => p.name)).toEqual(["Spot 0", "Spot 1"]);
  });

  it("stops at MAX_PINS", () => {
    store.set(
      STORAGE_KEYS.pins,
      JSON.stringify(
        linked(MAX_PINS - 1).map((p, i) => ({
          ...p,
          id: `own${i}`,
          matchedAddress: `OWN ${i}`,
        })),
      ),
    );
    expect(saveLinkedPins(linked(3))).toBe(1);
    expect(saved()).toHaveLength(MAX_PINS);
  });

  it("counts nothing when this browser won't store anything", () => {
    const setItem = vi.fn(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem,
      removeItem: (k: string) => void store.delete(k),
    });
    expect(saveLinkedPins(linked(2))).toBe(0);
    expect(saved()).toEqual([]);
    // Gives up after the first refused write.
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});
