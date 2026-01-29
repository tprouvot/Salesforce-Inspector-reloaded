import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData
} from "./test-helpers";
import { routeMock } from "./test-mock";

test.describe("Metadata Retrieve", () => {
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
      //if mock is disabled, continue with the request
      if(!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }

      //we check if we have a mock for this request
      if (await routeMock(route, mockHost)) {
        return;
      }

      return route.continue();
    });
  });

  async function initMetadataRetrievePage(page, extensionId) {
    await page.goto(`chrome-extension://${extensionId}/metadata-retrieve.html?host=${mockHost}`);
    
    // Wait for metadata objects to load
    await page.waitForSelector(".filter-input", {timeout: 10000});
    await page.waitForSelector(".slds-accordion__list-item", {timeout: 10000});
  }

  test("Load Page and Verify Initial State", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Verify filter input exists
    const filterInput = page.locator(".filter-input");
    await expect(filterInput).toBeVisible();
    await expect(filterInput).toHaveValue("");

    // Verify buttons exist
    await expect(page.locator("button:has-text('Retrieve Metadata')")).toBeVisible();
    await expect(page.locator("button[title='Download package.xml']")).toBeVisible();
    await expect(page.locator("button[title='Import package.xml or package zip file']")).toBeVisible();
    await expect(page.locator("button[title='Copy package.xml']")).toBeVisible();
  });

  test("Load Metadata Objects", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Verify metadata objects are displayed
    const metadataItems = page.locator(".slds-accordion__list-item");
    await expect(metadataItems.first()).toBeVisible();

    // Verify ApexClass is in the list
    await expect(page.locator("text=ApexClass")).toBeVisible();
  });

  test("Filter Metadata Objects", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Type in filter
    const filterInput = page.locator(".filter-input");
    await filterInput.fill("Apex");

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify filtered results
    await expect(page.locator("text=ApexClass")).toBeVisible();
    // CustomObject should be hidden
    const customObject = page.locator("text=CustomObject");
    if (await customObject.count() > 0) {
      await expect(customObject.first()).toBeHidden();
    }
  });

  test("Clear Filter", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Type in filter
    const filterInput = page.locator(".filter-input");
    await filterInput.fill("Apex");

    // Click clear filter button
    const clearButton = page.locator(".filter-clear");
    await clearButton.click();

    // Verify filter is cleared
    await expect(filterInput).toHaveValue("");
  });

  test("Select All Metadata Objects", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Find and click Select All label (click on label instead of checkbox to avoid interception)
    const selectAllLabel = page.locator("label.slds-checkbox_toggle").first();
    const selectAllCheckbox = selectAllLabel.locator("input[type='checkbox']");
    await selectAllLabel.click();

    // Verify all checkboxes are checked
    await expect(selectAllCheckbox).toBeChecked();

    // Verify Retrieve Metadata button is enabled
    const retrieveButton = page.locator("button:has-text('Retrieve Metadata')");
    await expect(retrieveButton).toBeEnabled();
  });

  test("Select Individual Metadata Object", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Find first metadata object checkbox
    const firstCheckbox = page.locator(".slds-accordion__list-item").first().locator("input.metadata");
    await firstCheckbox.click();

    // Verify checkbox is checked
    await expect(firstCheckbox).toBeChecked();

    // Verify package.xml is generated
    await page.waitForSelector("#packageXml", {timeout: 5000});
    const packageXml = await page.locator("#packageXml").textContent();
    expect(packageXml).toContain("<Package");
  });

  test("Expand Metadata Object to List Children", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Click on ApexClass to expand
    const apexClassItem = page.locator(".slds-accordion__list-item:has-text('ApexClass')");
    await apexClassItem.locator("button.slds-accordion__summary-action").click();

    // Wait for listMetadata API call and children to load
    await page.waitForTimeout(2000);

    // Verify children are displayed
    const children = apexClassItem.locator(".slds-accordion__list-item");
    await expect(children.first()).toBeVisible({timeout: 5000});
  });

  test("Toggle Managed Packages Filter", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Find managed packages toggle (second checkbox toggle)
    const managedToggle = page.locator("label.slds-checkbox_toggle").nth(1);
    const checkbox = managedToggle.locator("input[type='checkbox']");

    // Verify initial state (should be unchecked by default)
    await expect(checkbox).not.toBeChecked();

    // Click to toggle
    await managedToggle.click();

    // Verify it's checked
    await expect(checkbox).toBeChecked();
  });

  test("Generate Package XML", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Select a metadata object
    const firstCheckbox = page.locator(".slds-accordion__list-item").first().locator("input.metadata");
    await firstCheckbox.click();

    // Wait for package.xml to be generated
    await page.waitForSelector("#packageXml", {timeout: 5000});

    // Verify package.xml content
    const packageXml = await page.locator("#packageXml").textContent();
    expect(packageXml).toContain("<Package");
    expect(packageXml).toContain("<version>");
    expect(packageXml).toContain("</Package>");
  });

  test("Copy Package XML", async ({page, context, extensionId}) => {
    // Grant clipboard permissions to browser context
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await initMetadataRetrievePage(page, extensionId);

    // Select a metadata object
    const firstCheckbox = page.locator(".slds-accordion__list-item").first().locator("input.metadata");
    await firstCheckbox.click();

    // Wait for package.xml to be generated
    await page.waitForSelector("#packageXml", {timeout: 5000});

    // Click copy button
    await page.locator("button[title='Copy package.xml']").click();

    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    console.log("Clipboard content:", clipboardContent);
    await expect(clipboardContent).toContain("<Package");
  });

  test("Show Deployment Options", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Wait for page to load
    await page.waitForSelector("button[title='Display Deployment Settings']", {timeout: 10000});

    // Click settings button
    const settingsButton = page.locator("button[title='Display Deployment Settings']");
    await settingsButton.click();

    // Wait for options to appear
    await page.waitForTimeout(500);

    // Verify deployment options appear
    await expect(page.locator("h2:has-text('Deployment Settings')")).toBeVisible({timeout: 5000});
    await expect(page.locator("label:has-text('Test Level')")).toBeVisible();
  });

  test("Change Test Level", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Wait for page to load
    await page.waitForSelector("button[title='Display Deployment Settings']", {timeout: 10000});

    // Click settings button
    const settingsButton = page.locator("button[title='Display Deployment Settings']");
    await settingsButton.click();

    // Wait for options to appear
    await page.waitForSelector("label:has-text('Test Level')", {timeout: 5000});

    // Change test level
    const testLevelSelect = page.locator("select.slds-select");
    await testLevelSelect.selectOption("RunLocalTests");

    // Verify test level is changed
    await expect(testLevelSelect).toHaveValue("RunLocalTests");
  });

  test("Retrieve Metadata Button Disabled When Nothing Selected", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Verify Retrieve Metadata button is disabled initially
    const retrieveButton = page.locator("button:has-text('Retrieve Metadata')");
    await expect(retrieveButton).toBeDisabled();
  });

  test("Import Package XML", async ({page, extensionId}) => {
    await initMetadataRetrievePage(page, extensionId);

    // Wait for page to load
    await page.waitForSelector("button[title='Import package.xml or package zip file']", {timeout: 10000});

    // Create a test package.xml file
    const packageXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>TestClass</members>
        <name>ApexClass</name>
    </types>
    <version>${apiVersion}</version>
</Package>`;

    // Use setInputFiles to simulate file selection
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "package.xml",
      mimeType: "text/xml",
      buffer: Buffer.from(packageXmlContent)
    });

    // Wait for toast notification (the file reader is async)
    await page.waitForTimeout(1000);
    await page.waitForSelector(".slds-notify", {timeout: 10000});

    // Verify success toast appears
    await expect(page.locator("text=imported successfully")).toBeVisible({timeout: 5000});
  });
});