import { defineConfig, devices } from "@playwright/test";
import { parsePlaywrightPort } from "./playwright-port";

const previewPort = parsePlaywrightPort(process.env.PLAYWRIGHT_PORT);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // Depot Tenang renders Phaser/WebGL timing assertions; parallel browser workers
  // contend for one GPU and can manufacture journey timeouts that a single game cannot hit.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://127.0.0.1:${previewPort}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: `http://127.0.0.1:${previewPort}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
