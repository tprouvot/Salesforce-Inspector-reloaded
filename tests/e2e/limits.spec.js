import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Org Limits", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    // 1. Inject Fake Session Data
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });

    // 2. Mock Salesforce API Calls
    await context.route("**/*", async route => {
      if (!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }

      if (await routeMock(route, mockHost)) {
        return;
      }

      await route.continue();
    });
  });

  async function initLimitsPage(page, extensionId) {
    await page.goto(`chrome-extension://${extensionId}/limits.html?host=${mockHost}`);

    // Wait for limits API response and page to load
    await waitSuccessfulHttpResponse(page, "/services/data/v" + apiVersion + "/limits", 5000);

    // Wait for limits snapshot card and gauges to appear
    await page.waitForSelector("h2:has-text('Limits snapshot')", {timeout: 3000});
  }

  test("Load page and verify title", async ({page, extensionId}) => {
    await initLimitsPage(page, extensionId);

    await expect(page).toHaveTitle(/Org Limits/);
    await expect(page.locator("h2:has-text('Limits snapshot')")).toBeVisible();
  });

  test("Display limits data from API", async ({page, extensionId}) => {
    await initLimitsPage(page, extensionId);

    // At least one limit gauge should be visible
    const limitGauges = page.locator("figure .meter-value");
    await expect(limitGauges.first()).toBeVisible({timeout: 5000});

    // Each gauge shows consumption percentage (e.g. "90%" or "0%")
    await expect(limitGauges.first()).toContainText("%");
    // Figcaption shows consumed/total (e.g. "X of Y consumed")
    await expect(page.locator("figcaption").first()).toContainText("consumed");
  });

  test("Copy button is enabled when limits load", async ({page, extensionId}) => {
    await initLimitsPage(page, extensionId);

    const copyButton = page.locator("button:has-text('Copy')");
    await expect(copyButton).toBeVisible();
    await expect(copyButton).toBeEnabled();
  });

  test("Sort dropdown has options", async ({page, extensionId}) => {
    await initLimitsPage(page, extensionId);

    const sortSelect = page.locator("select.slds-select");
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect).toHaveValue("asc");

    // Verify sort options exist
    await expect(sortSelect.locator("option[value='consumption']")).toHaveCount(1);
    await expect(sortSelect.locator("option[value='asc']")).toHaveCount(1);
  });

  test("Change sort order", async ({page, extensionId}) => {
    await initLimitsPage(page, extensionId);

    const sortSelect = page.locator("select.slds-select");
    await sortSelect.selectOption("consumption");

    await expect(sortSelect).toHaveValue("consumption");
    // URL should update with sort param
    await expect(page).toHaveURL(/sort=consumption/);
  });

  test("Copy as JSON to clipboard", async ({page, extensionId, context}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await initLimitsPage(page, extensionId);

    const copyButton = page.locator("button:has-text('Copy')");
    await copyButton.click();

    await page.waitForTimeout(200);

    const clipboardContent = await page.evaluate(async () => await navigator.clipboard.readText());
    // Copy outputs model structure: key, label, max, remaining, consumption
    await expect(clipboardContent).toContain("remaining");
    await expect(clipboardContent).toContain("max");
    await expect(clipboardContent).toContain("consumption");
  });
});
