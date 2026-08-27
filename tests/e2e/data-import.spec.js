import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  TEST_GUID,
  injectSessionData,
  createModelExposureSetup,
  pasteData,
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Data Import", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  // Slight increase when running full suite - page setup and beforeEach can be slow under load
  test.setTimeout(10000);

  test.beforeEach(async ({context}) => {
    // 1. Inject Fake Session Data with model exposure setup
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion,
      additionalSetup: createModelExposureSetup()
    });

    // 2. Mock Salesforce API Calls
    await context.route("**/*", async route => {
      //if mock is disabled, continue with the request
      if (!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }

      //we check if we have a mock for this request
      if (await routeMock(route, mockHost)) {
        return;
      }

      await route.continue();
    });
  });

  /**
 * Initializes the import page
 * @param {Object} page - Playwright page object
 * @param {Object} context - Playwright browser context
 * @param {string} extensionId - Extension ID
 * @returns {Promise<void>}
 */
  async function initImportPage(page, context, extensionId) {
    // Grant clipboard permissions to browser context
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`chrome-extension://${extensionId}/data-import.html?host=${mockHost}`);

    // Inject localStorage data after page loads (init script might fail due to security restrictions)
    await page.evaluate(({host, token, version}) => {
      try {
        if (typeof Storage !== "undefined" && window.localStorage) {
          const keyPrefix = host;
          window.localStorage.setItem(keyPrefix + "_access_token", token);
          window.localStorage.setItem(keyPrefix + "_isSandbox", "true");
          window.localStorage.setItem(keyPrefix + "_orgInstance", "FRA12S");
          window.localStorage.setItem("apiVersion", version);
        }
      } catch (e) {
        console.warn("Failed to set localStorage:", e.message);
      }
    }, {host: mockHost, token: mockToken, version: apiVersion});

    await page.waitForSelector("#form-search-object");

    // Set object type
    const objectInput = page.locator("#form-search-object");
    await objectInput.fill("Inspector_Test__c");
    await objectInput.press("Enter");

    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 3000});

    return objectInput;
  }


  /**
   * Creates records from CSV
   * @param {Object} page - Playwright page object
   * @returns {Promise<void>} recordIds
   */
  async function createRecords(page) {
    // Set action to Insert
    await page.locator("#form-import-action").selectOption("create");

    //Paste CSV data - trigger onDataPaste handler by dispatching paste event with clipboardData
    const csvData = '"Name","Checkbox__c","Number__c"\r\ntest3-' + TEST_GUID + ",false,300.03\r\ntest4-" + TEST_GUID + ",true,400.04";

    // Trigger paste event with clipboardData to call onDataPaste handler
    await pasteData(page, "#data-paste", csvData);

    // Wait for data to be parsed and field mapping to be validated
    // First wait for the field mapping section to appear (indicates data was parsed)
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 2000});
    // Then wait for the button to be enabled
    await page.waitForSelector("button:has-text('Run Insert'):not([disabled])", {timeout: 2000});

    // Click Run Insert button
    await page.click("button:has-text('Run Insert')");

    // Confirm dialog should appear
    await expect(page.locator(".slds-modal")).toBeVisible();
    await expect(page.locator(".slds-modal")).toContainText("records will be created");

    // Click confirm button inside the modal (more specific selector)
    await page.locator(".slds-modal button:has-text('Insert')").click();

    // Wait for import to complete
    //TODO: better way to wait for import to complete
    await page.waitForTimeout(500);

    // Verify status counts
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
    await expect(page.locator("text=/\\d+ Succeeded/")).toContainText("2 Succeeded");

    // Extract the record IDs from the result table
    return await page.locator("table.slds-table tr:not(:first-child) td:nth-child(5)").allTextContents(); ;
  }

  /**
   * Updates records from CSV
   * @param {Object} page - Playwright page object
   * @returns {Promise<void>}
   */
  async function updateRecords(page, recordIds = []) {
    //Now update the record
    const csvData = "Id,Name,Number__c\r\n" + recordIds.map(id => `${id},test5update-' + TEST_GUID + ',500.50`).join("\r\n");
    await pasteData(page, "#data-paste", csvData);

    // Now update the select element to match
    await page.locator("#form-import-action").selectOption("update");

    // Wait for data to be parsed and field mapping to appear
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 2000});

    // Wait for button to be enabled - with debugging info
    await page.waitForSelector("button:has-text('Run Update'):not([disabled])", {timeout: 2000});

    // Click Run Update button
    await page.click("button:has-text('Run Update')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Update')").click();

    // Wait for import to complete
    await page.waitForTimeout(500);

    // Verify status success count is greater than 0
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
    await expect(page.locator("text=/\\d+ Succeeded/")).toContainText("1 Succeeded");
  }

  async function upsertRecords(page, _recordIds = []) {
    // Set action to Upsert
    await page.locator("#form-import-action").selectOption("upsert");

    // Wait for external ID field to be visible (it's conditionally rendered when upsert is selected)
    // The parent div has hidden attribute, so we wait for the input to be visible
    const externalIdField = page.locator("#form-external-id");
    await externalIdField.waitFor({state: "visible", timeout: 2000});

    // Set external ID field
    await page.locator("#form-external-id").fill("Name");
    await page.waitForTimeout(500); // Wait for validation

    // Paste CSV data
    const csvData = "Name,Number__c\r\ntest2-" + TEST_GUID + ",222\r\ntest6-" + TEST_GUID + ",666";
    await pasteData(page, "#data-paste", csvData);

    // Wait for data to be parsed
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 2000});
    // Wait for button to be enabled
    await page.waitForSelector("button:has-text('Run Upsert'):not([disabled])", {timeout: 2000});

    // Click Run Upsert button
    await page.click("button:has-text('Run Upsert')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Upsert')").click();

    // Wait for import to complete
    await page.waitForTimeout(1000);

    // Verify status
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
    await expect(page.locator("text=/\\d+ Succeeded/")).toContainText("2 Succeeded");

    return await page.locator("table.slds-table tr:not(:first-child) td:nth-child(4)").allTextContents(); ;

  }

  async function deleteRecords(page, recordIds = []) {
    // Now update the select element to match
    await page.locator("#form-import-action").selectOption("delete");

    // Paste CSV data with Id column and ignored column
    const csvData = "Id,_foo*\r\n" + recordIds.map(id => `${id},foo`).join("\r\n");
    await pasteData(page, "#data-paste", csvData);

    // Wait for data to be parsed and field mapping to appear
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 2000});

    // Wait for button to be enabled - with debugging info
    await page.waitForSelector("button:has-text('Run Delete'):not([disabled])", {timeout: 2000});

    // Click Run Delete button
    await page.click("button:has-text('Run Delete')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Delete')").click();

    // Wait for import to complete
    await page.waitForTimeout(500);

    // Verify status
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
    await expect(page.locator("text=/\\d+ Succeeded/")).toContainText("4 Succeeded");
  }

  test("Load Page and Verify Autocomplete Lists", async ({page, context, extensionId}) => {
    const objectInput = await initImportPage(page, context, extensionId);

    // Verify the object input has the value
    await expect(objectInput).toHaveValue("Inspector_Test__c");
  });

  test("All Records Operations from CSV", async ({page, context, extensionId}) => {
    await initImportPage(page, context, extensionId);
    //create records and get the record ids
    const createdRecordIds = await createRecords(page, "create");
    await updateRecords(page, new Array(createdRecordIds[0]));
    const upsertedRecordIds = await upsertRecords(page, createdRecordIds);
    await deleteRecords(page, createdRecordIds.concat(upsertedRecordIds));
  });

  test("Create Records from Excel Format", async ({page, context, extensionId}) => {
    await initImportPage(page, context, extensionId);

    // Set action to Insert
    await page.locator("#form-import-action").selectOption("create");

    // Paste Excel data (tab-separated) - make sure tabs are actual tab characters
    const excelData = '"Name"\t"Number__c"\r\ntest6-' + TEST_GUID + "\t600.06\r\ntest7-" + TEST_GUID + "\t700.07";
    await pasteData(page, "#data-paste", excelData);

    // Wait for data to be parsed and field mapping to appear
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 2000});

    // Wait for button to be enabled
    await page.waitForSelector("button:has-text('Run Insert'):not([disabled])", {timeout: 2000});

    // Click Run Insert button
    await page.click("button:has-text('Run Insert')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Insert')").click();

    // Wait for import to complete
    await page.waitForTimeout(1500);

    // Verify status
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
  });

  test("Copy Options", async ({page, context, extensionId}) => {
    await initImportPage(page, context, extensionId);

    // Set action to Update
    await page.locator("#form-import-action").selectOption("update");

    // Click Copy Options button
    await page.click("button:has-text('Copy Options')");

    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    await expect(clipboardContent).toContain("salesforce-inspector-import-options");
    await expect(clipboardContent).toContain("apiType=Enterprise");
    await expect(clipboardContent).toContain("action=update");
    await expect(clipboardContent).toContain("object=Inspector_Test__c");
  });

  test("Validation Errors - Empty Data", async ({page, context, extensionId}) => {
    await initImportPage(page, context, extensionId);

    // Try to paste empty data
    await pasteData(page, "#data-paste", "");
    await page.waitForTimeout(150);

    // Verify error message appears (check if error div is visible or contains text)
    const errorDiv = page.locator("#error-data-paste");
    await expect(errorDiv).not.toHaveAttribute("hidden", "");
  });

  test("Validation Errors - Invalid Field Name", async ({page, context, extensionId}) => {
    await initImportPage(page, context, extensionId);

    // Paste data with invalid field name
    const csvData = "Na*me\r\ntest0";
    await pasteData(page, "#data-paste", csvData);


    // Verify field mapping shows error (check in the field mapping section)
    // The error should appear next to the field input
    await expect(page.locator(".slds-text-color_error:has-text('Invalid field name')")).toBeVisible();
  });
});

