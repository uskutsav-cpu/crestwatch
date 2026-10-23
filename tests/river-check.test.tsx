/**
 * Package rivers: the home page "Right now on our rivers" strip. Row
 * logic is checked directly (riverView); each screen state is rendered to
 * static HTML through RiverCheckView, so no browser is needed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { fmtTime } from "@/lib/time";
import {
  RIVER_STALE_H,
  RiverCheck,
  RiverCheckView,
  loadRivers,
  readingsAsOf,
  riverView,
  type RiverPhase,
} from "@/components/home/RiverCheck";
import type { RiverNow } from "@/lib/rivers";

const H = 3_600_000;
/** Fri Oct 23 2026, 2 PM CT. */
const NOW = Date.parse("2026-10-23T19:00:00Z");

const river = (over: Partial<RiverNow> = {}): RiverNow => ({
  lid: "VCKM6",
  name: "Mississippi River at Vicksburg",
  stageFt: 15,
  observedAt: new Date(NOW - 1 * H).toISOString(),
  trend: "falling",
  floodStageFt: 43,
  category: "none",
  // This morning's forecast, 9 AM CT.
  forecastIssued: new Date(NOW - 5 * H).toISOString(),
  // Sat Oct 24, 1 PM CT.
  forecastHigh: { stageFt: 15.4, t: "2026-10-24T18:00:00.000Z" },
  forecastCategory: "none",
  ...over,
});

describe("riverView", () => {
  it("a fresh reading below flood stage, forecast below it too, is the one green chip", () => {
    const v = riverView(river(), NOW);
    expect(v).toEqual({
      stage: "15.0",
      trend: "falling",
      chip: { band: "UNLIKELY", label: copy.chipCategoryNone },
      detail: "flood stage 43 ft · expected high 15.4 ft tomorrow",
    });
  });

  it("names the day of the expected high in Central time", () => {
    const mon = riverView(
      river({ forecastHigh: { stageFt: 17.2, t: "2026-10-26T17:00:00.000Z" } }),
      NOW,
    );
    expect(mon.detail).toBe("flood stage 43 ft · expected high 17.2 ft Monday");
  });

  it("a forecast that barely moves says so instead of calling it a high", () => {
    const flat = riverView(river({ forecastHigh: { stageFt: 15.2, t: "2026-10-24T18:00:00.000Z" } }), NOW);
    expect(flat.detail).toBe(`flood stage 43 ft · ${copy.riversNoBigRise}`);
    const falling = riverView(river({ forecastHigh: { stageFt: 14.9, t: "2026-10-24T00:00:00.000Z" } }), NOW);
    expect(falling.detail).toBe(`flood stage 43 ft · ${copy.riversNoBigRise}`);
  });

  it("an old reading never wears green, and shows no trend", () => {
    const v = riverView(river({ observedAt: new Date(NOW - 4 * H).toISOString() }), NOW);
    expect(v.chip).toEqual({ band: "BORDERLINE", label: copy.delayedChip(4) });
    expect(v.trend).toBeNull();
    // The chip already says it; the second line doesn't repeat it.
    expect(v.detail).toBe("flood stage 43 ft · expected high 15.4 ft tomorrow");
  });

  it("goes stale an hour after the rest of the app does: at 3 hours", () => {
    expect(RIVER_STALE_H).toBe(3);
    const inside = riverView(river({ observedAt: new Date(NOW - 3 * H + 60_000).toISOString() }), NOW);
    expect(inside.chip).toEqual({ band: "UNLIKELY", label: copy.chipCategoryNone });
    expect(inside.trend).toBe("falling");
    const past = riverView(river({ observedAt: new Date(NOW - 3 * H - 60_000).toISOString() }), NOW);
    expect(past.chip).toEqual({ band: "BORDERLINE", label: copy.delayedChip(3) });
    expect(past.trend).toBeNull();
    // A 5.9-hour-old morning reading is no longer "right now".
    const morning = riverView(river({ trend: "rising", observedAt: new Date(NOW - 5.9 * H).toISOString() }), NOW);
    expect(morning.chip).toEqual({ band: "BORDERLINE", label: copy.delayedChip(6) });
    expect(morning.trend).toBeNull();
  });

  it("an old reading of flooding keeps its flooding chip and says how old it is", () => {
    const v = riverView(
      river({
        stageFt: 47,
        category: "moderate",
        observedAt: new Date(NOW - 72 * H).toISOString(),
        forecastHigh: null,
        forecastCategory: null,
      }),
      NOW,
    );
    expect(v.chip).toEqual({ band: "LIKELY", label: copy.chipCategoryModerate });
    expect(v.detail).toBe(`${copy.delayedChip(72)} · flood stage 43 ft`);
    expect(copy.delayedChip(72)).toBe("data delayed 3 days");
  });

  it("an unreadable reading time counts as old", () => {
    const v = riverView(river({ observedAt: "garbage" }), NOW);
    expect(v.chip).toEqual({ band: "BORDERLINE", label: copy.riversReadingUnknown });
    expect(v.trend).toBeNull();
  });

  it("a chip raised by the forecast always names the high, even a small step over flood stage", () => {
    // 42.9 ft now (action), forecast 43.1 ft (minor): 0.2 ft is under the
    // small-bump cutoff, but it's the step that crosses flood stage.
    const v = riverView(
      river({
        stageFt: 42.9,
        category: "action",
        forecastHigh: { stageFt: 43.1, t: "2026-10-24T18:00:00.000Z" },
        forecastCategory: "minor",
      }),
      NOW,
    );
    expect(v.chip).toEqual({ band: "BORDERLINE", label: "minor flooding forecast" });
    expect(v.detail).toBe("flood stage 43 ft · expected high 43.1 ft tomorrow");
    expect(v.detail).not.toContain(copy.riversNoBigRise);
    // Without a crossing, the same small bump is still "no big rise".
    const flat = riverView(
      river({
        stageFt: 43.5,
        category: "minor",
        forecastHigh: { stageFt: 43.6, t: "2026-10-24T18:00:00.000Z" },
        forecastCategory: "minor",
      }),
      NOW,
    );
    expect(flat.chip).toEqual({ band: "BORDERLINE", label: copy.chipCategoryMinor });
    expect(flat.detail).toBe(`flood stage 43 ft · ${copy.riversNoBigRise}`);
  });

  it("an old forecast is never a green light, and its high isn't shown", () => {
    // Issued 4 days ago, still 'ahead' because Mississippi forecasts run weeks out.
    const old = riverView(
      river({
        forecastIssued: new Date(NOW - 96 * H).toISOString(),
        forecastHigh: { stageFt: 15.1, t: "2026-10-24T18:00:00.000Z" },
      }),
      NOW,
    );
    expect(old.chip).toEqual({ band: "BORDERLINE", label: copy.riversForecastOld });
    expect(old.trend).toBe("falling");
    // The chip says it; the second line doesn't repeat it, and says nothing reassuring.
    expect(old.detail).toBe("flood stage 43 ft");
    // Just inside a day it's current; just past it, it's old.
    const day = (h: number) =>
      riverView(river({ forecastIssued: new Date(NOW - h * H).toISOString() }), NOW).chip.band;
    expect(day(24 - 1 / 60)).toBe("UNLIKELY");
    expect(day(24 + 1 / 60)).toBe("BORDERLINE");
    // A missing or unreadable issue time counts as old.
    for (const forecastIssued of [null, "garbage"]) {
      expect(riverView(river({ forecastIssued }), NOW).chip).toEqual({
        band: "BORDERLINE",
        label: copy.riversForecastOld,
      });
    }
  });

  it("an old forecast that shows flooding still raises the chip", () => {
    const v = riverView(
      river({
        forecastIssued: new Date(NOW - 96 * H).toISOString(),
        forecastHigh: { stageFt: 47, t: "2026-10-26T17:00:00.000Z" },
        forecastCategory: "moderate",
      }),
      NOW,
    );
    expect(v.chip).toEqual({ band: "LIKELY", label: "moderate flooding forecast" });
    expect(v.detail).toBe(`flood stage 43 ft · ${copy.riversForecastOld}`);
    // Flooding now, old forecast: the chip keeps the reading's flooding.
    const now = riverView(
      river({
        stageFt: 44,
        category: "minor",
        forecastIssued: null,
        forecastHigh: { stageFt: 42, t: "2026-10-24T18:00:00.000Z" },
        forecastCategory: "action",
      }),
      NOW,
    );
    expect(now.chip).toEqual({ band: "BORDERLINE", label: copy.chipCategoryMinor });
    expect(now.detail).toBe(`flood stage 43 ft · ${copy.riversForecastOld}`);
  });

  it("an old reading and an old forecast each say so once", () => {
    const v = riverView(
      river({
        observedAt: new Date(NOW - 5 * H).toISOString(),
        forecastIssued: new Date(NOW - 50 * H).toISOString(),
      }),
      NOW,
    );
    expect(v.chip).toEqual({ band: "BORDERLINE", label: copy.delayedChip(5) });
    expect(v.detail).toBe(`flood stage 43 ft · ${copy.riversForecastOld}`);
  });

  it("an old forecast with nothing left ahead changes nothing", () => {
    const v = riverView(
      river({ forecastIssued: new Date(NOW - 96 * H).toISOString(), forecastHigh: null, forecastCategory: null }),
      NOW,
    );
    expect(v.chip).toEqual({ band: "UNLIKELY", label: copy.chipCategoryNone });
    expect(v.detail).toBe("flood stage 43 ft");
  });

  it("a forecast that reaches flood stage outranks a calm reading", () => {
    const minor = riverView(
      river({ forecastHigh: { stageFt: 44, t: "2026-10-26T17:00:00.000Z" }, forecastCategory: "minor" }),
      NOW,
    );
    expect(minor.chip).toEqual({ band: "BORDERLINE", label: "minor flooding forecast" });
    expect(minor.detail).toBe("flood stage 43 ft · expected high 44.0 ft Monday");
    const major = riverView(
      river({ forecastHigh: { stageFt: 51, t: "2026-10-26T17:00:00.000Z" }, forecastCategory: "major" }),
      NOW,
    );
    expect(major.chip).toEqual({ band: "LIKELY", label: "major flooding forecast" });
    const action = riverView(
      river({ forecastHigh: { stageFt: 36, t: "2026-10-26T17:00:00.000Z" }, forecastCategory: "action" }),
      NOW,
    );
    expect(action.chip).toEqual({ band: "BORDERLINE", label: copy.riversChipNearing });
  });

  it("flooding now outranks a lower forecast", () => {
    const v = riverView(
      river({ stageFt: 44, category: "minor", forecastHigh: { stageFt: 42, t: "2026-10-24T18:00:00.000Z" }, forecastCategory: "action" }),
      NOW,
    );
    expect(v.chip).toEqual({ band: "BORDERLINE", label: copy.chipCategoryMinor });
  });

  it("a forecast high that has already gone by is dropped", () => {
    const v = riverView(
      river({ forecastHigh: { stageFt: 44, t: "2026-10-23T18:00:00.000Z" }, forecastCategory: "minor" }),
      NOW,
    );
    expect(v.chip.band).toBe("UNLIKELY");
    expect(v.detail).toBe("flood stage 43 ft");
  });

  it("no published flood stage is amber 'flood stage unknown', never green", () => {
    const v = riverView(
      river({ floodStageFt: null, category: null, forecastHigh: null, forecastCategory: null }),
      NOW,
    );
    expect(v.chip).toEqual({ band: "BORDERLINE", label: copy.chipCategoryUnknown });
    expect(v.detail).toBeNull();
    // Below action with no minor published, but forecast over action: unknown.
    const above = riverView(
      river({ floodStageFt: null, forecastHigh: { stageFt: 36, t: "2026-10-24T18:00:00.000Z" }, forecastCategory: null }),
      NOW,
    );
    expect(above.chip).toEqual({ band: "BORDERLINE", label: copy.chipCategoryUnknown });
  });

  it("keeps a flood stage that isn't whole feet", () => {
    expect(riverView(river({ floodStageFt: 28.5, forecastHigh: null }), NOW).detail).toBe(
      "flood stage 28.5 ft",
    );
  });

  it("is never green unless reading and forecast are fresh and nothing reaches action stage", () => {
    const levels = [null, "none", "action", "minor", "moderate", "major"] as const;
    for (const category of levels) {
      for (const forecastCategory of levels) {
        for (const ageH of [1, 4]) {
          for (const issuedH of [5, 30, null]) {
            const v = riverView(
              river({
                category,
                forecastCategory,
                observedAt: new Date(NOW - ageH * H).toISOString(),
                forecastIssued: issuedH === null ? null : new Date(NOW - issuedH * H).toISOString(),
              }),
              NOW,
            );
            const calm =
              category === "none" && forecastCategory === "none" && ageH === 1 && issuedH === 5;
            const label = `${category}/${forecastCategory}/${ageH}h/${issuedH}h`;
            expect(v.chip.band === "UNLIKELY", label).toBe(calm);
            // An old forecast never lowers the chip below what it shows.
            const fresh = riverView(river({ category, forecastCategory }), NOW);
            const order = ["UNLIKELY", "BORDERLINE", "LIKELY"];
            expect(order.indexOf(v.chip.band), label).toBeGreaterThanOrEqual(
              order.indexOf(fresh.chip.band),
            );
          }
        }
      }
    }
  });
});

describe("readingsAsOf", () => {
  it("is the time of the oldest reading shown, in Central time", () => {
    const rivers = [
      river({ observedAt: new Date(NOW - 1 * H).toISOString() }),
      river({ lid: "JACM6", observedAt: new Date(NOW - 2 * H).toISOString() }),
    ];
    expect(readingsAsOf(rivers, NOW)).toBe("12:00 PM CT");
  });

  it("names the day when the oldest reading wasn't today", () => {
    const rivers = [river(), river({ lid: "JACM6", observedAt: new Date(NOW - 30 * H).toISOString() })];
    expect(readingsAsOf(rivers, NOW)).toBe("8:00 AM CT on Oct 22");
  });

  it("skips unreadable times, and is null when none can be read", () => {
    expect(readingsAsOf([river({ observedAt: "garbage" }), river()], NOW)).toBe("1:00 PM CT");
    expect(readingsAsOf([river({ observedAt: "garbage" })], NOW)).toBeNull();
    expect(copy.riversSource(null)).toBe("River readings from NOAA.");
  });
});

/* ------------------------------------------------------------------ */

/** Static HTML, minus React's text separators, apostrophes unescaped. */
const render = (phase: RiverPhase) =>
  renderToStaticMarkup(<RiverCheckView phase={phase} onRetry={() => {}} />)
    .replace(/<!-- -->/g, "")
    .replace(/&#x27;/g, "'");

describe("RiverCheckView", () => {
  it("shows a skeleton while loading", () => {
    const html = render({ kind: "loading" });
    expect(html).toContain(`>${copy.riversTitle}</h2>`);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html.match(/<li /g)).toHaveLength(4);
    // The heading names the section.
    const id = html.match(/<h2 id="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${id}"`);
  });

  it("fails quietly: one line and a Check again button", () => {
    const html = render({ kind: "failed", retrying: false });
    expect(html).toContain(copy.riverDataDownLinked);
    expect(html).toMatch(new RegExp(`<button[^>]*min-h-11[^>]*>${copy.refresh}</button>`));
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).not.toContain("<li");
    const retrying = render({ kind: "failed", retrying: true });
    expect(retrying).toContain('aria-disabled="true"');
  });

  it("lists each river with its stage, trend, chip and second line", () => {
    const html = render({
      kind: "ok",
      checkedAt: "2026-10-23T18:45:00.000Z",
      nowMs: NOW,
      rivers: [
        river(),
        river({
          lid: "JACM6",
          name: "Pearl River at Jackson",
          stageFt: 3.21,
          trend: "steady",
          floodStageFt: 28,
          forecastHigh: null,
        }),
      ],
    });
    expect(html.match(/data-testid="river-row"/g)).toHaveLength(2);
    expect(html).toContain("Mississippi River at Vicksburg");
    expect(html).toContain("15.0 ft");
    expect(html).toContain('<span aria-hidden="true">↓</span><span class="sr-only">river falling</span>');
    expect(html).toContain('<span class="sr-only">river steady</span>');
    expect(html).toContain(`>${copy.chipCategoryNone}</span>`);
    expect(html).toContain("flood stage 43 ft · expected high 15.4 ft tomorrow");
    expect(html).toContain("3.2 ft");
    // The footer gives when the readings were taken, not when the server checked.
    expect(html).toContain(`>${copy.riversSource(fmtTime(NOW - 1 * H))}</p>`);
    expect(copy.riversSource(fmtTime(NOW - 1 * H))).toBe(
      "River readings from NOAA, as of 1:00 PM CT.",
    );
    expect(html).not.toContain(fmtTime("2026-10-23T18:45:00.000Z"));
  });

  it("an older row pulls the footer time back to it", () => {
    const html = render({
      kind: "ok",
      checkedAt: "2026-10-23T18:45:00.000Z",
      nowMs: NOW,
      rivers: [river(), river({ lid: "YZOM6", observedAt: new Date(NOW - 4 * H).toISOString() })],
    });
    expect(html).toContain(">River readings from NOAA, as of 10:00 AM CT.</p>");
  });

  it("the live component starts as the skeleton (it fetches only after mount)", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const html = renderToStaticMarkup(<RiverCheck />);
    expect(html).toContain('aria-busy="true"');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("loadRivers", () => {
  const answer = (body: unknown) =>
    (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

  it("returns the rivers and check time from an ok answer", async () => {
    const data = await loadRivers(answer({ ok: true, checkedAt: "2026-10-23T18:45:00Z", rivers: [river()] }));
    expect(data?.rivers).toHaveLength(1);
    expect(data?.checkedAt).toBe("2026-10-23T18:45:00Z");
  });

  it("is null for ok:false, an empty list, bad JSON or no network", async () => {
    expect(await loadRivers(answer({ ok: false, error: "UPSTREAM" }))).toBeNull();
    expect(await loadRivers(answer({ ok: false, error: "RATE_LIMITED" }))).toBeNull();
    expect(await loadRivers(answer({ ok: true, checkedAt: "x", rivers: [] }))).toBeNull();
    expect(
      await loadRivers((async () => new Response("<html>")) as unknown as typeof fetch),
    ).toBeNull();
    expect(
      await loadRivers((async () => {
        throw new TypeError("offline");
      }) as unknown as typeof fetch),
    ).toBeNull();
  });
});

describe("rivers copy and bundle", () => {
  const riverKeys = Object.keys(copy).filter((k) => k.startsWith("rivers"));
  const sample = riverKeys
    .map((k) => {
      const v = (copy as Record<string, unknown>)[k];
      return typeof v === "function" ? (v as (...a: string[]) => string)("X", "Y") : String(v);
    })
    .join("\n");

  it("follows the copy rules", () => {
    expect(riverKeys.length).toBeGreaterThan(5);
    expect(sample).not.toMatch(/[—–!]/);
    expect(sample).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
  });

  it("stays under 1 KB of copy", () => {
    expect(new TextEncoder().encode(sample).length).toBeLessThan(1024);
  });

  it("the client component imports server modules for their types only", () => {
    const src = readFileSync(join(__dirname, "..", "components", "home", "RiverCheck.tsx"), "utf8");
    expect(src.startsWith('"use client";')).toBe(true);
    for (const m of ["@/lib/rivers", "@/lib/surveyor", "@/lib/gauges", "@/lib/test-fetchers"]) {
      const imports = src.match(new RegExp(`^import .* from "${m}";$`, "gm")) ?? [];
      for (const line of imports) expect(line, line).toMatch(/^import type /);
    }
  });
});
