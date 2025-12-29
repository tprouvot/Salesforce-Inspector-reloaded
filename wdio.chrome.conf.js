/* eslint-disable no-undef  */

import dotenv from "dotenv";
import path from "node:path";
import fs from "fs";
import {execSync} from "child_process";
import {chromium} from "playwright-core";

dotenv.config();

// Ensure Playwright Chromium is installed
try {
  const chromiumPath = chromium.executablePath();
  if (!fs.existsSync(chromiumPath)) {
    console.log("📦 Playwright Chromium not found, installing...");
    execSync("npx playwright install chromium", {stdio: "inherit"});
    console.log("✅ Chromium installed");
  }
} catch (err) {
  console.error("❌ Failed to setup Chromium:", err.message);
  console.error("Run: npx playwright install chromium");
  process.exit(1);
}

// Build extension
console.log("🔨 Building Chrome extension...");
execSync("npm run chrome-release-build", {stdio: "inherit"});

const extensionPath = path.resolve(process.cwd(), "target/chrome/dist/addon");
const userDataDir = path.resolve(process.cwd(), "chrome-test-profile");

if (!fs.existsSync(extensionPath)) {
  throw new Error(`Extension path not found: ${extensionPath}`);
}

if (fs.existsSync(userDataDir)) {
  fs.rmSync(userDataDir, {recursive: true});
}
fs.mkdirSync(userDataDir, {recursive: true});

export const config = {
  runner: "local",
  specs: ["./test/**/*.test.js"],
  maxInstances: 1,

  capabilities: [{
    browserName: "chrome",
    "goog:chromeOptions": {
      binary: chromium.executablePath(),
      args: [
        `--user-data-dir=${userDataDir}`,
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
      excludeSwitches: ["enable-automation"]
    }
  }],

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 180000
  },

  reporters: ["spec"],

  before: async () => {
    console.log("⏳ Playwright Chromium + extension loading...");
    await browser.pause(5000);
  }
};
