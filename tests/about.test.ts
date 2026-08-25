import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PURPOSE_SENTENCE } from "@/lib/config";

describe("About page (T12)", () => {
  const src = readFileSync(
    join(__dirname, "..", "app", "about", "page.tsx"),
    "utf8",
  );

  it("renders the purpose sentence from the exported constant", () => {
    expect(src).toContain("PURPOSE_SENTENCE");
    expect(PURPOSE_SENTENCE).toContain(
      "CrestWatch turns the government's river forecasts",
    );
    expect(PURPOSE_SENTENCE).toContain("six months");
  });

  it("carries the honesty section and story sources", () => {
    expect(src).toContain("Mounds Landing");
    expect(src).toContain("cnn.com");
    expect(src).toContain("copy.honesty");
  });
});
