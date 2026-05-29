import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: {
    timeout: 30000,
  },
  use: {
    actionTimeout: 30000,
    trace: "on-first-retry",
  },
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
});
