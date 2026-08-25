import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The screenshot capture is a tool, not a test — run it on demand with
  // `npm run screenshots`, not on every CI pass.
  testIgnore: "**/screenshots.spec.ts",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Dedicated production server on its own port — never reuse a running
    // dev server. CRESTWATCH_TEST switches the API routes to recorded
    // fixtures so e2e is deterministic and offline.
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CRESTWATCH_TEST: "1",
    },
  },
});
