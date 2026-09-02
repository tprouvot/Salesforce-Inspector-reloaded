import {test as base, chromium} from "@playwright/test";
import path from "path";
import {initializeResponseTracking} from "./test-helpers.js";

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {

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
  extensionId: async ({context}, use) => {
    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background) { background = await context.waitForEvent("serviceworker"); }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
  page: async ({page}, use) => {
    // Initialize response tracking early to catch responses that complete
    // before waitSuccessfulHttpResponse is called
    initializeResponseTracking(page);

    await use(page);
  },
});
export const expect = base.expect;

