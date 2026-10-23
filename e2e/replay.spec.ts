import { expect, test } from "@playwright/test";

test("replay: 2019 backwater against a low farm road", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "crestwatch.pins",
      JSON.stringify([
        {
          id: "proad",
          name: "The farm road",
          matchedAddress: "NEAR VALLEY PARK, MS",
          lat: 32.6,
          lon: -90.8,
          elevationFt: 94,
        },
      ]),
    );
  });
  await page.goto("/replay");
  await expect(page.getByText("Replay a real flood")).toBeVisible();
  await expect(page.getByText(/Yazoo River at Redwood/)).toBeVisible({
    timeout: 15_000,
  });
  // The result line — months underwater.
  await expect(page.getByText(/Water above The farm road: \d+ days/)).toBeVisible({
    timeout: 15_000,
  });
  const text = await page
    .getByText(/Water above The farm road: (\d+) days/)
    .textContent();
  const days = parseInt(/(\d+) days/.exec(text ?? "")![1], 10);
  expect(days).toBeGreaterThan(90);
  // A street-level pin carries no approximate caveat.
  await expect(page.getByText("approximate spot", { exact: true })).toHaveCount(0);

  // Scrub the slider to the end — the date readout follows.
  await page.getByLabel("Replay timeline").fill("216");
  await expect(page.getByText("2019-08-31")).toBeVisible();
});

test("replay: an approximate (town centre) pin says so next to the result", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "crestwatch.pins",
      JSON.stringify([
        {
          id: "ptown",
          name: "Valley Park",
          matchedAddress: "VALLEY PARK, MS",
          lat: 32.6,
          lon: -90.8,
          elevationFt: 94,
          approximate: true,
        },
      ]),
    );
  });
  await page.goto("/replay");
  await expect(page.getByLabel("Flood")).toHaveValue("backwater2019");
  await expect(page.getByText(/Water above Valley Park: \d+ days/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("approximate spot", { exact: true })).toBeVisible();
  await expect(page.getByText(/This is the middle of your town or street, not your house\./)).toBeVisible();
});

test("replay: a place far from the flood's gauge gets no made-up result", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "crestwatch.pins",
      JSON.stringify([
        {
          id: "pvburg",
          name: "Vicksburg house",
          matchedAddress: "1400 WASHINGTON ST, VICKSBURG, MS, 39180",
          lat: 32.349,
          lon: -90.8824,
          elevationFt: 193.1,
        },
      ]),
    );
  });
  await page.goto("/replay");
  // Nearest in-range flood is picked for the place.
  await expect(page.getByLabel("Flood")).toHaveValue("backwater2019");
  await page.getByLabel("Flood").selectOption("pearl2020");
  await expect(
    page.getByText(
      /This flood was on the Pearl River at Jackson, about \d+ miles from Vicksburg house\./,
    ),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Replay timeline")).toHaveCount(0);
  await expect(page.getByText(/Water above Vicksburg house/)).toHaveCount(0);
});

test("replay: no saved places can replay the example places, saving nothing", async ({
  page,
}) => {
  await page.goto("/replay");
  await page.getByRole("button", { name: "Replay with the example places" }).click();
  await expect(page.getByText(/These are example places in Vicksburg/)).toBeVisible();
  await expect(page.getByText(/Water above Levee St: \d+ days/)).toBeVisible({
    timeout: 15_000,
  });
  const slider = page.getByLabel("Replay timeline");
  await expect(slider).toHaveAttribute("aria-valuetext", /^2019-01-01\. Water at .+ ft\. Levee St sits at 92\.7 ft\.$/);
  const saved = await page.evaluate(() => localStorage.getItem("crestwatch.pins"));
  expect(saved).toBeNull();
});
