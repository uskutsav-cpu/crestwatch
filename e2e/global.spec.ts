import { expect, test } from "@playwright/test";

/* Page titles, the /why nav pill, and the glossary (WP-GLOBAL). */

const TITLES: Array<[string, string]> = [
  ["/", "CrestWatch"],
  ["/watch", "Watch · CrestWatch"],
  ["/places", "Your places · CrestWatch"],
  ["/why", "Why this verdict · CrestWatch"],
  ["/replay", "Replay a flood · CrestWatch"],
  ["/about", "About · CrestWatch"],
];

for (const [path, title] of TITLES) {
  test(`${path} has its own page title`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  });
}

test("/why lights the Watch pill", async ({ page }) => {
  await page.goto("/why");
  await expect(
    page.getByRole("link", { name: "Watch", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

for (const path of ["/watch", "/why"]) {
  test(`${path} has a closed glossary that opens`, async ({ page }) => {
    await page.goto(path);
    const term = page.getByText("Height above sea level", { exact: true });
    await expect(term).toBeHidden();
    await page.getByText("What do these words mean?").click();
    await expect(term).toBeVisible();
  });
}
