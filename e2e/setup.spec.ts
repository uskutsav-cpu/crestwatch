import { expect, test } from "@playwright/test";

/**
 * T06 — the full setup path against recorded fixtures (CRESTWATCH_TEST).
 * Typed address only; no GPS prompt ever appears.
 */

test("setup: address → confirm elevation + gauge → done → watch", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Will the water reach your house?")).toBeVisible();

  await page
    .getByLabel("Address, town, or ZIP")
    .fill("100 E Capitol St, Jackson, MS");
  await page.getByRole("button", { name: "Watch this place" }).click();

  // Confirm card: real fixture numbers.
  await expect(page.getByText("Your spot sits 275.5 ft above sea level.")).toBeVisible({
    timeout: 15_000,
  });
  // Scoped to the confirm card: the home page's river strip also names
  // the Pearl River at Jackson.
  await expect(page.getByText(/Closest river gauge: Pearl River at Jackson/)).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/watch/);

  // Pin persisted to localStorage.
  const pins = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crestwatch.pins") ?? "[]"),
  );
  expect(pins).toHaveLength(1);
  expect(pins[0].name).toBe("Home");
  expect(pins[0].elevationFt).toBeCloseTo(275.5, 0);
});

test("setup: unmatchable address shows the friendly note", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Address, town, or ZIP").fill("zzz not a real place xx");
  await page.getByRole("button", { name: "Watch this place" }).click();
  await expect(
    page.getByText(/We couldn't find that one/),
  ).toBeVisible({ timeout: 15_000 });
});

test("setup: second pin lands on places board", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Address, town, or ZIP").fill("100 E Capitol St, Jackson, MS");
  await page.getByRole("button", { name: "Watch this place" }).click();
  await expect(page.getByText("Your spot sits 275.5 ft above sea level.")).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole("button", { name: "+ Add the road you care about" })
    .click();

  await page.getByLabel("Address, town, or ZIP").fill("211 E Broadway St, Yazoo City, MS");
  await page.getByRole("button", { name: "Watch this place" }).click();
  await expect(page.getByText("Your spot sits 124.3 ft above sea level.")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/places/);

  const pins = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crestwatch.pins") ?? "[]"),
  );
  expect(pins).toHaveLength(2);
  expect(pins[1].name).toBe("The road");
});

test("setup: Skip after a returning visitor's new place opens the list", async ({
  page,
}) => {
  // Already watching Home. Seed once only, so a reload can't undo a save.
  await page.addInitScript((pin) => {
    if (!localStorage.getItem("crestwatch.pins")) {
      localStorage.setItem("crestwatch.pins", JSON.stringify([pin]));
    }
  }, {
    id: "pjackson",
    name: "Home",
    matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
    lat: 32.300441828077,
    lon: -90.188419699815,
    elevationFt: 275.5,
  });
  await page.goto("/");
  await page.getByLabel("Address, town, or ZIP").fill("211 E Broadway St, Yazoo City, MS");
  await page.getByRole("button", { name: "Watch this place" }).click();
  await expect(page.getByText("Your spot sits 124.3 ft above sea level.")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Call this place").fill("Grandma's");
  await page
    .getByRole("button", { name: "+ Add the road you care about" })
    .click();
  await page.getByRole("button", { name: "Skip, I'm done" }).click();
  // /watch alone would open Home, the oldest place, not Grandma's.
  await expect(page).toHaveURL(/\/places/);

  const pins = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crestwatch.pins") ?? "[]"),
  );
  expect(pins.map((p: { name: string }) => p.name)).toEqual(["Home", "Grandma's"]);
});

test("setup: a town name works and is labelled an approximate spot", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Address, town, or ZIP").fill("Vicksburg, MS");
  await page.getByRole("button", { name: "Watch this place" }).click();

  // The town resolves rather than dead-ending...
  await expect(page.getByText(/Vicksburg, Mississippi/)).toBeVisible({
    timeout: 15_000,
  });
  // ...and is honest that it is not the visitor's own ground.
  await expect(page.getByText("approximate spot").first()).toBeVisible();
  await expect(
    page.getByText(/middle of your town or street, not your house/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/watch/);
  // The caveat follows the pin onto the verdict screen.
  await expect(
    page.getByText(/middle of your town or street, not your house/),
  ).toBeVisible({
    timeout: 15_000,
  });
  const pins = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crestwatch.pins") ?? "[]"),
  );
  expect(pins[0].approximate).toBe(true);
});
