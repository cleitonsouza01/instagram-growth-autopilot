import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright configuration for Chrome extension e2e tests.
 *
 * Note: Extension testing requires loading the unpacked extension.
 * Run `pnpm build` before running e2e tests.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Extensions require sequential testing
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension testing
  reporter: "html",
  timeout: 30000,

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium-extension",
      use: {
        ...devices["Desktop Chrome"],
        // Load extension in Chrome
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(".output/chrome-mv3")}`,
            `--load-extension=${path.resolve(".output/chrome-mv3")}`,
            "--no-sandbox",
          ],
        },
      },
    },
  ],
});
