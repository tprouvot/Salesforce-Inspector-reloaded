import dotenv from "dotenv";
import path from "node:path";
import fs from "fs";
import { execSync } from "child_process";
import { chromium } from 'playwright-core';

dotenv.config();

// Build extension
console.log("🔨 Building Chrome extension...");
execSync("npm run chrome-release-build", { stdio: "inherit" });

const extensionPath = path.resolve(process.cwd(), "target/chrome/dist/addon");
const userDataDir = path.resolve(process.cwd(), "chrome-test-profile");

if (!fs.existsSync(extensionPath)) {
  throw new Error(`Extension path not found: ${extensionPath}`);
}

if (fs.existsSync(userDataDir)) {
  fs.rmSync(userDataDir, { recursive: true });
}
fs.mkdirSync(userDataDir, { recursive: true });

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
    console.log('⏳ Playwright Chromium + extension loading...');
    await browser.pause(8000);
    
    await browser.url('chrome://extensions/');
    await browser.pause(5000);
    
    const debugInfo = await browser.execute(() => {
      return Array.from(document.querySelectorAll('extensions-item')).length;
    });
    console.log('🔍 Extensions found:', debugInfo);
    
    await browser.url('about:blank');
  }
};
