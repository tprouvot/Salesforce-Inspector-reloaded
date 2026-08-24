import {test as base, chromium, firefox} from "@playwright/test";
import fs from "fs-extra";
import path from "path";
import {withExtension} from "playwright-webextext";
import {initializeResponseTracking} from "./test-helpers.js";
import {FIREFOX_EXTENSION_ID, FIREFOX_EXTENSION_UUID} from "../../playwright.global-setup.js";

export const test = base.extend({
  context: async ({browserName}, use, testInfo) => {
    if (browserName === "firefox") {
      // Firefox locks its profile, so give each worker its own profile dir.
      // Pin the extension's internal UUID so moz-extension:// URLs are stable.
      // eslint-disable-next-line no-undef
      const workerProfile = path.join(process.cwd(), `target/firefox-profile-${testInfo.workerIndex}`);
      fs.emptyDirSync(workerProfile);
      fs.writeFileSync(
        path.join(workerProfile, "user.js"),
        `user_pref("extensions.webextensions.uuids", "{\\"${FIREFOX_EXTENSION_ID}\\":\\"${FIREFOX_EXTENSION_UUID}\\"}");\n`
      );

      // withExtension installs target/firefox-test (built by
      // playwright.global-setup.js) as a temporary add-on, so it does not
      // need to be signed
      const firefoxWithAddon = withExtension(
        firefox,
        // eslint-disable-next-line no-undef
        path.join(process.cwd(), "target/firefox-test")
      );
      const context = await firefoxWithAddon.launchPersistentContext(workerProfile, {
        headless: true,
      });
      await use(context);
      await context.close();
      return;
    }

    // eslint-disable-next-line no-undef
    const pathToExtension = path.join(process.cwd(), "addon");
    const context = await chromium.launchPersistentContext("", {
      headless: true,
      channel: "chromium",
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // Set flag to skip welcome page in tests
    // Wait for service worker to be ready, then set the flag
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }

    // Set the flag in extension storage to skip welcome page
    await background.evaluate(async () => {
      // Wait for chrome APIs to be available
      let retries = 10;
      while (retries > 0 && (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local)) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retries--;
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({skipWelcomePage: true});
      }
    });

    await use(context);
    await context.close();
  },
  extensionUrl: async ({context, browserName}, use) => {
    if (browserName === "firefox") {
      // UUID is pinned via extensions.webextensions.uuids in the test profile
      await use(`moz-extension://${FIREFOX_EXTENSION_UUID}`);
      return;
    }
    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background) { background = await context.waitForEvent("serviceworker"); }

    const extensionId = background.url().split("/")[2];
    await use(`chrome-extension://${extensionId}`);
  },
  page: async ({page}, use) => {
    // Initialize response tracking early to catch responses that complete
    // before waitSuccessfulHttpResponse is called
    initializeResponseTracking(page);

    await use(page);
  },
});
export const expect = base.expect;
