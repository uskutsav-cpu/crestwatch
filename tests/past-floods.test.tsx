/**
 * Package history: the PastFloods block, rendered to static HTML.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { PastFloods, type PastFloodsProps } from "@/components/watch/PastFloods";
import type { HistoricCrest } from "@/lib/gauges";

const NOW = "2026-10-23T17:00:00Z";

const CRESTS: HistoricCrest[] = [
  { stageFt: 57.1, time: "2011-05-19T00:00:00Z" },
  { stageFt: 56.2, time: "1927-05-04T00:00:00Z" },
  { stageFt: 53.2, time: "1937-02-21T00:00:00Z" },
  { stageFt: 51.6, time: "1973-05-14T00:00:00Z" },
  { stageFt: 50.8, time: "1983-05-30T00:00:00Z" },
  { stageFt: 50.3, time: "2019-03-20T00:00:00Z" },
  { stageFt: 58.3, time: "1913-04-01T00:00:00Z", oldDatum: true },
];

const base: PastFloodsProps = {
  pinName: "Levee St",
  approximate: false,
  pinElevationFt: 92.7,
  gaugeZeroFt: 46.22,
  gaugeName: "Mississippi River at Vicksburg",
  historicCrests: CRESTS,
  now: NOW,
};

const render = (over: Partial<PastFloodsProps> = {}) =>
  renderToStaticMarkup(<PastFloods {...base} {...over} />);

/** Visible text, entities decoded, whitespace squashed. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

describe("PastFloods", () => {
  it("renders nothing without a gauge zero or a usable crest", () => {
    expect(render({ gaugeZeroFt: null })).toBe("");
    expect(render({ historicCrests: [] })).toBe("");
    expect(
      render({ historicCrests: [{ stageFt: 50, time: "2011-05-19T00:00:00Z", oldDatum: true }] }),
    ).toBe("");
  });

  it("full card: title, the summary line, the list, the caveat and the source", () => {
    const html = render();
    const t = text(html);
    expect(html).toContain('data-testid="past-floods"');
    expect(html).toMatch(/<h2[^>]*>Past floods here<\/h2>/);
    expect(t).toContain(
      "All 5 of the highest crests CrestWatch can compare here would have reached Levee St.",
    );
    expect(t).toContain(copy.pastFloodsIntro);
    expect(html.match(/data-testid="past-flood-row"/g)).toHaveLength(6);
    expect(t).toContain("May 2011 57.1 ft on the gauge about 11 ft of water here");
    expect(t).toContain(`March 2019 50.3 ft on the gauge about 4 ft of water here ${copy.pastFloodsRecent}`);
    expect(t).toContain(copy.pastFloodsLeftOut(1));
    expect(t).toContain(copy.pastFloodsCaveat);
    expect(t).toContain(copy.pastFloodsSource("Mississippi River at Vicksburg"));
    // The old-datum crest is never shown.
    expect(t).not.toContain("58.3");
    expect(t).not.toContain("1913");
    expect(t).not.toContain(copy.approximateTag);
  });

  it("none reached: says a bigger flood could still come", () => {
    const t = text(render({ pinName: "Museum", pinElevationFt: 117 }));
    expect(t).toContain("would have reached Museum.");
    expect(t).toContain(copy.pastFloodsBigger);
    expect(t).toContain("stayed about 14 ft below");
  });

  it("a crest inside the borderline band reads too close to call, not a miss", () => {
    // 1937 (53.2) puts water at 99.42: 2.58 ft below a pin at 102, which
    // the live verdict would call too close to call.
    const t = text(render({ pinName: "Home", pinElevationFt: 102 }));
    expect(t).toContain(
      "2 of the 5 highest crests CrestWatch can compare here would have reached Home. One more would have been too close to call.",
    );
  });

  it("an approximate pin: the tag, 'this spot', and no house-level words", () => {
    const t = text(render({ pinName: "Grandma", approximate: true }));
    expect(t).toContain(copy.approximateTag);
    expect(t).toContain("would have reached this spot.");
    expect(t).toContain(copy.pastFloodsIntroSpot);
    expect(t).not.toContain(copy.pastFloodsIntro);
    expect(t).not.toContain("Grandma");
    expect(t).not.toMatch(/your ground|house/i);
  });

  it("compact: the summary line is a native <summary>, the list opens under it", () => {
    const html = render({ compact: true });
    expect(html.startsWith("<details")).toBe(true);
    const summary = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "";
    const s = text(summary);
    expect(s).toContain(copy.pastFloodsTitle);
    expect(s).toContain("would have reached Levee St.");
    expect(s).toContain(copy.pastFloodsShow);
    // The rows and caveat sit inside the <details>, after the <summary>.
    const after = html.split("</summary>")[1];
    expect(after).toContain('data-testid="past-flood-row"');
    expect(text(after)).toContain(copy.pastFloodsCaveat);
    expect(html).not.toContain("<h2");
  });

  it("compact keeps the approximate tag and the none-reached line in the summary", () => {
    const html = render({ compact: true, approximate: true, pinElevationFt: 117 });
    const s = text(html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "");
    expect(s).toContain(copy.approximateTag);
    expect(s).toContain("this spot");
    expect(s).toContain(copy.pastFloodsBigger);
  });

  it("an empty gauge name falls back to 'the nearest gauge'", () => {
    const t = text(render({ gaugeName: "  " }));
    expect(t).toContain(copy.pastFloodsSource(copy.verdictGaugeFallback));
  });
});
