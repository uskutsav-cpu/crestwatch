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
  await expect(page.getByText("No magic — here's the math")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("FULL", { exact: true })).toBeVisible();
  // Gauge zero from the recorded RDB fixture.
  await expect(page.getByText("233.4 ft")).toBeVisible();
  // The pin's own elevation.
  await expect(page.getByText("275.5 ft")).toBeVisible();
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
    page.getByText(/doesn't publish its own elevation/),
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
