/* eslint-env node */
// This script sets up a development environment of Salesforce Inspector.
// Release builds use a different method.
// This script must be run through "npm run" so the PATH includes NPM dependencies.
"use strict";
const fs = require("fs-extra");

let manifest = fs.readJsonSync("addon/manifest-template.json");

let browser = process.argv[2];
if (browser == "firefox") {

  // Firefox needs to run in spanning mode, since it does not support split mode.
  manifest.incognito = "spanning";

  manifest.permissions = manifest.permissions.concat(manifest["host_permissions"]);
  manifest["web_accessible_resources"] = manifest["web_accessible_resources"][0].resources;
  delete manifest["host_permissions"];
  // Remove unused property, for consistency with the Chrome version.
  delete manifest.minimum_chrome_version;
  delete manifest["version_name"];

} else if (browser == "chrome") {

  // Chrome needs to run in split mode, since it does not support opening private extension tabs in spanning mode.
  manifest.incognito = "split";
  manifest.background["service_worker"] = manifest.background.scripts[0];
  delete manifest.background.scripts;
  manifest.background.type = "module";
  manifest["manifest_version"] = 3;
  // Remove irrelevant but annoying warning message "Unrecognized manifest key 'applications'.".
  delete manifest.applications;

} else {
  throw new Error("Unknown browser: " + browser);
}

fs.writeJsonSync("addon/manifest.json", manifest, {spaces: 2});
