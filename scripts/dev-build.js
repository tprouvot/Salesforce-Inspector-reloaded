/* eslint-env node */
// This script sets up a development environment of Salesforce Inspector.
// Release builds use a different method.
// This script must be run through "npm run" so the PATH includes NPM dependencies.
"use strict";
const fs = require("fs-extra");

let browserType = process.argv[2];

if (browserType == "firefox") {
  // For Firefox builds, copy the Firefox-specific manifest
  fs.copySync("addon/manifest-firefox.json", "addon/manifest.json");
  console.log("Using manifest-firefox.json for Firefox build");

} else if (browserType == "chrome") {
  // For Chrome builds, manifest.json is already correct - no changes needed
  console.log("Using existing manifest.json for Chrome build");

} else {
  throw new Error("Unknown browser: " + browserType);
}
