import { expect, test } from "@playwright/test";

/* MVP polish: icons, install manifest, link preview, 404 and error pages. */

test("the head carries icons, manifest, and a share preview", async ({ page }) => {
  await page.goto("/");
  const head = page.locator("head");
  await expect(head.locator('link[rel="icon"][href*="icon.svg"]')).toHaveCount(1);
  await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(head.locator('link[rel="manifest"]')).toHaveCount(1);
  const og = await head.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toMatch(/^https:\/\/.+\/opengraph-image/);
  await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
});

test("every generated image actually renders as a PNG", async ({ request }) => {
  for (const path of ["/apple-icon", "/opengraph-image", "/pwa/192", "/pwa/512"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toContain("image/png");
    const buf = await res.body();
    expect(buf.subarray(0, 8).toString("hex"), path).toBe("89504e470d0a1a0a");
  }
  expect((await request.get("/pwa/999")).status()).toBe(404);
  const svg = await request.get("/icon.svg");
  expect(svg.status()).toBe(200);
  expect(await svg.text()).toContain("<svg");
});

test("the manifest is valid and installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m.name).toBe("CrestWatch");
  expect(m.display).toBe("standalone");
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
});

test("an unknown page shows a friendly 404 with a way back", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("We couldn't find that page.")).toBeVisible();
  await page.getByRole("link", { name: "Check a place" }).click();
  await expect(page).toHaveURL(/\/$/);
});
