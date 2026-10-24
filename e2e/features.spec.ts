import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The October sprint features, wired together (package integration):
 * the flood number and its what-if slider, past floods, the calendar
 * button, the Why arithmetic, the Places line and the home river check.
 *
 * Fixture note (CRESTWATCH_TEST): the recorded gauge list has no
 * Mississippi River gauge, so the Vicksburg example is ALERT-ONLY here
 * (the same reason why.spec.ts treats Vicksburg as ALERT-ONLY). The
 * house-level checks use the recorded Pearl River at Jackson gauge, the
 * FULL-tier fixture place every other spec uses, and the example spec
 * below checks that a place without a trusted gauge shows none of them.
 * The recorded readings are from August 2026, so they read as old data
 * and no crest is ever ahead.
 */

const HOME = {
  id: "pjackson",
  name: "Home",
  matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
  lat: 32.300441828077,
  lon: -90.188419699815,
  elevationFt: 275.5,
};

async function savePins(page: Page) {
  await page.addInitScript((pins) => {
    localStorage.setItem("crestwatch.pins", JSON.stringify(pins));
  }, [HOME]);
}

test("flood number: the card shows, and the what-if slider moves the readout and its own picture", async ({
  page,
}) => {
  await savePins(page);
  await page.goto("/watch");
  const card = page.getByRole("region", { name: "Your flood number" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  // The big number, whole feet (the slider legend repeats it, hence first()).
  await expect(card.getByText(/^about \d+ ft$/).first()).toBeVisible();
  await expect(card.getByText("on the Pearl River gauge at Jackson.")).toBeVisible();
  await expect(card.getByText("CrestWatch doesn't count levees or floodwalls.")).toBeVisible();

  const readout = card.getByTestId("flood-number-readout");
  const atForecast = /^If the river reaches \d+\.\d ft on the gauge, Home stays dry by about \d+ ft\.$/;
  await expect(readout).toHaveText(atForecast);
  const before = await readout.textContent();
  // The main picture shows the forecast crest; the card has no picture yet.
  const mainPicture = page.getByRole("img", { name: /^Forecast crest / });
  await expect(mainPicture).toBeVisible();
  await expect(card.getByRole("img")).toHaveCount(0);

  // Slide all the way up, the way a keyboard user would.
  const slider = card.getByRole("slider", { name: "Try a river level" });
  await slider.focus();
  await page.keyboard.press("End");
  await expect(readout).not.toHaveText(before ?? "");
  await expect(readout).toHaveText(
    /^If the river reaches \d+\.\d ft on the gauge, water would be about \d+ ft deep at Home\.$/,
  );
  // The card draws that level in its own picture, right under the slider...
  await expect(
    card.getByRole("img", { name: /^What-if level reaches \d+ ft above Home$/ }),
  ).toBeVisible();
  // ...and the main picture stays on the forecast.
  await expect(mainPicture).toHaveCount(1);
  await expect(page.getByRole("img", { name: /^What-if level/ })).toHaveCount(1);

  await card.getByRole("button", { name: "Back to the forecast" }).click();
  await expect(readout).toHaveText(before ?? "");
  await expect(card.getByRole("img")).toHaveCount(0);
  await expect(mainPicture).toBeVisible();
});

test("past floods: the one-line summary shows and opens into the list", async ({ page }) => {
  await savePins(page);
  await page.goto("/watch");
  const summary = page.getByTestId("past-floods-summary");
  await expect(summary).toBeVisible({ timeout: 20_000 });
  await expect(summary).toHaveText(/of the 5 highest crests here would have reached Home\./);
  // Closed by default; the levee caveat is one tap away.
  const caveat = page.getByText(/CrestWatch doesn't count levees or floodwalls\. Treat this as a rough guide\./);
  await expect(caveat).toBeHidden();
  await page.getByText("See each flood").click();
  await expect(page.getByText("April 1979", { exact: true })).toBeVisible();
  await expect(caveat).toBeVisible();
});

test("calendar: no button when no crest is ahead (the recorded crest has passed)", async ({
  page,
}) => {
  await savePins(page);
  await page.goto("/watch");
  await expect(page.getByRole("region", { name: "Your flood number" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: "Copy watch link" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add the crest to my calendar/ })).toHaveCount(0);
});

test("read it to me: a quiet button where the browser can speak", async ({ page }) => {
  await savePins(page);
  await page.goto("/watch");
  await expect(page.getByRole("button", { name: "Copy watch link" })).toBeVisible({
    timeout: 20_000,
  });
  const canSpeak = await page.evaluate(
    () => "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function",
  );
  test.skip(!canSpeak, "this browser build has no speech synthesis");
  await expect(page.getByRole("button", { name: "Read it to me" })).toBeVisible();
});

test("why: the flood number is written out as ground minus gauge zero", async ({ page }) => {
  await savePins(page);
  await page.goto("/why?pin=pjackson");
  const block = page.getByTestId("why-flood-number");
  await expect(block).toBeVisible({ timeout: 20_000 });
  await expect(block.getByText("Home sits at")).toBeVisible();
  await expect(block.getByText("275.5 ft")).toBeVisible();
  await expect(block.getByText("233.4 ft")).toBeVisible();
  await expect(block.getByText("your flood number, read on the gauge")).toBeVisible();
  await expect(block.getByText(/^about \d+ ft$/)).toBeVisible();
});

test("places: a FULL card carries its flood number", async ({ page }) => {
  await savePins(page);
  await page.goto("/places");
  await expect(page.getByText(/^floods at about \d+ ft on the gauge$/)).toBeVisible({
    timeout: 20_000,
  });
});

test("home: the river check sits under the address box and above the steps", async ({
  page,
}) => {
  await page.goto("/");
  const box = page.getByLabel("Address, town, or ZIP");
  const rivers = page.getByRole("region", { name: "Right now on our rivers" });
  await expect(rivers).toBeVisible();
  await expect(rivers.getByTestId("river-row").first()).toBeVisible({ timeout: 20_000 });
  await expect(rivers.getByText("Pearl River at Jackson")).toBeVisible();

  const y = async (l: Locator) => (await l.boundingBox())!.y;
  const boxY = await y(box);
  const riversY = await y(rivers);
  const stepsY = await y(page.getByText("We check the river gauges"));
  expect(boxY).toBeLessThan(riversY);
  expect(riversY).toBeLessThan(stepsY);
});

test("example: without a trusted gauge it shows no flood number or past floods", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /See a live example from Vicksburg/ }).click();
  await expect(page.getByRole("heading", { name: "Levee St" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/behind Vicksburg's floodwall, which CrestWatch doesn't count/)).toBeVisible();
  // ALERT-ONLY under the recorded fixtures (see the note at the top).
  await expect(page.getByText("no gauge here")).toBeVisible();
  await expect(page.getByTestId("flood-number")).toHaveCount(0);
  await expect(page.getByTestId("past-floods")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add the crest to my calendar/ })).toHaveCount(0);
});

test("320 px: the watch page with the new cards never scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await savePins(page);
  await page.goto("/watch");
  await expect(page.getByRole("region", { name: "Your flood number" })).toBeVisible({
    timeout: 20_000,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
