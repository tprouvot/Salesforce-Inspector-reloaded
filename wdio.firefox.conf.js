/* eslint-disable no-undef  */

import dotenv from "dotenv";
import path from "node:path";
import fs from "fs";
import {execSync} from "child_process";

dotenv.config();

// Auto-detect Firefox binary based on platform
function getFirefoxBinary() {
  // 1. Check environment variable first
  if (process.env.FIREFOX_DEV_PATH) {
    if (fs.existsSync(process.env.FIREFOX_DEV_PATH)) {
      console.log("✅ Using Firefox from FIREFOX_DEV_PATH:", process.env.FIREFOX_DEV_PATH);
      return process.env.FIREFOX_DEV_PATH;
    } else {
      console.warn("⚠️  FIREFOX_DEV_PATH doesn't exist:", process.env.FIREFOX_DEV_PATH);
    }
  }

  const platform = process.platform;

  // 2. Try common installation paths (Developer Edition first!)
  const possiblePaths = {
    win32: [
      "C:\\Program Files\\Firefox Developer Edition\\firefox.exe",
      "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      "C:\\Program Files (x86)\\Firefox Developer Edition\\firefox.exe",
      "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
    ],
    darwin: [
      "/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox",
      "/Applications/Firefox.app/Contents/MacOS/firefox",
      path.join(process.env.HOME, "Applications/Firefox Developer Edition.app/Contents/MacOS/firefox"),
      path.join(process.env.HOME, "Applications/Firefox.app/Contents/MacOS/firefox"),
    ],
    linux: [
      "/usr/bin/firefox-developer-edition",
      "/usr/bin/firefox",
      "/opt/firefox-developer-edition/firefox",
      "/opt/firefox/firefox",
      "/snap/bin/firefox",
    ],
  };

  const paths = possiblePaths[platform] || [];

  for (const firefoxPath of paths) {
    if (fs.existsSync(firefoxPath)) {
      console.log("✅ Found Firefox at:", firefoxPath);
      return firefoxPath;
    }
  }

  // 3. Try to find in PATH
  try {
    const cmd = platform === "win32" ? "where firefox" : "which firefox";
    const result = execSync(cmd, {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim().split("\n")[0];
    if (result && fs.existsSync(result)) {
      console.log("✅ Found Firefox in PATH:", result);
      return result;
    }
  } catch (err) {
    console.error("❌ Failed:", err.message);
  }

  // 4. Give up and provide helpful error message
  console.error("❌ Firefox not found!");
  console.error("Please set FIREFOX_DEV_PATH environment variable:");
  console.error("");
  if (platform === "win32") {
    console.error("  set FIREFOX_DEV_PATH=C:\\Path\\To\\firefox.exe");
    console.error("  or add to .env file:");
    console.error("  FIREFOX_DEV_PATH=C:\\Path\\To\\firefox.exe");
  } else if (platform === "darwin") {
    console.error('  export FIREFOX_DEV_PATH="/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox"');
    console.error("  or add to .env file:");
    console.error("  FIREFOX_DEV_PATH=/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox");
  } else {
    console.error("  export FIREFOX_DEV_PATH=/path/to/firefox");
    console.error("  or add to .env file:");
    console.error("  FIREFOX_DEV_PATH=/path/to/firefox");
  }
  console.error("");

  throw new Error("Firefox binary not found. Please set FIREFOX_DEV_PATH environment variable.");
}

console.log("🔨 Building Firefox extension...");
execSync("npm run firefox-release-build", {stdio: "inherit"});

const targetDir = path.resolve(process.cwd(), "target/firefox");
const zipFiles = fs.readdirSync(targetDir).filter(f => f.endsWith(".zip"));

if (!zipFiles.length) {
  throw new Error("No Firefox ZIP found in target/firefox");
}

const zipPath = path.join(targetDir, zipFiles[0]);
console.log("✅ Extension ZIP:", zipPath);

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const firefoxBinary = getFirefoxBinary();

export const config = {
  runner: "local",
  specs: ["./test/**/*.test.js"],
  maxInstances: 1,

  capabilities: [{
    browserName: "firefox",
    "moz:firefoxOptions": {
      binary: firefoxBinary,
      args: isCI ? ["-headless"] : [],
      prefs: {
        "xpinstall.signatures.required": false,
        "extensions.experiments.enabled": true,
        "devtools.console.stdout.content": true,
      },
    },
  }],

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },

  reporters: ["spec"],
  logLevel: isCI ? "warn" : "info",

  before: async () => {
    console.log("📦 Installing Firefox extension...");
    try {
      const zipBuffer = fs.readFileSync(zipPath);
      const base64Zip = zipBuffer.toString("base64");
      const extensionId = await browser.installAddOn(base64Zip, false);
      console.log("✅ Extension installed with ID:", extensionId);
      await browser.pause(5000);
    } catch (err) {
      console.error("❌ Extension installation failed:", err);
      throw err;
    }
  },

};
