import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Object Scanner", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });
    await context.addInitScript(() => {
      localStorage.removeItem("objectScannerFieldsToDisplay");
    });

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

  async function initObjectScannerPage(page, extensionId) {
    await page.goto(`chrome-extension://${extensionId}/object-scanner.html?host=${mockHost}`);
    await waitSuccessfulHttpResponse(page, "/tooling/query", 10000);
    await expect(page).toHaveTitle(/Object Scanner/);
  }

  // Object Scanner selects every customizable object by default. Against the mock that's a
  // handful of curated entities, but against a real org it's every standard object (hundreds),
  // which makes Scan/Analyze take far longer than the mock-tuned timeouts below. Narrow the
  // selection to just the objects these tests care about so behavior stays consistent either way.
  async function selectOnlyTestObjects(page) {
    await page.getByRole("button", {name: "Select none"}).click();
    await page.locator("label[for='obj-Account']").click();
    await page.locator("label[for='obj-Inspector_Test__c']").click();
  }

  test("loads the data model and filters Object.Field search", async ({page, extensionId}) => {
    await initObjectScannerPage(page, extensionId);

    await expect(page.locator("label[for='obj-Account']")).toBeVisible();
    await expect(page.locator("label[for='obj-Inspector_Test__c']")).toBeVisible();
    await selectOnlyTestObjects(page);

    await page.getByRole("button", {name: "Scan Data Model", exact: true}).click();
    await expect(page.locator("#object-scanner-model tbody tr td").first()).toBeVisible({timeout: 15000});
    await expect(page.locator("#object-scanner-model")).toContainText("Account");
    await expect(page.locator("#object-scanner-model")).toContainText("Email__c");
    await expect(page.locator("#object-scanner-model thead")).toContainText("External ID");
    await expect(page.locator("#object-scanner-model thead")).toContainText("Unique");
    await expect(page.locator("#object-scanner-model thead")).toContainText("Required");
    await expect(page.locator("#object-scanner-model thead")).toContainText("Help Text");
    await expect(page.locator("#object-scanner-model thead")).toContainText("Lookup To");
    await expect(page.locator("#object-scanner-model")).toContainText("Customer email");

    await page.getByRole("button", {name: "Columns"}).click();
    // Click the label - the faux checkbox span intercepts pointer events on the input itself
    await page.locator("label[for='object-scanner-col-unique']").click();
    await expect(page.locator("#object-scanner-model thead")).not.toContainText("Unique");
    await expect(page.locator(".sfir-object-scanner-api-stats")).toContainText(/API calls:\s*\d+/);

    await page.locator("#object-scanner-model-search").fill("Account.Name");
    await expect(page.locator("#object-scanner-model")).toContainText("Name");
    await expect(page.locator("#object-scanner-model")).not.toContainText("Email__c");
    await expect(page.locator("#object-scanner-model")).not.toContainText("Inspector_Test__c");
  });

  test("analyzes the loaded data model", async ({page, extensionId}) => {
    await initObjectScannerPage(page, extensionId);
    await selectOnlyTestObjects(page);
    await page.getByRole("button", {name: "Scan Data Model", exact: true}).click();
    await expect(page.locator("#object-scanner-model tbody tr td").first()).toBeVisible({timeout: 15000});

    await page.getByRole("button", {name: "Analyze", exact: true}).click();
    await expect(page.locator("#object-scanner-findings tbody tr").first()).toBeVisible({timeout: 15000});
    await expect(page.locator("#object-scanner-findings")).toContainText("Duplicate Label");
    await expect(page.locator("#object-scanner-findings")).toContainText("Email__c");
    await expect(page.locator("#object-scanner-findings a[href*='objectType=Inspector_Test__c']").first()).toBeVisible();
  });

  test("exports findings CSV", async ({page, extensionId}) => {
    await initObjectScannerPage(page, extensionId);
    await selectOnlyTestObjects(page);
    await page.getByRole("button", {name: "Scan Data Model", exact: true}).click();
    await expect(page.locator("#object-scanner-model tbody tr td").first()).toBeVisible({timeout: 15000});
    await page.getByRole("button", {name: "Analyze", exact: true}).click();
    await expect(page.locator("#object-scanner-findings tbody tr td").first()).toBeVisible({timeout: 15000});

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", {name: "Export Findings"}).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/object-scanner-findings-.*\.csv/);
  });
});
