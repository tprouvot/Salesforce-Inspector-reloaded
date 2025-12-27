// wdio.conf.js
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Build extension
console.log("🔨 Building Chrome extension...");
execSync("npm run chrome-release-build", { stdio: "inherit" });

const extensionPath = path.resolve(__dirname, "target/chrome/dist/addon");
const userDataDir = path.resolve(__dirname, "chrome-test-profile");

// Create profile directory if it doesn't exist
if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

console.log("✅ Extension path:", extensionPath);
console.log("📁 Profile path:", userDataDir);

exports.config = {
  runner: "local",
  specs: ["./test/**/*.test.js"],
  maxInstances: 1,

  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        // Use a persistent user profile
        args: [
          `--user-data-dir=${userDataDir}`,
          `--load-extension=${extensionPath}`,
          `--disable-extensions-except=${extensionPath}`,
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          // Keep the browser window visible
          "--disable-blink-features=AutomationControlled"
        ],
      },
    },
  ],

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
  reporters: ["spec"],
  logLevel: "info",

  // Give extension time to initialize
  before: async function() {
    console.log("⏳ Waiting for extension to initialize...");
    await browser.pause(3000);
    
    // Check if extension is loaded
    const extensions = await browser.execute(() => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return { hasRuntime: true, id: chrome.runtime.id };
      }
      return { hasRuntime: false };
    });
    
    console.log("🔧 Extension context:", extensions);
  },
};