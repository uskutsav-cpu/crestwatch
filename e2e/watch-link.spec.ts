import { expect, test } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("watch link: shared URL renders a verdict with zero setup", async ({
  page,
  browser,
}) => {
  // First visitor builds the link from their own pin…
  await page.addInitScript(() => {
    localStorage.setItem(
      "crestwatch.pins",
      JSON.stringify([
        {
          id: "pjackson",
          name: "Home",
          matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
          lat: 32.300441828077,
          lon: -90.188419699815,
          elevationFt: 275.5,
        },
      ]),
    );
  });
  await page.goto("/watch");
  await expect(page.getByText(/stays dry by about \d+ ft/).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Copy watch link" }).click();
  await expect(page.getByText("Link copied ✓")).toBeVisible();
  const url: string = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(url).toContain("/watch?wl=");

  // …grandma opens it in a genuinely fresh browser: verdict, no saved pins.
  const fresh = await browser.newContext();
  const grandma = await fresh.newPage();
  await grandma.goto(url);
  await expect(
    grandma.getByText(/stays dry by about \d+ ft/).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    grandma.getByText(/viewing a shared watch link/),
  ).toBeVisible();
  const saved = await grandma.evaluate(() =>
    localStorage.getItem("crestwatch.pins"),
  );
  expect(saved).toBeNull();
  await fresh.close();
});
