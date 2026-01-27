import {test as base, chromium} from "@playwright/test";
import path from "path";
import {addCoverageData} from "./coverage-storage.js";

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    // eslint-disable-next-line no-undef
    const pathToExtension = path.join(process.cwd(), "addon");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      channel: 'chromium',
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
        await new Promise(resolve => setTimeout(resolve, 100));
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
    // Start coverage collection if enabled
    // eslint-disable-next-line no-undef
    const collectCoverage = process.env.COLLECT_COVERAGE === "true";
    if (collectCoverage) {
      try {
        await page.coverage.startJSCoverage();
      } catch (error) {
        console.warn("Could not start coverage:", error.message);
      }
    }

    await use(page);

    // Stop coverage and collect data
    if (collectCoverage) {
      try {
        const coverage = await page.coverage.stopJSCoverage();
        if (coverage && coverage.length > 0) {
          addCoverageData(coverage);
        }
      } catch (error) {
        // Coverage might not be available in all contexts
        console.warn("Could not collect coverage:", error.message);
      }
    }
  },
});
export const expect = base.expect;

