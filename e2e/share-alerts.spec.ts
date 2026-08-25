import { expect, test } from "@playwright/test";

const YAZOO_PIN = {
  id: "pyazoo",
  name: "Grandma",
  matchedAddress: "211 E BROADWAY ST, YAZOO CITY, MS",
  lat: 32.846783396348,
  lon: -90.412396914911,
  elevationFt: 124.3,
};
const JACKSON_PIN = {
  id: "pjackson",
  name: "Home",
  matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
  lat: 32.300441828077,
  lon: -90.188419699815,
  elevationFt: 275.5,
};

test("alert strip renders the fixture flood warnings on watch + places", async ({
  page,
}) => {
  await page.addInitScript((pins) => {
    localStorage.setItem("crestwatch.pins", JSON.stringify(pins));
  }, [YAZOO_PIN]);

  await page.goto("/watch");
  await expect(page.getByText("Flash Flood Warning").first()).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/places");
  await expect(page.getByText("Flash Flood Warning").first()).toBeVisible({
    timeout: 15_000,
  });
});

test("share produces a real PNG of the verdict card", async ({ page }) => {
  await page.addInitScript((pins) => {
    localStorage.setItem("crestwatch.pins", JSON.stringify(pins));
    // Force the download path so the e2e can inspect the artifact.
    Object.defineProperty(navigator, "canShare", { value: undefined });
  }, [JACKSON_PIN]);

  await page.goto("/watch");
  await expect(page.getByText(/stays dry by about \d+ ft/).first()).toBeVisible({
    timeout: 15_000,
  });

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share" }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("crestwatch.png");
  const stream = await dl.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const buf = Buffer.concat(chunks);
  // Real PNG signature and a non-trivial payload (the rendered card).
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.length).toBeGreaterThan(20_000);
});
