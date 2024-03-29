/* eslint-env node */
// This script makes Release builds of Salesforce Inspector.
// Dev builds use a different method.
// This script must be run through "npm run" so the PATH includes NPM dependencies.
"use strict";
const fs = require("fs-extra");
const replace = require("replace-in-file");
const zipdir = require("zip-dir");

let browser = process.argv[2];

fs.emptyDirSync(`target/${browser}`);

let target = `target/${browser}/dist`;
if (browser == "chrome") {
  target += "/addon";
}

// Generate manifest.json file
require("./dev-build.js");

fs.copySync("addon", target, {
  filter(path) {
    let file = path.replace("\\", "/");
    return !file.startsWith("addon/test-") // Skip the test framework
      && !file.endsWith("-test.js") // Skip individual tests
      // Skip files in .gitignore
      && !file.endsWith(".zip")
      && !file.endsWith(".xpi")
      // Skip the manifest source file
      && file != "addon/manifest-template.json"
      // Skip files where the release version will use minified versions instead
      && file != "addon/react.js"
      && file != "addon/react-dom.js";
  }
});

// Use minified versions of React. The development versions contain extra checks and validations, which gives better error messages when developing, but are slower.
replace.sync({
  files: target + "/*.html",
  from: [
    '<script src="react.js"></script>',
    '<script src="react-dom.js"></script>'
  ],
  to: [
    '<script src="react.min.js"></script>',
    '<script src="react-dom.min.js"></script>'
  ]
});

if (process.env.ENVIRONMENT_TYPE == "BETA") {
  replace.sync({
    files: target + "/manifest.json",
    replace: '"name": "Salesforce inspector",',
    with: '"name": "Salesforce inspector BETA",'
  });
}

zipdir(`target/${browser}/dist`, {saveTo: process.env.ZIP_FILE_NAME || `target/${browser}/${browser}-release-build.zip`}, err => {
  if (err) {
    process.exitCode = 1;
    console.error(err);
  }
  console.log(`Completed ${browser} release build`);
});
