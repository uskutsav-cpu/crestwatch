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

  // Scrub the slider to the end — the date readout follows.
  await page.getByLabel("Replay timeline").fill("216");
  await expect(page.getByText("2019-08-31")).toBeVisible();
});
