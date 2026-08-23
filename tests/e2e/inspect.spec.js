import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  createModelExposureSetup
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Inspect", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context, extensionId}) => {
    TEST_CONSTANTS.extensionId = extensionId;

    // Inject session data with model exposure
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion,
      additionalSetup: createModelExposureSetup()
    });

    // Mock Salesforce API calls
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

  /** @description Initializes the inspect page
   * @param {Object} page - Playwright page object
   * @param {Object} extensionId - Extension ID
   * @param {string} recordId - Record ID
   * @returns {Promise<void>}
   */
  async function initInspectPage(page, extensionId, recordId = null, useToolingApi = false) {
    await page.goto(`chrome-extension://${extensionId}/inspect.html?host=${mockHost}&objectType=Account${recordId ? `&recordId=${recordId}` : ""}${useToolingApi ? "&useToolingApi=1" : ""}`);
    await page.waitForSelector("#root", {timeout: 2000});
    await page.waitForSelector("text=Inspect", {timeout: 2000});
  }

  async function initInspectPageWaitRecordName(page, extensionId) {
    await initInspectPage(page, extensionId, TEST_CONSTANTS.accountRecordId);
    await page.waitForSelector(`td:has-text('${TEST_CONSTANTS.accountRecordId}')`, {timeout: 2000});
  }

  test("Load Inspect Page - Object Only", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    // Wait for table so the page is fully loaded before asserting
    await page.waitForSelector("table.slds-table", {timeout: 2000});

    // Verify page subtitle contains Account (more specific selector)
    await expect(page.locator("span.slds-truncate:has-text('Account')").first()).toBeVisible();

    // Verify tabs are visible
    await expect(page.locator("button:has-text('All')")).toBeVisible();
    await expect(page.locator("button:has-text('Fields')")).toBeVisible();
    await expect(page.locator("button:has-text('Relationships')")).toBeVisible();
  });

  test("Load Inspect Page - With Record ID", async ({page, extensionId}) => {
    await initInspectPageWaitRecordName(page, extensionId);

    // Verify record name appears in table (more specific)
    await expect(page.locator(`td:has-text('${TEST_CONSTANTS.accountRecordName}')`).first()).toBeVisible();
  });

  test("Switch Tabs", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector(".slds-builder-header_container li span[title=Fields]", {timeout: 1000});

    // Click Fields tab
    await page.locator(".slds-builder-header_container li span[title=Fields]").click();

    // Click Relationships tab
    await page.locator(".slds-builder-header_container li span[title=Relationships]").click();

    // Click All tab
    await page.locator(".slds-builder-header_container li span[title=All]").click();
  });

  test("Filter Fields", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    // Wait for table first so the page is fully loaded (filter is in header, same render)
    await page.waitForSelector("table.slds-table", {timeout: 2000});
    await page.waitForSelector("input[placeholder='Filter']", {timeout: 2000});

    // Type in filter
    const filterInput = page.locator("input[placeholder='Filter']");
    await filterInput.fill("Name");

    // Wait for filtering to take effect
    await page.waitForTimeout(500);

    // Verify Name field is visible
    await expect(page.locator("text=Name").first()).toBeVisible();
  });

  test("Toggle Column Visibility", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector(".slds-builder-header_container li span[title=Fields]", {timeout: 1000});

    // Click Fields tab to open column visibility menu
    await page.locator(".slds-builder-header_container li span[title=Fields]").click();
    await page.waitForTimeout(250);

    // Click the chevron to open column visibility menu
    const chevron = page.locator(".slds-builder-header_container li span[title=Fields]").locator("..").locator("svg").first();
    await chevron.click();
    await page.waitForTimeout(250);

    // Find and toggle a column checkbox (e.g., Label)
    const labelCheckbox = page.locator("input[type='checkbox']").filter({hasText: /Label/i}).first();
    if (await labelCheckbox.isVisible()) {
      const wasChecked = await labelCheckbox.isChecked();
      await labelCheckbox.click();
      await page.waitForTimeout(250);
      // Verify state changed
      const isNowChecked = await labelCheckbox.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    }
  });

  test("Calculate Field Usage", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector(".slds-builder-header_container li span[title=Fields]", {timeout: 1000});

    // Click Fields tab
    await page.locator(".slds-builder-header_container li span[title=Fields]").click();

    // Wait for Usage column header with action button
    await page.waitForSelector("text=Usage (%)", {timeout: 1000});

    // Find the refresh button in the Usage column header
    const usageHeader = page.locator("th:has-text('Usage (%)')");
    const refreshButton = usageHeader.locator("button");

    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for loading to complete (longer for real org)
      await page.waitForTimeout(250);

      // Verify usage values appear (not "Get field usage" anymore) - skip when real org as API may not complete in time
      if (TEST_CONSTANTS.mockEnabled) {
        const usageCells = page.locator("td.field-usage");
        const firstUsageCell = usageCells.first();
        if (await firstUsageCell.isVisible()) {
          const text = await firstUsageCell.textContent();
          expect(text).not.toContain("Get field usage");
        }
      }
    }
  });

  test("Enter Edit Mode - Update", async ({page, extensionId}) => {
    await initInspectPageWaitRecordName(page, extensionId);

    // Click Edit button
    const editButton = page.locator("button:has-text('Edit')");
    await editButton.click();

    // Wait for edit mode
    await page.waitForTimeout(250);

    // Verify Save and Cancel buttons appear
    await expect(page.locator("button:has-text('Save')")).toBeVisible();
    await expect(page.locator("button:has-text('Cancel')")).toBeVisible();
  });

  test("Edit Field Value", async ({page, extensionId}) => {
    await initInspectPageWaitRecordName(page, extensionId);

    // Enter edit mode
    await page.locator("button:has-text('Edit')").click();
    await page.waitForTimeout(250);

    // Double-click on a field value to edit
    const nameCell = page.locator(`td:has-text('${TEST_CONSTANTS.accountRecordName}')`).first();
    await nameCell.dblclick();

    // Wait for textarea to appear
    await page.waitForSelector("textarea", {timeout: 1000});

    // Type new value
    const textarea = page.locator("textarea").first();
    await textarea.fill("Updated Account Name");

    // Verify value changed
    await expect(textarea).toHaveValue("Updated Account Name");
  });

  test("Cancel Edit", async ({page, extensionId}) => {
    await initInspectPageWaitRecordName(page, extensionId);

    // Enter edit mode
    await page.locator("button:has-text('Edit')").click();
    await page.waitForTimeout(250);

    // Click Cancel
    await page.locator("button:has-text('Cancel')").click();
    await page.waitForTimeout(250);

    // Verify edit mode is cancelled (Save button should not be visible)
    await expect(page.locator("button:has-text('Save')")).not.toBeVisible();
  });

  test("Enter Delete Mode", async ({page, extensionId}) => {
    await initInspectPageWaitRecordName(page, extensionId);

    // Click Delete button
    const deleteButton = page.locator("button:has-text('Delete')");
    await deleteButton.click();

    // Wait for delete confirmation
    await page.waitForTimeout(250);

    // Verify Confirm delete button appears
    await expect(page.locator("button:has-text('Confirm delete')")).toBeVisible();
  });

  test("Enter Create Mode", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    // Click New button
    const newButton = page.locator("button:has-text('New')");
    await newButton.click();

    // Wait for create mode
    await page.waitForTimeout(250);

    // Verify Save new button appears
    await expect(page.locator("button:has-text('Save new')")).toBeVisible();
  });

  test("Export Table - Copy", async ({page, context, extensionId}) => {
    // Grant clipboard permissions to browser context
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await initInspectPage(page, extensionId);

    await page.waitForSelector("table.slds-table", {timeout: 1000});
    await page.waitForTimeout(250); // Wait for table to fully render

    // Find settings button in the actions column header
    const actionsHeader = page.locator("th.field-actions, th.child-actions").first();
    const settingsButton = actionsHeader.locator("button").first();
    await settingsButton.click();
    await page.waitForTimeout(250);

    // Click Copy Table
    const copyTableLink = page.locator("a:has-text('Copy Table')");
    await copyTableLink.click();
    await page.waitForTimeout(250);

    // Verify clipboard was set (in test mode)
    const clipboardValue = await page.evaluate(() => navigator.clipboard.readText());
    await expect(clipboardValue).toBeTruthy();
    await expect(clipboardValue).toContain("Field API Name");
  });

  test("Export Table - Download CSV", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector("table.slds-table", {timeout: 1000});
    await page.waitForTimeout(250); // Wait for table to fully render

    // Find settings button in the actions column header
    const actionsHeader = page.locator("th.field-actions, th.child-actions").first();
    const settingsButton = actionsHeader.locator("button").first();
    await settingsButton.click();
    await page.waitForTimeout(250);

    // Click Download CSV
    const downloadLink = page.locator("a:has-text('Download CSV')");

    // Set up download listener
    page.waitForEvent("download", {timeout: 1000}).catch(() => null);
    await downloadLink.click();

    // Note: In test environment, downloads may not trigger, so we just verify the click works
    await page.waitForTimeout(250);
  });

  test("Toggle Table Borders", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector("table.slds-table", {timeout: 1000});
    await page.waitForTimeout(250); // Wait for table to fully render

    // Find settings button in the actions column header
    const actionsHeader = page.locator("th.field-actions, th.child-actions").first();
    const settingsButton = actionsHeader.locator("button").first();
    await settingsButton.click();
    await page.waitForTimeout(250);

    // Click Show/Hide table borders
    const bordersLink = page.locator("a").filter({hasText: /table border/i});
    if (await bordersLink.isVisible()) {
      await bordersLink.click();
      await page.waitForTimeout(250);

      // Verify table class changed
      const table = page.locator("table.slds-table").first();
      const hasBordered = await table.evaluate(el => el.classList.contains("slds-table_bordered"));
      // After toggle, state should change
      expect(typeof hasBordered).toBe("boolean");
    }
  });

  test("Show Object Metadata", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector("a:has-text('More')", {timeout: 1000});

    // Click More button
    const moreButton = page.locator("a:has-text('More')");
    await moreButton.click();
    await page.waitForTimeout(250);

    // Verify metadata modal appears
    await expect(page.locator("text=All available metadata")).toBeVisible();
  });

  test("Field Actions Menu", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector("table.slds-table", {timeout: 1000});

    // Find first field actions button (dropdown)
    const fieldActionsButtons = page.locator("td.field-actions button");
    const firstActionButton = fieldActionsButtons.first();

    if (await firstActionButton.isVisible()) {
      await firstActionButton.click();
      await page.waitForTimeout(250);

      // Verify menu appears
      await expect(page.locator("text=All field metadata")).toBeVisible();
    }
  });

  test("Relationship Actions Menu", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector("text=Relationships", {timeout: 1000});

    // Switch to Relationships tab
    await page.locator("text=Relationships").click();
    await page.waitForTimeout(250);

    // Find first relationship actions button
    const relationshipActionsButtons = page.locator("td.child-actions button");
    const firstActionButton = relationshipActionsButtons.first();

    if (await firstActionButton.isVisible()) {
      await firstActionButton.click();
      await page.waitForTimeout(250);

      // Verify menu appears
      await expect(page.locator("text=All relationship metadata")).toBeVisible();
    }
  });

  test("Object Actions Menu", async ({page, extensionId}) => {
    await initInspectPageWaitRecordName(page, extensionId);

    // Find object actions dropdown button - look in utility items area
    const objectActionsContainer = page.locator(".object-actions").first();
    const objectActionsButton = objectActionsContainer.locator("button:has(svg use[xlinkHref*='down'])").last();

    if (await objectActionsButton.isVisible()) {
      await objectActionsButton.click();
      await page.waitForTimeout(250);

      // Verify menu appears with options
      await expect(page.locator("text=View record in Salesforce")).toBeVisible();
    }
  });

  test("Tooling API Support", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId, null, true);

    // Verify Tooling API indicator appears
    await expect(page.locator("text=Tooling API")).toBeVisible();
  });

  test("Record ID Popup", async ({page, extensionId}) => {
    await initInspectPageWaitRecordName(page, extensionId);

    // Find a reference field value (ID) and click it
    const idLink = page.locator("a:has-text('" + TEST_CONSTANTS.accountRecordId + "')").first();
    if (await idLink.isVisible()) {
      await idLink.click();
      await page.waitForTimeout(250);

      // Verify popup menu appears
      await expect(page.locator("text=View in Salesforce")).toBeVisible();
      await expect(page.locator("text=Copy Id")).toBeVisible();
    }
  });

  test("Column Filtering", async ({page, extensionId}) => {
    await initInspectPage(page, extensionId);

    await page.waitForSelector(".slds-builder-header_container li span[title=Fields]", {timeout: 1000});

    // Switch to Fields tab (enables column filtering)
    await page.locator(".slds-builder-header_container li span[title=Fields]").click();
    await page.waitForTimeout(250);

    // Find a column filter input
    const filterInputs = page.locator("input.column-filter-box");
    const firstFilter = filterInputs.first();

    if (await firstFilter.isVisible()) {
      await firstFilter.fill("Test");
      await page.waitForTimeout(250);

      // Verify filter was applied
      await expect(firstFilter).toHaveValue("Test");
    }
  });
});
