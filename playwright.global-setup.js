import fs from "fs-extra";

export const FIREFOX_EXTENSION_ID = "salesforceinspector@reloaded";
// Fixed internal UUID seeded via extensions.webextensions.uuids so the
// moz-extension:// origin is deterministic across test runs.
export const FIREFOX_EXTENSION_UUID = "9c04c81d-73d5-4a34-8feb-1c4bcd571c4a";

export default async function globalSetup() {
  const addonTarget = "target/firefox-test";

  // Build an unpacked Firefox version of the addon; tests/e2e/fixtures.js
  // installs it as a temporary add-on (no signing required) at browser launch
  fs.emptyDirSync(addonTarget);
  fs.copySync("addon", addonTarget, {
    filter(src) {
      const file = src.replace(/\\/g, "/");
      return !file.endsWith(".zip") && !file.endsWith(".xpi");
    }
  });
  fs.copySync("addon/manifest-firefox.json", `${addonTarget}/manifest.json`);
  fs.removeSync(`${addonTarget}/manifest-firefox.json`);
}
