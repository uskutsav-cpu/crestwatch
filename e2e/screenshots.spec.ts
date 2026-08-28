import { expect, test } from "@playwright/test";

/**
 * Screenshot script (T13) — captures every screen for the README, the
 * demo storyboard, and the submission form. Run with:
 *   npx playwright test e2e/screenshots.spec.ts
 * Images land in docs/screenshots/.
 */

const PINS = [
  {
    id: "phome",
    name: "Home",
    matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
    lat: 32.300441828077,
    lon: -90.188419699815,
    elevationFt: 275.5,
  },
  {
    id: "pgrandma",
    name: "Grandma",
    matchedAddress: "211 E BROADWAY ST, YAZOO CITY, MS",
    lat: 32.846783396348,
    lon: -90.412396914911,
    elevationFt: 124.3,
  },
  {
    id: "proad",
    name: "The farm road",
    matchedAddress: "1400 WASHINGTON ST, VICKSBURG, MS",
    lat: 32.349033641592,
    lon: -90.882368787159,
    elevationFt: 193.1,
  },
];

const DIR = "docs/screenshots";

test.describe("screenshots", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("capture every screen", async ({ page }) => {
    await page.addInitScript((pins) => {
      localStorage.setItem("crestwatch.pins", JSON.stringify(pins));
    }, PINS);

    const shots: Array<[string, string, RegExp | string]> = [
      ["01-setup", "/", "Will the water reach your house?"],
      ["02-watch", "/watch?pin=phome", /stays dry by about/],
      ["03-places", "/places", "Your places"],
      ["04-why", "/why?pin=phome", "No magic. Here's the math."],
      ["05-replay", "/replay", "Replay a real flood"],
      ["06-about", "/about", "About CrestWatch"],
    ];

    for (const [name, path, marker] of shots) {
      await page.goto(path);
      await expect(page.getByText(marker).first()).toBeVisible({
        timeout: 20_000,
      });
      await page.waitForTimeout(600); // let the water layer settle
      await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
    }

    // Light mode of the money screen, for contrast checks.
    await page.goto("/watch?pin=phome");
    await expect(page.getByText(/stays dry by about/).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.evaluate(() => {
      localStorage.setItem("crestwatch.theme", "light");
      document.documentElement.setAttribute("data-theme", "light");
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/07-watch-light.png`, fullPage: true });
  });
});
