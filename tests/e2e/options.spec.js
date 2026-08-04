import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  createModelExposureSetup
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Options", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

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
      //we check if we have a mock for this request
      if (await routeMock(route, mockHost)) {
        return;
      }

      await route.continue();
    });
  });

  async function initOptionsPage(page, extensionId, selectedTab = null, gotoTab = null) {
    await page.goto(`chrome-extension://${extensionId}/options.html?host=${mockHost}${selectedTab ? `&selectedTab=${selectedTab}` : ""}`);
    await page.waitForSelector(".sfir-options-tab-container", {timeout: 1000});
    if (gotoTab) {
      await page.locator(`a[role='tab']:has-text('${gotoTab}')`).click();
    }

    // Ensure we're on the gotoTab / selectedTab or User Experience tab (default)
    await page.waitForSelector("a[role='tab']:has-text('" + (gotoTab || selectedTab || "User Experience") + "')", {timeout: 1000});
    //check if the related tab is active
    await expect(page.locator(".options-tab:has-text('" + (gotoTab || selectedTab || "User Experience") + "')")).toHaveClass(/slds-is-active/);
  }

  test.describe("User Experience", () => {
    test("Load Options Page", async ({page, extensionId}) => {
      // Set up console error listener to debug
      const consoleErrors = [];
      page.on("console", msg => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await initOptionsPage(page, extensionId);

      // Wait for root element to exist
      await page.waitForSelector("#root", {timeout: 1000});

      // Wait for Options header to appear (indicates React has rendered)
      await page.waitForSelector("h1:has-text('Options'), .slds-text-heading_small:has-text('Options')", {timeout: 1000});

      // Verify header exists (use more specific selector to avoid multiple matches)
      await expect(page.locator(".slds-text-heading_small:has-text('Options')").first()).toBeVisible();
    });

    test("Verify Tabs Exist", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId);

      // Verify all main tabs are present (use role="tab" to be specific)
      await expect(page.locator("a[role='tab']:has-text('User Experience')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('API')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('Data Export')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('Data Import')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('Field Creator')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('Enable Logs')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('Metadata')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('Flow Scanner')")).toBeVisible();
      await expect(page.locator("a[role='tab']:has-text('Custom Shortcuts')")).toBeVisible();
    });

    test("Toggle Option - Popup Dark Theme", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId);

      // Find Popup Dark theme checkbox by key
      const checkbox = page.locator("input#popupDarkTheme");
      await expect(checkbox).toBeVisible();

      // Get initial state
      const initialChecked = await checkbox.isChecked();

      // Find the parent container and click the toggle span
      const checkboxContainer = checkbox.locator("..").locator("..");
      const toggleSpan = checkboxContainer.locator("span.slds-checkbox_faux_container");
      await toggleSpan.click();

      // Wait for state to update
      await page.waitForTimeout(500);

      // Verify state changed
      const newChecked = await checkbox.isChecked();
      await expect(newChecked).toBe(!initialChecked);
    });

    test("MultiCheckboxButtonGroup - Show Buttons", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId);

      // Find "Show buttons" checkbox group - use first occurrence (User Experience tab)
      const showButtonsText = page.locator("text=Show buttons").first();
      await expect(showButtonsText).toBeVisible();

      const showButtonsGroup = showButtonsText.locator("..").locator("..");

      // Find "New" checkbox label (click the label instead of the input to avoid interception)
      const newCheckboxLabel = showButtonsGroup.locator("label:has-text('New')");
      await expect(newCheckboxLabel).toBeVisible();

      // Get the checkbox to check initial state
      const newCheckbox = showButtonsGroup.locator("input[type='checkbox'][name='new']");
      const initialChecked = await newCheckbox.isChecked();

      // Toggle "New" checkbox by clicking the label
      await newCheckboxLabel.click();

      // Wait for state to update
      await page.waitForTimeout(500);

      // Verify state changed
      const newChecked = await newCheckbox.isChecked();
      await expect(newChecked).toBe(!initialChecked);
    });

    test("MultiCheckboxButtonGroup - Metadata Shortcut Search Options", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId);

      // Find "Searchable metadata from Shortcut tab" checkbox group
      const metadataGroup = page.locator("text=Searchable metadata from Shortcut tab").locator("..").locator("..");
      await expect(metadataGroup).toBeVisible();

      // Find "Apex Classes" checkbox label (click the label instead of the input to avoid interception)
      const apexClassesLabel = metadataGroup.locator("label:has-text('Apex Classes')");
      await expect(apexClassesLabel).toBeVisible();

      // Get the checkbox to check initial state
      const apexClassesCheckbox = metadataGroup.locator("input[type='checkbox'][name='classes']");
      const initialChecked = await apexClassesCheckbox.isChecked();

      // Toggle Apex Classes checkbox by clicking the label
      await apexClassesLabel.click();

      // Wait for state to update
      await page.waitForTimeout(500);

      // Verify state changed
      const newChecked = await apexClassesCheckbox.isChecked();
      expect(newChecked).toBe(!initialChecked);
    });

    test("Arrow Button Orientation and Position", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId);

      // Find arrow orientation select
      await page.waitForSelector("select[name='arrowPosition']", {timeout: 1000});

      const orientationSelect = page.locator("select[name='arrowPosition']");
      await expect(orientationSelect).toBeVisible();

      // Change orientation to horizontal
      await orientationSelect.selectOption("horizontal");

      // Verify value is changed
      await expect(orientationSelect).toHaveValue("horizontal");

      // Find position slider
      const positionSlider = page.locator("input#arrowPositionSlider");
      await expect(positionSlider).toBeVisible();

      // Change position
      await positionSlider.fill("50");

      // Verify value is set
      await expect(positionSlider).toHaveValue("50");
    });
  });

  test.describe("API", () => {
    test("Switch to API Tab", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "API");

      // Verify API tab is active
      await expect(page.locator(".options-tab:has-text('API')")).toHaveClass(/slds-is-active/);

      // Verify API version input is visible (use more specific selector)
      await expect(page.locator("span:has-text('API Version')").first()).toBeVisible();
    });

    test("Change API Version", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "API");

      // Wait for API version input
      await page.waitForSelector("#api input[type='number']", {timeout: 1000});

      // Find API version input
      const apiVersionInput = page.locator("#api input[type='number']").first();
      await expect(apiVersionInput).toBeVisible();

      // Change API version
      await apiVersionInput.fill("66");
      await apiVersionInput.press("Enter");

      // Wait for validation/update
      await page.waitForTimeout(1000);

      // Verify value is updated (or restored if invalid)
      const value = await apiVersionInput.inputValue();
      await expect(parseInt(value)).toBeGreaterThanOrEqual(60);
    });

    test("URL Parameter - Select Tab", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, "api");

      // Verify API tab is active by default
      await expect(page.locator(".options-tab:has-text('API')")).toHaveClass(/slds-is-active/);
    });

    test("Restore Default API Version", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "API");

      // Wait for API version input
      await page.waitForSelector("#api input[type='number']", {timeout: 1000});

      // Change API version to non-default
      const apiVersionInput = page.locator("#api input[type='number']").first();
      await apiVersionInput.fill("66");
      await apiVersionInput.press("Enter");
      await page.waitForTimeout(1000);

      // Check if Restore Default button appears
      const restoreButton = page.locator("button:has-text('Restore Default')");
      if (await restoreButton.count() > 0) {
        await restoreButton.click();

        // Wait for restore
        await page.waitForTimeout(500);

        // Verify button is gone (version restored to default)
        await expect(restoreButton).not.toBeVisible();
      }
    });

    test("Delete Token Button", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "API");

      // Wait for Delete Token button
      await page.waitForSelector("button:has-text('Delete Token')", {timeout: 1000});

      // Verify button exists
      const deleteTokenButton = page.locator("button:has-text('Delete Token')");
      await expect(deleteTokenButton).toBeVisible();

      // Note: Button may be disabled if no token exists, which is expected behavior
    });
  });

  test.describe("Data Export", () => {
    test("Switch to Data Export Tab", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Data Export");
      // Verify CSV Separator option is visible
      await expect(page.locator("text=CSV Separator")).toBeVisible();
    });

    test("Change CSV Separator", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Data Export");

      // Wait for CSV Separator input
      await page.waitForSelector("input#csvSeparatorInput", {timeout: 1000});

      // Find CSV Separator input
      const csvSeparatorInput = page.locator("input#csvSeparatorInput");
      await expect(csvSeparatorInput).toBeVisible();

      // Change separator
      await csvSeparatorInput.fill(";");

      // Verify value is set
      await expect(csvSeparatorInput).toHaveValue(";");
    });

    test("Toggle automatic large IN clause splitting", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Data Export");

      const checkbox = page.locator("input#autoSplitLargeInClauses");
      await expect(checkbox).toBeVisible();
      await expect(checkbox).not.toBeChecked();

      const checkboxContainer = checkbox.locator("..").locator("..");
      await checkboxContainer.locator("span.slds-checkbox_faux_container").click();

      await expect(checkbox).toBeChecked();
      await expect.poll(() => page.evaluate(() => localStorage.getItem("autoSplitLargeInClauses"))).toBe("true");
    });
  });

  test.describe("Data Import", () => {
    test("Switch to Data Import Tab", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Data Import");

      // Verify Default batch size option is visible
      await expect(page.locator("text=Default batch size")).toBeVisible();
    });

    test("Change Default Batch Size", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Data Import");

      // Wait for batch size input
      await page.waitForSelector("input[placeholder='200']", {timeout: 1000});

      // Find batch size input
      const batchSizeInput = page.locator("input[placeholder='200']");
      await expect(batchSizeInput).toBeVisible();

      // Change batch size
      await batchSizeInput.fill("500");

      // Verify value is set
      await expect(batchSizeInput).toHaveValue("500");
    });
  });

  test.describe("Field Creator", () => {
    test("Switch to Field Creator Tab", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Field Creator");

      // Verify Field Naming Convention option is visible
      await expect(page.locator("text=Field Naming Convention")).toBeVisible();
    });

    test("Change Field Naming Convention", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Field Creator");

      // Wait for Field Naming Convention select (find by looking for the text first)
      await page.waitForSelector("text=Field Naming Convention", {timeout: 1000});

      // Find Field Naming Convention select - look for select near the text
      const fieldNamingText = page.locator("text=Field Naming Convention").first();
      const namingSelect = fieldNamingText.locator("..").locator("..").locator("select.slds-select").first();
      await expect(namingSelect).toBeVisible();

      // Change to Underscores
      await namingSelect.selectOption("underscore");

      // Verify value is changed
      await expect(namingSelect).toHaveValue("underscore");
    });
  });

  test.describe("Custom Shortcuts", () => {
    test("Switch to Custom Shortcuts Tab", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Custom Shortcuts");

      // Verify search input is visible
      await expect(page.locator("input[placeholder='Search shortcuts...']")).toBeVisible();
    });

    test("Add Custom Shortcut", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Custom Shortcuts");

      // Wait for shortcuts table
      await page.waitForSelector("table.slds-table", {timeout: 1000});

      // Click Add button
      const addButton = page.locator("button[title='Add Shortcut']");
      await addButton.click();

      // Wait for edit row to appear - look for input fields in the table row
      await page.waitForSelector("table.slds-table tbody tr input[type='text']", {timeout: 1000});

      // Fill in shortcut details - find inputs in the editing row
      const editingRow = page.locator("table.slds-table tbody tr").last();
      const labelInput = editingRow.locator("input[type='text']").first();
      await labelInput.fill("Test Shortcut");

      // Find link input (second input)
      const linkInput = editingRow.locator("input[type='text']").nth(1);
      await linkInput.fill("/test/path");

      // Find section input (third input)
      const sectionInput = editingRow.locator("input[type='text']").nth(2);
      await sectionInput.fill("Test Section");

      // Click Save button
      const saveButton = editingRow.locator("button[title='Save']");
      await saveButton.click();

      // Wait for save to complete
      await page.waitForTimeout(500);

      // Verify shortcut appears in table
      await expect(page.locator("text=Test Shortcut")).toBeVisible();
    });

    test("Edit Custom Shortcut", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Custom Shortcuts");

      // Wait for shortcuts table
      await page.waitForSelector("table.slds-table", {timeout: 1000});

      // First add a shortcut
      const addButton = page.locator("button[title='Add Shortcut']");
      await addButton.click();
      await page.waitForSelector("table.slds-table tbody tr input[type='text']", {timeout: 1000});

      const editingRow = page.locator("table.slds-table tbody tr").last();
      const labelInput = editingRow.locator("input[type='text']").first();
      await labelInput.fill("Original Label");
      const linkInput = editingRow.locator("input[type='text']").nth(1);
      await linkInput.fill("/original/path");
      const sectionInput = editingRow.locator("input[type='text']").nth(2);
      await sectionInput.fill("Original Section");

      await editingRow.locator("button[title='Save']").click();
      await page.waitForTimeout(500);

      // Now edit it
      const editButton = page.locator("button[title='Edit']").first();
      await editButton.click();

      // Wait for edit mode
      await page.waitForTimeout(500);

      // Find the editing row and change label
      const editRow = page.locator("table.slds-table tbody tr").first();
      const editLabelInput = editRow.locator("input[type='text']").first();
      await editLabelInput.fill("Updated Label");

      // Save
      await editRow.locator("button[title='Save']").click();
      await page.waitForTimeout(500);

      // Verify updated label appears
      await expect(page.locator("text=Updated Label")).toBeVisible();
    });

    test("Delete Custom Shortcut", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Custom Shortcuts");

      // Wait for shortcuts table
      await page.waitForSelector("table.slds-table", {timeout: 1000});

      // First add a shortcut
      const addButton = page.locator("button[title='Add Shortcut']");
      await addButton.click();
      await page.waitForSelector("table.slds-table tbody tr input[type='text']", {timeout: 1000});

      const editingRow = page.locator("table.slds-table tbody tr").last();
      const labelInput = editingRow.locator("input[type='text']").first();
      await labelInput.fill("To Delete");
      const linkInput = editingRow.locator("input[type='text']").nth(1);
      await linkInput.fill("/delete/path");
      const sectionInput = editingRow.locator("input[type='text']").nth(2);
      await sectionInput.fill("Delete Section");

      await editingRow.locator("button[title='Save']").click();
      await page.waitForTimeout(500);

      // Verify it exists
      await expect(page.locator("text=To Delete")).toBeVisible();

      // Delete it
      const deleteButton = page.locator("button[title='Delete']").first();
      await deleteButton.click();

      // Wait for deletion
      await page.waitForTimeout(500);

      // Verify it's gone
      await expect(page.locator("text=To Delete")).not.toBeVisible();
    });

    test("Search Custom Shortcuts", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Custom Shortcuts");

      // Wait for search input
      await page.waitForSelector("input[placeholder='Search shortcuts...']", {timeout: 1000});

      // Add a shortcut first
      const addButton = page.locator("button[title='Add Shortcut']");
      await addButton.click();
      await page.waitForSelector("table.slds-table tbody tr input[type='text']", {timeout: 1000});

      const editingRow = page.locator("table.slds-table tbody tr").last();
      const labelInput = editingRow.locator("input[type='text']").first();
      await labelInput.fill("Searchable Shortcut");
      const linkInput = editingRow.locator("input[type='text']").nth(1);
      await linkInput.fill("/searchable/path");
      const sectionInput = editingRow.locator("input[type='text']").nth(2);
      await sectionInput.fill("Search Section");

      await editingRow.locator("button[title='Save']").click();
      await page.waitForTimeout(500);

      // Search for it
      const searchInput = page.locator("input[placeholder='Search shortcuts...']");
      await searchInput.fill("Searchable");

      // Verify it's still visible
      await expect(page.locator("text=Searchable Shortcut")).toBeVisible();

      // Search for something that doesn't exist
      await searchInput.fill("NonExistent");

      // Verify it's hidden
      await expect(page.locator("text=Searchable Shortcut")).not.toBeVisible();
    });
  });

  test.describe("General", () => {
    test("Export Options", async ({page, extensionId}) => {
      await page.goto(`chrome-extension://${extensionId}/options.html?host=${mockHost}`);

      await page.waitForSelector("button[title='Export Options']", {timeout: 1000});

      // Set up download listener
      const downloadPromise = page.waitForEvent("download");

      // Click Export Options button
      await page.locator("button[title='Export Options']").click();

      // Wait for download
      const download = await downloadPromise;

      // Verify download filename
      expect(download.suggestedFilename()).toBe("reloadedConfiguration.json");
    });

    test("Import Options", async ({page, extensionId}) => {
      await page.goto(`chrome-extension://${extensionId}/options.html?host=${mockHost}`);

      await page.waitForSelector("button[title='Import Options']", {timeout: 1000});

      // Create test options JSON
      const testOptions = {
        "scrollOnFlowBuilder": "true",
        "popupDarkTheme": "false"
      };

      // Set up file input - create a temporary file
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const tempFile = path.join(os.tmpdir(), "test-options.json");
      fs.writeFileSync(tempFile, JSON.stringify(testOptions));

      try {
        const fileInput = page.locator("input[type='file']");
        await fileInput.setInputFiles(tempFile);
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }

      // Wait for toast notification
      await page.waitForSelector(".slds-notify", {timeout: 1000});

      // Verify success toast appears
      await expect(page.locator("text=Options Imported Successfully!")).toBeVisible({timeout: 1000});
    });
  });

  test.describe("Metadata", () => {
    test("Switch to Metadata Tab", async ({page, extensionId}) => {
      const optionsUrl = `chrome-extension://${extensionId}/options.html?host=${mockHost}`;
      await page.goto(optionsUrl);

      await page.waitForSelector(".sfir-options-tab-container", {timeout: 1000});

      // Click Metadata tab (use role="tab" to be specific)
      await page.locator("a[role='tab']:has-text('Metadata')").click();

      // Verify Metadata tab is active
      await expect(page.locator(".options-tab:has-text('Metadata')")).toHaveClass(/slds-is-active/);

      // Verify Include managed packages metadata option is visible
      await expect(page.locator("text=Include managed packages metadata")).toBeVisible();
    });

    test("Toggle Include Managed Packages Metadata", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Metadata");

      // Find Include managed packages metadata checkbox by key
      const checkbox = page.locator("input#includeManagedMetadata");
      await expect(checkbox).toBeVisible();

      // Get initial state
      const initialChecked = await checkbox.isChecked();

      // Find the parent container and click the toggle span
      const checkboxContainer = checkbox.locator("..").locator("..");
      const toggleSpan = checkboxContainer.locator("span.slds-checkbox_faux_container");
      await toggleSpan.click();

      // Wait for state to update
      await page.waitForTimeout(500);

      // Verify state changed
      const newChecked = await checkbox.isChecked();
      expect(newChecked).toBe(!initialChecked);
    });

    test("Change Sort Metadata By", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Metadata");

      // Wait for Sort metadata components text
      await page.waitForSelector("text=Sort metadata components", {timeout: 1000});

      // Find Sort metadata components select - look for select near the text
      const sortMetadataText = page.locator("text=Sort metadata components").first();
      const sortSelect = sortMetadataText.locator("..").locator("..").locator("select.slds-select").first();
      await expect(sortSelect).toBeVisible();

      // Change to Last Modified Date DESC
      await sortSelect.selectOption("lastModifiedDate");

      // Verify value is changed
      await expect(sortSelect).toHaveValue("lastModifiedDate");
    });
  });

  test.describe("Enable Logs", () => {
    test("Switch to Enable Logs Tab", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Enable Logs");

      // Verify Enable Logs tab is active
      await expect(page.locator(".options-tab:has-text('Enable Logs')")).toHaveClass(/slds-is-active/);

      // Verify Debug Level option is visible
      await expect(page.locator("text=Debug Level (DeveloperName)")).toBeVisible();
    });

    test("Change Debug Level", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Enable Logs");

      // Wait for debug level input
      await page.waitForSelector("input#debugLogDebugLevel", {timeout: 1000});

      // Find debug level input
      const debugLevelInput = page.locator("input#debugLogDebugLevel");
      await expect(debugLevelInput).toBeVisible();

      // Change debug level
      await debugLevelInput.fill("CustomDebugLevel");

      // Verify value is set
      await expect(debugLevelInput).toHaveValue("CustomDebugLevel");
    });

    test("Change Debug Log Time", async ({page, extensionId}) => {
      await initOptionsPage(page, extensionId, null, "Enable Logs");

      // Wait for debug log time input
      await page.waitForSelector("input#debugLogTimeMinutes", {timeout: 1000});

      // Find debug log time input
      const debugTimeInput = page.locator("input#debugLogTimeMinutes");
      await expect(debugTimeInput).toBeVisible();

      // Change debug log time
      await debugTimeInput.fill("30");

      // Verify value is set
      await expect(debugTimeInput).toHaveValue("30");
    });
  });
});
