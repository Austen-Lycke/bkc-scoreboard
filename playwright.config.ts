import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (npm run test:e2e). They use the demo competition, which lives on the device only:
 * no database, no login. Against `next dev` (bkc_dev), never a build: `next build` reads the live
 * database from .env.local. An already running dev server on port 3000 is reused.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // A tablet in landscape: a finger as the only pointer (pointer: coarse), so the touch layout applies.
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/tv",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
