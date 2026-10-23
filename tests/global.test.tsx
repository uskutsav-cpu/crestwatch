import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("page titles (#36, #17)", () => {
  const TITLES: Record<string, string> = {
    "app/watch/page.tsx": "Watch · CrestWatch",
    "app/places/page.tsx": "Your places · CrestWatch",
    "app/why/page.tsx": "Why this verdict · CrestWatch",
    "app/replay/page.tsx": "Replay a flood · CrestWatch",
  };

  it("gives each screen its own title", () => {
    for (const [file, title] of Object.entries(TITLES)) {
      expect(titleOf(file), file).toBe(title);
    }
  });

  it("keeps every title unique, About included", () => {
    const all = [
      ...Object.keys(TITLES).map(titleOf),
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
      "house-level answer",
      "flood-stage only",
      "alerts only",
    ]) {
      expect(all, word).toContain(word);
    }
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
    }
  });
});
