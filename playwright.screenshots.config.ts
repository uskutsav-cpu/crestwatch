import { defineConfig, devices } from "@playwright/test";

/**
 * Screenshot capture config (T13) — same fixture-backed server as the e2e
 * suite, but runs ONLY the screenshot spec. `npm run screenshots`.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/screenshots.spec.ts",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { CRESTWATCH_TEST: "1" },
  },
});
