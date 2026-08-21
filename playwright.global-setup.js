import fs from "fs-extra";
import path from "path";

export default async function globalSetup() {
  const addonTarget = "target/firefox-test";
  const profileDir = "target/firefox-profile";

  fs.emptyDirSync(addonTarget);
  fs.copySync("addon", addonTarget, {
    filter(src) {
      const file = src.replace(/\\/g, "/");
      return !file.endsWith(".zip") && !file.endsWith(".xpi");
    }
  });
  fs.copySync("addon/manifest-firefox.json", `${addonTarget}/manifest.json`);
  fs.removeSync(`${addonTarget}/manifest-firefox.json`);

  // Install extension into a Firefox profile using the gecko extension ID as folder name
  const extInstallDir = path.join(profileDir, "extensions", "salesforceinspector@reloaded");
  fs.emptyDirSync(extInstallDir);
  fs.copySync(addonTarget, extInstallDir);

  fs.ensureDirSync(profileDir);
  fs.writeFileSync(
    path.join(profileDir, "prefs.js"),
    'user_pref("extensions.autoDisableScopes", 0);\n'
  );
}
