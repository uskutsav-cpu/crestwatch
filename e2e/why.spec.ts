import { expect, test } from "@playwright/test";

const PINS = [
  {
    id: "pjackson",
    name: "Home",
    matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
    lat: 32.300441828077,
    lon: -90.188419699815,
    elevationFt: 275.5,
  },
  {
    id: "pyazoo",
    name: "Grandma",
    matchedAddress: "211 E BROADWAY ST, YAZOO CITY, MS",
    lat: 32.846783396348,
    lon: -90.412396914911,
    elevationFt: 124.3,
  },
  {
    id: "pvicksburg",
    name: "The farm road",
    matchedAddress: "1400 WASHINGTON ST, VICKSBURG, MS",
    lat: 32.349033641592,
    lon: -90.882368787159,
    elevationFt: 193.1,
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((pins) => {
    localStorage.setItem("crestwatch.pins", JSON.stringify(pins));
  }, PINS);
});

test("FULL tier: the arithmetic is written out with source links", async ({
  page,
}) => {
  await page.goto("/why?pin=pjackson");
  await expect(page.getByText("No magic. Here's the math.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("FULL", { exact: true })).toBeVisible();
  // Gauge zero from the recorded RDB fixture. The flood number block
  // repeats it (and the pin's elevation), so take the arithmetic card's.
  await expect(page.getByText("233.4 ft").first()).toBeVisible();
  // The pin's own elevation.
  await expect(page.getByText("275.5 ft").first()).toBeVisible();
  await expect(page.getByText("margin of dry ground")).toBeVisible();
  // Traceable sources.
  await expect(
    page.getByRole("link", { name: /Official forecast page/ }),
  ).toHaveAttribute("href", "https://water.noaa.gov/gauges/JACM6");
  await expect(
    page.getByRole("link", { name: /Official gauge data/ }),
  ).toHaveAttribute(
    "href",
    "https://waterdata.usgs.gov/monitoring-location/02486000",
  );
});

test("CATEGORY tier: names what's missing", async ({ page }) => {
  await page.goto("/why?pin=pyazoo");
  await expect(page.getByText("CATEGORY", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText(/trust to within a foot/),
  ).toBeVisible();
  await expect(page.getByText("forecast crest (stage)")).toBeVisible();
});

test("ALERT-ONLY tier: honest headline + alerts pointer", async ({ page }) => {
  await page.goto("/why?pin=pvicksburg");
  await expect(page.getByText("ALERT-ONLY", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("CrestWatch can't watch this spot"),
  ).toBeVisible();
  await expect(page.getByText(/flash flooding/)).toBeVisible();
});

test("river data down: Why says so instead of asking for a first place", async ({
  page,
}) => {
  await page.route("**/api/watch", (r) => r.abort());
  await page.goto("/why?pin=pjackson");
  await expect(page.getByText(/The river data didn't answer/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Back to the watch/ }),
  ).toHaveAttribute("href", "/watch?pin=pjackson");
  await expect(page.getByText(/Add your home, grandma's place/)).toHaveCount(0);
});

test("a broken shared link says so and never shows this device's places", async ({
  page,
}) => {
  // The first characters of a real link, cut short (an SMS split).
  await page.goto("/why?pin=wl0&wl=W1siR3JhbmRtYSIs");
  await expect(page.getByText(/This shared link didn't open/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("No magic. Here's the math.")).toHaveCount(0);
  await expect(page.getByText("275.5 ft")).toHaveCount(0);
});
