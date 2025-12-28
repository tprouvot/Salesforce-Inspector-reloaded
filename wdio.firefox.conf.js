import dotenv from "dotenv";
import path from "node:path";
import fs from "fs";
import {execSync} from "child_process";

dotenv.config();

const firefoxPath = process.env.FIREFOX_DEV_PATH
  || "C:\\Program Files\\Firefox Developer Edition\\firefox.exe";

console.log("🔨 Building Firefox extension...");
execSync("npm run firefox-release-build", {stdio: "inherit"});

const targetDir = path.resolve(process.cwd(), "target/firefox");
const zipFiles = fs.readdirSync(targetDir).filter(f => f.endsWith(".zip"));

if (!zipFiles.length) {
  throw new Error("No Firefox ZIP found");
}

const zipPath = path.join(targetDir, zipFiles[0]);
console.log("✅ Extension ZIP:", zipPath);

export const config = {
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
