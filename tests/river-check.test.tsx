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
    const v = riverView(river({ observedAt: new Date(NOW - 7 * H).toISOString() }), NOW);
    expect(v.chip).toEqual({ band: "BORDERLINE", label: copy.delayedChip(7) });
    expect(v.trend).toBeNull();
    // The chip already says it; the second line doesn't repeat it.
    expect(v.detail).toBe("flood stage 43 ft · expected high 15.4 ft tomorrow");
    // Just inside the window it's still live.
    const ok = riverView(river({ observedAt: new Date(NOW - RIVER_STALE_H * H + 60_000).toISOString() }), NOW);
    expect(ok.chip.band).toBe("UNLIKELY");
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

  it("is never green unless the reading is fresh and nothing reaches action stage", () => {
    const levels = [null, "none", "action", "minor", "moderate", "major"] as const;
    for (const category of levels) {
      for (const forecastCategory of levels) {
        for (const ageH of [1, 8]) {
          const v = riverView(
            river({
              category,
              forecastCategory,
              observedAt: new Date(NOW - ageH * H).toISOString(),
            }),
            NOW,
          );
          const calm = category === "none" && forecastCategory === "none" && ageH === 1;
          expect(v.chip.band === "UNLIKELY", `${category}/${forecastCategory}/${ageH}h`).toBe(calm);
        }
      }
    }
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
    expect(html).toContain(copy.riversSource(fmtTime("2026-10-23T18:45:00.000Z")));
    expect(copy.riversSource(fmtTime("2026-10-23T18:45:00.000Z"))).toBe(
      "River data from NOAA, checked 1:45 PM CT.",
    );
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
