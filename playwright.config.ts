import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://sc:sc@127.0.0.1:5432/swisschalets_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "ar-SY",
    timezoneId: "Asia/Damascus",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // WebKit/Chromium downloads are blocked in this environment; use the system Chrome when present.
    ...(process.env.PW_CHANNEL !== "bundled" ? { channel: "chrome" } : {}),
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: "mobile-375", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } }, grep: /@mobile/ },
  ],
  webServer: {
    command: `node scripts/start-standalone.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DB, DATA_DIR: "/tmp/swisschalets-e2e", APP_URL: `http://127.0.0.1:${PORT}`, APP_SECRET: "e2e-secret",
      API_RATE_LIMIT: "1000", LOGIN_RATE_LIMIT: "1000", NODE_ENV: "production",
    },
  },
});
