import {defineConfig, devices} from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
      ["line"], // Shows synthetic progress
      ["github"], // GitHub Actions annotations for better error visibility
      ["html"], // Generates HTML report
    ]
    : [
      ["list"], // Shows progress with error details
      ["html"], // Generates HTML report
    ],
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Chrome options for loading the unpacked extension
        args: [
          `--disable-extensions-except=${path.join(process.cwd(), "addon")}`,
          `--load-extension=${path.join(process.cwd(), "addon")}`,
        ],
      },
    },
  ],
});

