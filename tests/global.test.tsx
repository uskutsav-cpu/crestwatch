import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { Glossary } from "@/components/Glossary";
import { ButtonPrimary } from "@/components/ui";
import { isNavActive } from "@/components/NavLinks";

const root = join(__dirname, "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const titleOf = (rel: string) =>
  src(rel).match(/export const metadata[^=]*=\s*\{[^}]*?title:\s*"([^"]+)"/)?.[1];

/** Every .tsx file under a repo folder, as repo-relative paths. */
const tsxUnder = (dir: string): string[] =>
  readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => relative(root, join(root, dir, f)));

type TitleKey =
  | "pageTitleWatch"
  | "pageTitlePlaces"
  | "pageTitleWhy"
  | "pageTitleReplay";

describe("page titles (#36, #17)", () => {
  const TITLES: Array<[string, TitleKey, string]> = [
    ["app/watch/page.tsx", "pageTitleWatch", "Watch · CrestWatch"],
    ["app/places/page.tsx", "pageTitlePlaces", "Your places · CrestWatch"],
    ["app/why/page.tsx", "pageTitleWhy", "Why this verdict · CrestWatch"],
    ["app/replay/page.tsx", "pageTitleReplay", "Replay a real flood · CrestWatch"],
  ];

  it("gives each screen its own title, from the copy deck", () => {
    for (const [file, key, title] of TITLES) {
      expect(src(file), file).toMatch(
        new RegExp(`export const metadata[^=]*=\\s*\\{[^}]*?title:\\s*copy\\.${key}\\b`),
      );
      expect(copy[key], key).toBe(title);
    }
  });

  it("matches the tab title to the heading on Places and Replay", () => {
    expect(copy.pageTitlePlaces).toBe(`${copy.placesTitle} · ${copy.appName}`);
    expect(copy.pageTitleReplay).toBe(`${copy.replayTitle} · ${copy.appName}`);
  });

  it("keeps every title unique, About included", () => {
    const all = [
      ...TITLES.map(([, key]) => copy[key]),
      titleOf("app/about/page.tsx"),
      titleOf("app/layout.tsx"),
    ];
    expect(all).not.toContain(undefined);
    expect(new Set(all).size).toBe(all.length);
  });

  it("leaves Setup on the layout default, with no template to double titles", () => {
    expect(src("app/page.tsx")).not.toMatch(/metadata/);
    expect(titleOf("app/layout.tsx")).toBe("CrestWatch");
    expect(src("app/layout.tsx")).not.toMatch(/template/);
  });
});

describe("privacy line", () => {
  it("shows once per page, from the site footer only", () => {
    expect(src("app/layout.tsx")).toContain("<Footer />");
    expect(src("components/Footer.tsx")).toContain("copy.privacyFooter");
    expect(src("app/page.tsx")).not.toContain("privacyFooter");
  });
});

describe("nav pill", () => {
  it("lights the matching link", () => {
    expect(isNavActive("/watch", "/watch")).toBe(true);
    expect(isNavActive("/places", "/places")).toBe(true);
    expect(isNavActive("/places", "/watch")).toBe(false);
  });

  it("counts /why as Watch", () => {
    expect(isNavActive("/why", "/watch")).toBe(true);
    expect(isNavActive("/why", "/places")).toBe(false);
    expect(isNavActive("/why", "/replay")).toBe(false);
  });

  it("lights nothing on Setup", () => {
    for (const href of ["/watch", "/places", "/replay", "/about"]) {
      expect(isNavActive("/", href)).toBe(false);
      expect(isNavActive(null, href)).toBe(false);
    }
  });
});

describe("focus outline (#37)", () => {
  const FILES = [
    "components/ui.tsx",
    "components/NavLinks.tsx",
    "components/Header.tsx",
    "components/ThemeToggle.tsx",
    "components/Glossary.tsx",
    "components/replay/ReplayClient.tsx",
  ];

  it("uses a solid fg outline and never outline-none", () => {
    for (const file of FILES) {
      const s = src(file);
      expect(s, file).not.toMatch(/outline-none/);
      expect(s, file).not.toMatch(/focus-visible:ring-/);
      expect(s, file).toContain(
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
      );
    }
  });

  it("never swaps the outline for a faint ring anywhere in the app", () => {
    const files = [...tsxUnder("components"), ...tsxUnder("app")];
    expect(files).toContain("components/replay/ReplayClient.tsx");
    for (const file of files) {
      const s = src(file);
      expect(s, file).not.toMatch(/focus-visible:outline-none/);
      expect(s, file).not.toMatch(/focus-visible:ring-/);
    }
  });

  it("keeps the ghost button's resting ring", () => {
    expect(src("components/ui.tsx")).toMatch(/ring-1 ring-inset ring-line/);
  });
});

describe("disabled primary button (#47)", () => {
  it("fades and shows a not-allowed cursor", () => {
    const html = renderToStaticMarkup(
      <ButtonPrimary disabled>Watch this place</ButtonPrimary>,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("disabled:opacity-50");
    expect(html).toContain("disabled:cursor-not-allowed");
  });
});

describe("glossary (#78)", () => {
  const html = renderToStaticMarkup(<Glossary />);

  it("is a closed native disclosure with no client JS", () => {
    expect(src("components/Glossary.tsx")).not.toMatch(/use client/);
    expect(html).toMatch(/^<details/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain(`>${copy.glossarySummary}</summary>`);
    expect(copy.glossarySummary).toBe("What do these words mean?");
  });

  it("has 6 to 8 entries, each rendered as a term and its meaning", () => {
    const n = copy.glossary.length;
    expect(n).toBeGreaterThanOrEqual(6);
    expect(n).toBeLessThanOrEqual(8);
    expect(html.match(/<dt/g)).toHaveLength(n);
    expect(html.match(/<dd/g)).toHaveLength(n);
  });

  it("covers the words the screens use", () => {
    const all = copy.glossary
      .map(({ term, text }) => `${term} ${text}`)
      .join(" ")
      .toLowerCase();
    for (const word of [
      "river gauge",
      "stage",
      "gauge zero",
      "height above sea level",
      "flood stage",
      "crest",
      "forecast",
      "full answer",
      "street address",
      "flood-stage only",
      "alerts only",
    ]) {
      expect(all, word).toContain(word);
    }
    // FULL shows for approximate pins too, so it must never read as house-level.
    expect(all).not.toContain("house-level");
    expect(copy.glossary[1].text).toMatch(/^How deep the river is at the gauge/);
  });

  it("follows the copy rules", () => {
    for (const { term, text } of copy.glossary) {
      const s = `${term} ${text}`;
      expect(s, term).not.toMatch(/[—–!]/);
      expect(s, term).not.toMatch(/catastrophic|danger|panic|guaranteed|exact/i);
      expect(s, term).not.toMatch(/\bAI\b/);
      // A sentence ends at . or ? followed by a space or the end.
      const sentences = text.match(/[.?](\s|$)/g) ?? [];
      expect(text, term).toMatch(/\.$/);
      expect(sentences.length, term).toBeGreaterThanOrEqual(1);
      expect(sentences.length, term).toBeLessThanOrEqual(2);
    }
  });

  it("sits below the main client component on Watch and Why", () => {
    for (const [file, client] of [
      ["app/watch/page.tsx", "<WatchClient />"],
      ["app/why/page.tsx", "<WhyClient />"],
    ]) {
      const s = src(file);
      expect(s.indexOf("<Glossary />"), file).toBeGreaterThan(s.indexOf(client));
      expect(s.indexOf(client), file).toBeGreaterThan(-1);
      // Inside the Suspense boundary, so the prerender never paints it alone.
      expect(s.indexOf("<Suspense>"), file).toBeGreaterThan(-1);
      expect(s.indexOf("<Suspense>"), file).toBeLessThan(s.indexOf(client));
      expect(s.indexOf("<Glossary />"), file).toBeLessThan(s.indexOf("</Suspense>"));
    }
  });
});
