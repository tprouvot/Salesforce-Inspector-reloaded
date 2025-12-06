/* eslint-env node */
// This script makes Release builds of Salesforce Inspector Reloaded.
// Dev builds use a different method.
// This script must be run through "npm run" so the PATH includes NPM dependencies.

(function() {
  "use strict";

  const fs = require("fs-extra");
  const {replaceInFileSync} = require("replace-in-file");
  const zipdir = require("zip-dir");

  let browserType = process.argv[2];

  fs.emptyDirSync(`target/${browserType}`);

  let target = `target/${browserType}/dist`;
  if (browserType == "chrome") {
    target += "/addon";
  }

  fs.copySync("addon", target, {
    filter(path) {
      let file = path.replace("\\", "/");
      return !file.startsWith("addon/test-") // Skip the test framework
        && !file.endsWith("-test.js") // Skip individual tests
        // Skip files in .gitignore
        && !file.endsWith(".zip")
        && !file.endsWith(".xpi")
        // Skip files where the release version will use minified versions instead
        && file != "addon/react.js"
        && file != "addon/react-dom.js";
    }
  });

  if (browserType === "firefox") {
    fs.copySync("addon/manifest-firefox.json", `${target}/manifest.json`);
    if (fs.existsSync(`${target}/manifest-firefox.json`)) {
      fs.unlinkSync(`${target}/manifest-firefox.json`);
    }
  }

  // Use minified versions of React. The development versions contain extra checks and validations, which gives better error messages when developing, but are slower.
  replaceInFileSync({
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
    replaceInFileSync({
      files: target + "/manifest.json",
      from: '"name": "Salesforce Inspector Reloaded",',
      to: '"name": "Salesforce Inspector Reloaded BETA",'
    });
  }

  // Read version from manifest.json to include in filename
  const manifestPath = `${target}/manifest.json`;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const version = manifest.version;

  const defaultZipName = `target/${browserType}/${browserType}-release-build-v${version}.zip`;

  zipdir(`target/${browserType}/dist`, {saveTo: process.env.ZIP_FILE_NAME || defaultZipName}, err => {
    if (err) {
      process.exitCode = 1;
      console.error(err);
    }
    console.log(`Completed ${browserType} release build v${version}`);
  });
})();
