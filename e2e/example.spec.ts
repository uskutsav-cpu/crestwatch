import { expect, test } from "@playwright/test";

test("example: one click from home shows a live watch and saves nothing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /See a live example from Vicksburg/ }).click();
  await expect(page).toHaveURL(/\/watch\?wl=.+&ex=1/);
  await expect(page.getByRole("heading", { name: "Levee Street" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/This is an example: two spots in Vicksburg/)).toBeVisible();
  await expect(page.getByText(/viewing a shared watch link/)).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem("crestwatch.pins"));
  expect(saved).toBeNull();

  await page.getByRole("link", { name: "Check your own place →" }).click();
  await expect(page).toHaveURL(/\/$/);
});
