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

test("places board: cards render worst-first with status lines", async ({
  page,
}) => {
  await page.goto("/places");
  const cards = page.locator("li a");
  await expect(cards).toHaveCount(2, { timeout: 15_000 });
  // ALERT_ONLY quiet (rank 9) sorts below FULL UNLIKELY (rank 8).
  await expect(cards.nth(0)).toContainText("Home");
  await expect(cards.nth(0)).toContainText(/stays dry by about \d+ ft/);
  await expect(cards.nth(1)).toContainText("The farm road");
  await expect(cards.nth(1)).toContainText("CrestWatch can't watch this spot");
});

test("tapping a card opens its watch screen", async ({ page }) => {
  await page.goto("/places");
  await page.getByText("Home").first().click();
  await expect(page).toHaveURL(/\/watch\?pin=pjackson/);
  await expect(
    page.getByText(/stays dry by about \d+ ft/).first(),
  ).toBeVisible({
    timeout: 15_000,
  });
});

test("delete all clears pins after confirm", async ({ page }) => {
  await page.goto("/places");
  page.on("dialog", (d) => void d.accept());
  await page
    .getByRole("button", { name: "Delete all my data" })
    .click({ timeout: 15_000 });
  await expect(page.getByText(/Add your home, grandma's place/)).toBeVisible();
  const pins = await page.evaluate(() =>
    localStorage.getItem("crestwatch.pins"),
  );
  expect(pins).toBeNull();
});

test("a place can be renamed and removed on its own", async ({ page }) => {
  await page.goto("/places");
  await expect(page.locator("li")).toHaveCount(2, { timeout: 15_000 });

  // Rename via the pencil button.
  page.once("dialog", (d) => void d.accept("Grandma's porch"));
  await page.getByRole("button", { name: "Rename Home" }).click();
  await expect(page.getByText("Grandma's porch")).toBeVisible();

  // Remove one place; the other stays.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Remove The farm road" }).click();
  await expect(page.locator("li")).toHaveCount(1, { timeout: 15_000 });
  const pins = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crestwatch.pins") ?? "[]"),
  );
  expect(pins).toHaveLength(1);
  expect(pins[0].name).toBe("Grandma's porch");
});
