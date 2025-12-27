// wdio.firefox.conf.js
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const firefoxPath = process.env.FIREFOX_DEV_PATH || 
  "C:\\Program Files\\Firefox Developer Edition\\firefox.exe"; // Windows example

// Build Firefox extension
console.log("🔨 Building Firefox extension...");
execSync("npm run firefox-release-build", { stdio: "inherit" });

// Find the built ZIP file
const targetDir = path.resolve(__dirname, "target/firefox");
const zipFiles = fs.readdirSync(targetDir).filter(f => f.endsWith(".zip"));

if (!zipFiles.length) {
  throw new Error("No Firefox ZIP found");
}

const zipPath = path.join(targetDir, zipFiles[0]);
console.log("✅ Extension ZIP:", zipPath);

exports.config = {
  runner: "local",
  specs: ["./test/**/*.test.js"],
  maxInstances: 1,

  capabilities: [{
    browserName: "firefox",
    "moz:firefoxOptions": {
      binary: firefoxPath,
      prefs: {
        "xpinstall.signatures.required": false,
        "extensions.experiments.enabled": true,
      },
    },
  }],

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },

  reporters: ["spec"],
  logLevel: "info",

  before: async () => {
    console.log("📦 Installing Firefox extension...");

    try {
      // Read the ZIP file and convert to base64
      const zipBuffer = fs.readFileSync(zipPath);
      const base64Zip = zipBuffer.toString('base64');
      
      // Install using base64 data
      const extensionId = await browser.installAddOn(base64Zip, false);
      console.log("✅ Extension installed with ID:", extensionId);
      
      await browser.pause(5000);
    } catch (err) {
      console.error("❌ Extension installation failed:", err);
      throw err;
    }
  },
};